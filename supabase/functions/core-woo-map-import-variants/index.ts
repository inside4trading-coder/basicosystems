// Import Woo variations into core_woo_variant_map. If product is mapped to Core,
// also upsert into core_product_variants. Never deletes. No writes to Woo.
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
  if (!res.ok) throw new Error(`WooCommerce ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { throw new Error(`WooCommerce: bad response`); }
}

function pickSizeColor(attrs: any[]): { size: string | null; color: string | null } {
  if (!Array.isArray(attrs)) return { size: null, color: null };
  let size: string | null = null;
  let color: string | null = null;
  for (const a of attrs) {
    const name = String(a?.name ?? "").toLowerCase();
    const option = a?.option ? String(a.option) : null;
    if (!option) continue;
    if (!size && (name.includes("talla") || name.includes("size") || name.includes("tama"))) size = option;
    if (!color && (name.includes("color") || name.includes("colour"))) color = option;
  }
  if (!size && attrs.length === 1) size = String(attrs[0].option ?? "") || null;
  return { size, color };
}

function normalizeText(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase();
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return json({ error: "invalid_token" }, 401);
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  if (!roleSet.has("admin") && !roleSet.has("manager")) return json({ error: "forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const wooProductId = body?.woo_product_id ? Number(body.woo_product_id) : null;
  if (!wooProductId) return json({ error: "missing_woo_product_id" }, 400);

  // Find map row
  const { data: mapRow } = await supabase
    .from("core_woo_product_map")
    .select("id, core_product_id, woo_product_name")
    .eq("woo_product_id", wooProductId)
    .maybeSingle();

  let parent: any;
  try { parent = await wcFetch(`/products/${wooProductId}`); }
  catch (e) { return json({ error: `woo_fetch_failed: ${(e as Error).message}` }, 502); }
  if (!parent?.id) return json({ error: "woo_product_not_found" }, 404);

  let variations: any[] = [];
  if (parent.type === "variable") {
    try {
      const vs = await wcFetch(`/products/${wooProductId}/variations`, { per_page: "100" });
      if (Array.isArray(vs)) variations = vs;
    } catch (e) {
      return json({ error: `woo_variations_failed: ${(e as Error).message}` }, 502);
    }
  }

  const parentSku = (parent.sku ?? "").toString().trim();
  const normalized = variations.map((v: any) => {
    const { size, color } = pickSizeColor(v.attributes);
    const wooSku = (v.sku ?? "").toString().trim() || null;
    let variantSku: string | null = wooSku;
    if (!variantSku && parentSku && size) {
      variantSku = `${parentSku}-${size}${color ? "-" + color : ""}`.replace(/\s+/g, "-");
    }
    return {
      woo_product_id: wooProductId,
      woo_variation_id: Number(v.id),
      woo_variant_sku: variantSku,
      woo_attributes: Array.isArray(v.attributes) ? v.attributes : null,
      size_label: size,
      normalized_size: normalizeText(size),
      color_label: color,
      normalized_color: normalizeText(color),
      woo_price: v.price ? Number(v.price) : (v.regular_price ? Number(v.regular_price) : null),
      woo_stock_quantity: v.stock_quantity ?? null,
      woo_raw_payload: {
        id: v.id, sku: v.sku, price: v.price, regular_price: v.regular_price,
        stock_quantity: v.stock_quantity, stock_status: v.stock_status, status: v.status,
      },
    };
  });

  // Upsert variant map
  let mapUpserted = 0;
  if (normalized.length > 0) {
    const { error } = await supabase
      .from("core_woo_variant_map")
      .upsert(normalized, { onConflict: "woo_variation_id", ignoreDuplicates: false });
    if (error) return json({ error: `variant_map_upsert: ${error.message}` }, 500);
    mapUpserted = normalized.length;
  }

  // Optionally sync into core_product_variants if mapped
  let coreCreated = 0;
  let coreUpdated = 0;
  const coreProductId = mapRow?.core_product_id ?? null;
  if (coreProductId) {
    const { data: existing } = await supabase
      .from("core_product_variants")
      .select("id, size, color, woo_variation_id")
      .eq("core_product_id", coreProductId);
    const byVar = new Map<number, any>();
    const bySc = new Map<string, any>();
    for (const r of existing ?? []) {
      if (r.woo_variation_id) byVar.set(Number(r.woo_variation_id), r);
      bySc.set(`${String(r.size ?? "").toUpperCase()}|${String(r.color ?? "").toUpperCase()}`, r);
    }
    const usable = normalized.filter(n => n.size_label);
    let sort = 0;
    for (const v of usable) {
      const key = `${String(v.size_label ?? "").toUpperCase()}|${String(v.color_label ?? "").toUpperCase()}`;
      const match = byVar.get(v.woo_variation_id) || bySc.get(key);
      const payload: any = {
        core_product_id: coreProductId,
        size: v.size_label,
        normalized_size: v.normalized_size,
        variant_label: v.size_label,
        color: v.color_label,
        normalized_color: v.normalized_color,
        woo_attributes: v.woo_attributes,
        status: "active",
        woo_variation_id: v.woo_variation_id,
        woo_sku: v.woo_variant_sku,
        variant_sku: v.woo_variant_sku,
        woo_stock_quantity: v.woo_stock_quantity,
        woo_regular_price: v.woo_price,
        woo_last_sync_at: new Date().toISOString(),
        sort_order: sort++,
      };
      if (match) {
        const { error } = await supabase.from("core_product_variants").update(payload).eq("id", match.id);
        if (!error) {
          coreUpdated += 1;
          await supabase.from("core_woo_variant_map")
            .update({ core_product_id: coreProductId, core_variant_id: match.id, mapping_status: "mapped" })
            .eq("woo_variation_id", v.woo_variation_id);
        }
      } else {
        const { data: ins, error } = await supabase.from("core_product_variants").insert(payload).select("id").maybeSingle();
        if (!error && ins?.id) {
          coreCreated += 1;
          await supabase.from("core_woo_variant_map")
            .update({ core_product_id: coreProductId, core_variant_id: ins.id, mapping_status: "mapped" })
            .eq("woo_variation_id", v.woo_variation_id);
        }
      }
    }
  }

  // Update product map status
  const syncStatus = normalized.length === 0
    ? "not_applicable"
    : (coreProductId ? "synced" : "partial");
  if (mapRow?.id) {
    await supabase
      .from("core_woo_product_map")
      .update({
        variants_sync_status: syncStatus,
        last_synced_at: new Date().toISOString(),
        woo_variations_count: normalized.length,
        updated_by: userId,
      })
      .eq("id", mapRow.id);
  }

  // Audit
  await supabase.from("core_product_strategy_decisions").insert({
    woo_product_id: wooProductId,
    core_product_id: coreProductId,
    decision_type: "sync_variants",
    new_values: { woo_variation_count: normalized.length, core_created: coreCreated, core_updated: coreUpdated },
    created_by: userId,
  });

  return json({
    ok: true,
    woo_product_id: wooProductId,
    woo_variations_detected: variations.length,
    variant_map_upserted: mapUpserted,
    core_variants_created: coreCreated,
    core_variants_updated: coreUpdated,
    core_product_id: coreProductId,
    sync_status: syncStatus,
  });
});
