import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WC_BASE = "https://basicoclothes.com/wp-json/wc/v3";

async function wcFetch(path: string, params: Record<string, string> = {}) {
  const key = Deno.env.get("WC_CONSUMER_KEY")!;
  const secret = Deno.env.get("WC_CONSUMER_SECRET")!;
  const qs = new URLSearchParams({ consumer_key: key, consumer_secret: secret, ...params });
  const res = await fetch(`${WC_BASE}${path}?${qs}`);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`WooCommerce: bad response (${res.status})`); }
  return { body, totalPages: parseInt(res.headers.get("X-WP-TotalPages") || "1") };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "catalog"; // catalog | sales
    const maxPages = parseInt(url.searchParams.get("max_pages") || "5");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const summary = {
      mode,
      scanned: 0,
      auto_linked: 0,
      candidates_added: 0,
      conflicts: 0,
      requires_sku: 0,
      pages: 0,
    };

    async function findCoreBySku(sku: string | null) {
      if (!sku) return null;
      const { data } = await supabase
        .from("core_products")
        .select("id, core_sku, name")
        .or(`core_sku.eq.${sku},woo_sku.eq.${sku}`)
        .limit(2);
      return data ?? [];
    }

    async function findVariantBySku(sku: string | null) {
      if (!sku) return null;
      const { data } = await supabase
        .from("core_product_variants")
        .select("id, core_product_id, size, variant_sku, woo_sku")
        .or(`variant_sku.eq.${sku},woo_sku.eq.${sku}`)
        .limit(2);
      return data ?? [];
    }

    async function upsertCandidate(row: any) {
      const q = supabase.from("core_woo_product_candidates").select("id, status").eq("woo_product_id", row.woo_product_id);
      const { data: existing } = row.woo_variation_id
        ? await q.eq("woo_variation_id", row.woo_variation_id).maybeSingle()
        : await q.is("woo_variation_id", null).maybeSingle();

      if (existing) {
        await supabase.from("core_woo_product_candidates").update({
          woo_product_name: row.woo_product_name ?? null,
          woo_sku: row.woo_sku ?? null,
          woo_status: row.woo_status ?? null,
          woo_stock_quantity: row.woo_stock_quantity ?? null,
          woo_regular_price: row.woo_regular_price ?? null,
          woo_sale_price: row.woo_sale_price ?? null,
          woo_permalink: row.woo_permalink ?? null,
          woo_variations: row.woo_variations ?? null,
          source_order_id: row.source_order_id ?? null,
          source_order_item_id: row.source_order_item_id ?? null,
          detected_from: row.detected_from,
          status: row.status ?? existing.status,
          notes: row.notes ?? null,
        }).eq("id", existing.id);
      } else {
        await supabase.from("core_woo_product_candidates").insert(row);
        summary.candidates_added += 1;
      }
      if (row.status === "conflicto") summary.conflicts += 1;
      if (row.status === "requiere_sku") summary.requires_sku += 1;
    }

    if (mode === "catalog") {
      for (let page = 1; page <= maxPages; page++) {
        const { body, totalPages } = await wcFetch("/products", { per_page: "100", page: String(page), status: "any" });
        if (!Array.isArray(body)) break;
        summary.pages = page;
        for (const p of body) {
          summary.scanned += 1;
          const wooSku = (p.sku ?? "").trim() || null;

          if (wooSku) {
            const matches = await findCoreBySku(wooSku);
            if (matches && matches.length === 1) {
              await supabase.from("core_products").update({
                woo_product_id: p.id,
                woo_product_name: p.name,
                woo_sku: wooSku,
                woo_permalink: p.permalink,
                woo_status: p.status,
                woo_stock_quantity: p.stock_quantity ?? null,
                woo_regular_price: p.regular_price ? Number(p.regular_price) : null,
                woo_sale_price: p.sale_price ? Number(p.sale_price) : null,
                woo_last_sync_at: new Date().toISOString(),
                sku_source: "woocommerce",
                sync_status: "synced",
              }).eq("id", matches[0].id);
              summary.auto_linked += 1;
              continue;
            }
            if (matches && matches.length > 1) {
              await upsertCandidate({
                woo_product_id: p.id,
                woo_product_name: p.name,
                woo_sku: wooSku,
                woo_status: p.status,
                woo_stock_quantity: p.stock_quantity ?? null,
                woo_regular_price: p.regular_price ? Number(p.regular_price) : null,
                woo_sale_price: p.sale_price ? Number(p.sale_price) : null,
                woo_permalink: p.permalink,
                detected_from: "catalog",
                status: "conflicto",
                notes: "Hay varios Productos Core con este SKU",
              });
              continue;
            }
          }

          let variations: any[] = [];
          if (p.type === "variable" && Array.isArray(p.variations) && p.variations.length > 0) {
            const { body: vs } = await wcFetch(`/products/${p.id}/variations`, { per_page: "100" });
            if (Array.isArray(vs)) variations = vs;
          }

          await upsertCandidate({
            woo_product_id: p.id,
            woo_product_name: p.name,
            woo_sku: wooSku,
            woo_status: p.status,
            woo_stock_quantity: p.stock_quantity ?? null,
            woo_regular_price: p.regular_price ? Number(p.regular_price) : null,
            woo_sale_price: p.sale_price ? Number(p.sale_price) : null,
            woo_permalink: p.permalink,
            woo_variations: variations.length > 0 ? variations.map(v => ({
              id: v.id, sku: v.sku, attributes: v.attributes,
              stock_quantity: v.stock_quantity,
              regular_price: v.regular_price ? Number(v.regular_price) : null,
              sale_price: v.sale_price ? Number(v.sale_price) : null,
            })) : null,
            detected_from: "catalog",
            status: wooSku ? "pendiente" : "requiere_sku",
            notes: wooSku ? null : "Producto WooCommerce sin SKU",
          });
        }
        if (page >= totalPages) break;
      }
    }

    if (mode === "sales") {
      const { data: items } = await supabase
        .from("order_items")
        .select("id, order_id, sku, parent_sku, product_name, line_item_id")
        .not("sku", "is", null)
        .limit(2000);

      const skuSeen = new Set<string>();
      for (const it of (items ?? [])) {
        summary.scanned += 1;
        const sku = (it.sku ?? "").trim();
        if (!sku || skuSeen.has(sku)) continue;
        skuSeen.add(sku);

        const vMatches = await findVariantBySku(sku);
        if (vMatches && vMatches.length === 1) {
          summary.auto_linked += 1;
          continue;
        }
        const parentSku = (it.parent_sku ?? "").trim() || sku;
        const pMatches = await findCoreBySku(parentSku);
        if (pMatches && pMatches.length === 1) {
          summary.auto_linked += 1;
          continue;
        }
        if (pMatches && pMatches.length > 1) {
          await upsertCandidate({
            woo_product_id: 0,
            woo_product_name: it.product_name,
            woo_sku: sku,
            detected_from: "sales",
            status: "conflicto",
            source_order_id: it.order_id,
            source_order_item_id: it.line_item_id,
            notes: "Varios Core con el mismo SKU padre",
          });
          continue;
        }

        await upsertCandidate({
          woo_product_id: 0,
          woo_product_name: it.product_name,
          woo_sku: sku,
          detected_from: "sales",
          status: "pendiente",
          source_order_id: it.order_id,
          source_order_item_id: it.line_item_id,
          notes: "Producto vendido no encontrado en Productos Core",
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("core-woo-sync error:", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
