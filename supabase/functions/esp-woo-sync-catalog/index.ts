// Sincronización de catálogo WooCommerce España -> esp_products / esp_product_variants
// READ-ONLY contra Woo. Nunca escribe en WooCommerce.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SyncSummary = {
  products_checked: number;
  products_created: number;
  products_updated: number;
  variants_checked: number;
  variants_created: number;
  variants_updated: number;
  skipped_no_sku: number;
  errors: string[];
};

function getWooConfig() {
  const key = Deno.env.get("WC_ES_CONSUMER_KEY");
  const secret = Deno.env.get("WC_ES_CONSUMER_SECRET");
  const baseRaw = (Deno.env.get("WC_ES_BASE_URL") || "https://basicoclothes.es").trim();
  if (!key || !secret) return null;
  const withProto = /^https?:\/\//i.test(baseRaw) ? baseRaw : `https://${baseRaw}`;
  const base = withProto.replace(/\/+$/, "") + "/wp-json/wc/v3";
  const auth = "Basic " + btoa(`${key}:${secret}`);
  return { base, auth, baseRaw };
}

async function wooGet(url: string, auth: string) {
  const r = await fetch(url, { headers: { Authorization: auth } });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Woo GET ${r.status}: ${text.slice(0, 200)}`);
  }
  return r.json();
}

function extractAttr(attrs: any[], names: string[]): string | null {
  if (!Array.isArray(attrs)) return null;
  for (const a of attrs) {
    const n = String(a?.name || "").toLowerCase();
    if (names.some(x => n.includes(x))) {
      const opt = Array.isArray(a.options) ? a.options[0] : a.option;
      if (opt) return String(opt);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
  );

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claims.claims.sub as string;

  // Role check
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const ok = (roles || []).some(r => r.role === "admin" || r.role === "manager");
  if (!ok) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || "sync";

  const cfg = getWooConfig();
  if (!cfg) {
    return new Response(JSON.stringify({
      ok: false, error: "missing_credentials",
      message: "Faltan secrets WC_ES_CONSUMER_KEY / WC_ES_CONSUMER_SECRET",
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // TEST CONNECTION
  if (action === "test") {
    try {
      const r = await fetch(`${cfg.base}/products?per_page=1`, { headers: { Authorization: cfg.auth } });
      const total = r.headers.get("X-WP-Total");
      return new Response(JSON.stringify({
        ok: r.ok, status: r.status, base_url: cfg.baseRaw, products_total: total,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // SYNC CATALOG
  const summary: SyncSummary = {
    products_checked: 0, products_created: 0, products_updated: 0,
    variants_checked: 0, variants_created: 0, variants_updated: 0,
    skipped_no_sku: 0, errors: [],
  };

  // Create run
  const { data: runRow, error: runErr } = await admin.from("esp_woo_sync_runs").insert({
    sync_type: "catalog", status: "running", created_by: userId,
  }).select("id").single();
  if (runErr) {
    return new Response(JSON.stringify({ ok: false, error: runErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const runId = runRow.id;

  try {
    let page = 1;
    const perPage = 50;
    while (true) {
      const products: any[] = await wooGet(
        `${cfg.base}/products?per_page=${perPage}&page=${page}&status=any`, cfg.auth
      );
      if (!Array.isArray(products) || products.length === 0) break;

      for (const wp of products) {
        summary.products_checked++;
        try {
          const wooSku: string = (wp.sku || "").trim();
          const wooId: number = wp.id;
          const name: string = wp.name || `WOO-${wooId}`;
          const status = wp.status === "publish" ? "active" : (wp.status === "draft" ? "draft" : "inactive");
          const image = Array.isArray(wp.images) && wp.images[0]?.src ? wp.images[0].src : null;
          const price = wp.price ? Number(wp.price) : null;

          // Match: woo_product_id -> sku -> create
          let { data: existing } = await admin.from("esp_products")
            .select("id, sku").eq("woo_product_id", wooId).maybeSingle();
          if (!existing && wooSku) {
            const { data: bySku } = await admin.from("esp_products")
              .select("id, sku").eq("sku", wooSku).maybeSingle();
            if (bySku) existing = bySku;
          }

          const sku = wooSku || existing?.sku || `WOO-${wooId}`;
          if (!wooSku && !existing) summary.skipped_no_sku++;

          const manageStock: boolean = !!wp.manage_stock;
          const stockStatus: string | null = wp.stock_status || null;
          const stockQty: number | null = typeof wp.stock_quantity === "number" ? wp.stock_quantity : null;
          // Política inicial: si Woo no gestiona stock -> fabricación ligera.
          const isPhysical = manageStock;
          const fulfillmentMode = isPhysical ? "physical_stock" : "made_to_order";
          const webStockPolicy = isPhysical ? "woo_managed_stock" : "no_web_stock";
          const isMto = !isPhysical;
          const reqFab = !isPhysical;

          const payload: any = {
            sku, name,
            product_type: wp.type || null,
            status,
            price_eur: price,
            has_variants: wp.type === "variable",
            woo_product_id: wooId,
            woo_permalink: wp.permalink || null,
            woo_status: wp.status || null,
            woo_type: wp.type || null,
            woo_image_url: image,
            image_url: image,
            woo_synced_at: new Date().toISOString(),
            source: "woocommerce_es",
            updated_by: userId,
            woo_manage_stock: manageStock,
            woo_stock_status: stockStatus,
            woo_stock_quantity: stockQty,
          };
          // Solo asignar política operativa la primera vez (no pisar ediciones manuales)
          const initialPolicyPayload = {
            fulfillment_mode: fulfillmentMode,
            web_stock_policy: webStockPolicy,
            is_made_to_order: isMto,
            requires_fabrication: reqFab,
          };

          let productId: string;
          if (existing) {
            const { error } = await admin.from("esp_products").update(payload).eq("id", existing.id);
            if (error) throw new Error(`product update ${wooId}: ${error.message}`);
            productId = existing.id;
            summary.products_updated++;
          } else {
            const { data, error } = await admin.from("esp_products")
              .insert({ ...payload, ...initialPolicyPayload, created_by: userId }).select("id").single();
            if (error) throw new Error(`product insert ${wooId}: ${error.message}`);
            productId = data.id;
            summary.products_created++;
          }

          // Variants
          if (wp.type === "variable") {
            let vpage = 1;
            while (true) {
              const variations: any[] = await wooGet(
                `${cfg.base}/products/${wooId}/variations?per_page=${perPage}&page=${vpage}`, cfg.auth
              );
              if (!Array.isArray(variations) || variations.length === 0) break;
              for (const wv of variations) {
                summary.variants_checked++;
                try {
                  const wvId: number = wv.id;
                  const wvSku: string = (wv.sku || "").trim();
                  const size = extractAttr(wv.attributes, ["talla", "size"]);
                  const color = extractAttr(wv.attributes, ["color", "colour"]);
                  const vPrice = wv.price ? Number(wv.price) : null;
                  const vStatus = wv.status === "publish" ? "active" : "inactive";

                  let { data: ev } = await admin.from("esp_product_variants")
                    .select("id, variant_sku").eq("woo_variation_id", wvId).maybeSingle();
                  if (!ev && wvSku) {
                    const { data: bySku } = await admin.from("esp_product_variants")
                      .select("id, variant_sku").eq("variant_sku", wvSku).maybeSingle();
                    if (bySku) ev = bySku;
                  }

                  const variantSku = wvSku || ev?.variant_sku || `WOO-${wvId}`;
                  if (!wvSku && !ev) summary.skipped_no_sku++;

                  const vPayload: any = {
                    product_id: productId,
                    variant_sku: variantSku,
                    size, color,
                    price_eur: vPrice,
                    status: vStatus,
                    woo_variation_id: wvId,
                    woo_product_id: wooId,
                    woo_status: wv.status || null,
                    woo_stock_quantity: typeof wv.stock_quantity === "number" ? wv.stock_quantity : null,
                    woo_synced_at: new Date().toISOString(),
                    source: "woocommerce_es",
                    updated_by: userId,
                  };

                  if (ev) {
                    const { error } = await admin.from("esp_product_variants").update(vPayload).eq("id", ev.id);
                    if (error) throw new Error(`variant update ${wvId}: ${error.message}`);
                    summary.variants_updated++;
                  } else {
                    const { error } = await admin.from("esp_product_variants")
                      .insert({ ...vPayload, created_by: userId });
                    if (error) throw new Error(`variant insert ${wvId}: ${error.message}`);
                    summary.variants_created++;
                  }
                } catch (e) {
                  summary.errors.push(e instanceof Error ? e.message : String(e));
                }
              }
              if (variations.length < perPage) break;
              vpage++;
            }
          }
        } catch (e) {
          summary.errors.push(e instanceof Error ? e.message : String(e));
        }
      }

      if (products.length < perPage) break;
      page++;
    }

    await admin.from("esp_woo_sync_runs").update({
      status: summary.errors.length > 0 ? "completed_with_errors" : "completed",
      finished_at: new Date().toISOString(),
      products_checked: summary.products_checked,
      products_created: summary.products_created,
      products_updated: summary.products_updated,
      variants_checked: summary.variants_checked,
      variants_created: summary.variants_created,
      variants_updated: summary.variants_updated,
      skipped_no_sku: summary.skipped_no_sku,
      errors_count: summary.errors.length,
      summary: { errors: summary.errors.slice(0, 50) },
    }).eq("id", runId);

    return new Response(JSON.stringify({ ok: true, run_id: runId, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("esp_woo_sync_runs").update({
      status: "failed", finished_at: new Date().toISOString(),
      errors_count: summary.errors.length + 1,
      summary: { errors: [...summary.errors, msg].slice(0, 50) },
    }).eq("id", runId);
    return new Response(JSON.stringify({ ok: false, error: msg, ...summary }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
