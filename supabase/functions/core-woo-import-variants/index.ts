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
  try { return JSON.parse(text); } catch { throw new Error(`WooCommerce: bad response (${res.status})`); }
}

function pickSize(attrs: any[]): { size: string | null; label: string | null; color: string | null } {
  if (!Array.isArray(attrs)) return { size: null, label: null, color: null };
  let size: string | null = null;
  let color: string | null = null;
  const labelParts: string[] = [];
  for (const a of attrs) {
    const name = String(a?.name ?? "").toLowerCase();
    const option = a?.option ? String(a.option) : null;
    if (!option) continue;
    labelParts.push(option);
    if (!size && (name.includes("talla") || name.includes("size") || name.includes("tama"))) size = option;
    if (!color && (name.includes("color") || name.includes("colour"))) color = option;
  }
  if (!size && attrs.length === 1) size = String(attrs[0].option ?? "") || null;
  return { size, label: labelParts.join(" / ") || size, color };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth
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
  try { body = await req.json(); } catch { /* ignore */ }

  const wooProductId = body?.woo_product_id ? Number(body.woo_product_id) : null;
  const coreProductId: string | null = body?.core_product_id ?? null;
  const apply: boolean = body?.apply === true; // false = preview only

  if (!wooProductId) return json({ error: "missing_woo_product_id" }, 400);

  // 1. Fetch parent product (for SKU + name) and its variations
  let parent: any;
  try {
    parent = await wcFetch(`/products/${wooProductId}`);
  } catch (e) {
    return json({ error: `woo_fetch_failed: ${(e as Error).message}` }, 502);
  }
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

  // 2. Normalize
  const parentSku = (parent.sku ?? "").toString().trim();
  const normalized = variations.map((v: any) => {
    const { size, label, color } = pickSize(v.attributes);
    const wooSku = (v.sku ?? "").toString().trim() || null;
    let variantSku: string | null = null;
    if (wooSku) {
      variantSku = wooSku.replace(/\s+/g, "-");
    } else if (parentSku && size) {
      variantSku = `${parentSku}-${size}`;
    }
    return {
      woo_variation_id: Number(v.id),
      woo_sku: wooSku,
      variant_sku: variantSku,
      size: size,
      variant_label: label,
      color,
      woo_stock_quantity: v.stock_quantity ?? null,
      woo_regular_price: v.regular_price ? Number(v.regular_price) : null,
      woo_sale_price: v.sale_price ? Number(v.sale_price) : null,
      status: v.status === "publish" ? "active" : "active",
    };
  });

  // Drop variants without a usable size
  const usable = normalized.filter(v => v.size);
  const skipped = normalized.length - usable.length;

  // 3. Preview-only path
  if (!apply || !coreProductId) {
    return json({
      preview: true,
      parent: {
        id: parent.id,
        name: parent.name,
        sku: parentSku,
        type: parent.type,
        permalink: parent.permalink ?? null,
        short_description: parent.short_description ?? null,
        description: parent.description ?? null,
        regular_price: parent.regular_price ? Number(parent.regular_price) : null,
        sale_price: parent.sale_price ? Number(parent.sale_price) : null,
        price: parent.price ? Number(parent.price) : null,
        categories: Array.isArray(parent.categories) ? parent.categories.map((c: any) => c?.name).filter(Boolean) : [],
      },
      total: normalized.length,
      usable: usable.length,
      skipped_missing_size: skipped,
      variants: usable,
    });
  }


  // 4. Apply: upsert into core_product_variants by (core_product_id, woo_variation_id) — fallback by (core_product_id, size)
  const { data: existing } = await supabase
    .from("core_product_variants")
    .select("id, size, woo_variation_id")
    .eq("core_product_id", coreProductId);

  const byVarId = new Map<number, any>();
  const bySize = new Map<string, any>();
  for (const r of existing ?? []) {
    if (r.woo_variation_id) byVarId.set(Number(r.woo_variation_id), r);
    if (r.size) bySize.set(String(r.size).toUpperCase(), r);
  }

  let created = 0;
  let updated = 0;
  let sort = 0;
  for (const v of usable) {
    const match = (v.woo_variation_id && byVarId.get(v.woo_variation_id)) || bySize.get(String(v.size).toUpperCase());
    const payload: any = {
      core_product_id: coreProductId,
      size: v.size,
      variant_label: v.variant_label,
      status: "active",
      woo_variation_id: v.woo_variation_id,
      woo_sku: v.woo_sku,
      variant_sku: v.variant_sku,
      woo_stock_quantity: v.woo_stock_quantity,
      woo_regular_price: v.woo_regular_price,
      woo_sale_price: v.woo_sale_price,
      woo_last_sync_at: new Date().toISOString(),
      sort_order: sort++,
    };
    if (match) {
      const { error } = await supabase.from("core_product_variants").update(payload).eq("id", match.id);
      if (!error) updated += 1;
    } else {
      const { error } = await supabase.from("core_product_variants").insert(payload);
      if (!error) created += 1;
    }
  }

  // Audit
  await supabase.from("core_audit_logs").insert({
    table_name: "core_product_variants",
    record_id: coreProductId,
    action: "import_from_woo",
    new_value: JSON.stringify({ woo_product_id: wooProductId, created, updated, skipped }),
    performed_by: userData?.user?.email ?? userId,
  });

  return json({
    applied: true,
    parent: { id: parent.id, name: parent.name, sku: parentSku },
    created,
    updated,
    skipped_missing_size: skipped,
    total: usable.length,
  });
});
