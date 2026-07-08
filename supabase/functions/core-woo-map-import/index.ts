// Import Woo products into core_woo_product_map (snapshot only). No writes to Woo.
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
  try { body = await req.json(); } catch { /* ignore */ }
  const startPage = Math.max(1, Number(body?.start_page ?? 1) | 0);
  const maxPages = Math.max(1, Math.min(50, Number(body?.max_pages ?? 20) | 0));
  const perPage = 100;

  let totalFetched = 0;
  let upserted = 0;
  let pagesRead = 0;
  const errors: string[] = [];
  let lastPageHadItems = true;
  let page = startPage;

  while (page < startPage + maxPages && lastPageHadItems) {
    let items: any[] = [];
    try {
      items = await wcFetch(`/products`, { per_page: String(perPage), page: String(page), status: "any" });
    } catch (e) {
      errors.push(`page ${page}: ${(e as Error).message}`);
      break;
    }
    pagesRead += 1;
    if (!Array.isArray(items) || items.length === 0) { lastPageHadItems = false; break; }
    totalFetched += items.length;

    const rows = items.map((p: any) => ({
      woo_product_id: Number(p.id),
      woo_product_name: p.name ?? null,
      woo_product_sku: p.sku ?? null,
      woo_product_type: p.type ?? null,
      woo_status: p.status ?? null,
      woo_permalink: p.permalink ?? null,
      woo_parent_id: p.parent_id ? Number(p.parent_id) : null,
      woo_variations_count: Array.isArray(p.variations) ? p.variations.length : 0,
      woo_raw_payload: {
        id: p.id, name: p.name, sku: p.sku, type: p.type, status: p.status,
        permalink: p.permalink, price: p.price, regular_price: p.regular_price,
        stock_quantity: p.stock_quantity, stock_status: p.stock_status,
        categories: Array.isArray(p.categories) ? p.categories.map((c: any) => c?.name).filter(Boolean) : [],
        variations_count: Array.isArray(p.variations) ? p.variations.length : 0,
      },
      updated_by: userId,
    }));

    const { error } = await supabase
      .from("core_woo_product_map")
      .upsert(rows, { onConflict: "woo_product_id", ignoreDuplicates: false });
    if (error) errors.push(`page ${page}: db ${error.message}`);
    else upserted += rows.length;

    if (items.length < perPage) { lastPageHadItems = false; break; }
    page += 1;
  }

  return json({
    ok: true,
    pages_read: pagesRead,
    start_page: startPage,
    total_fetched: totalFetched,
    upserted,
    has_more: lastPageHadItems,
    next_page: lastPageHadItems ? startPage + pagesRead : null,
    errors,
  });
});
