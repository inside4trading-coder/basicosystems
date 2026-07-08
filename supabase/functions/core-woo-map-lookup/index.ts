// Read-only lookup of a Woo product by ID. Used by "Vincular Woo ID" modal.
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
  if (!res.ok) throw new Error(`WooCommerce ${res.status}`);
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

  const url = new URL(req.url);
  const wooProductId = Number(url.searchParams.get("woo_product_id") ?? 0);
  if (!wooProductId) return json({ error: "missing_woo_product_id" }, 400);

  let parent: any;
  try { parent = await wcFetch(`/products/${wooProductId}`); }
  catch (e) { return json({ error: `woo_fetch_failed: ${(e as Error).message}` }, 502); }
  if (!parent?.id) return json({ error: "woo_product_not_found" }, 404);

  return json({
    ok: true,
    product: {
      id: parent.id,
      name: parent.name,
      sku: parent.sku,
      type: parent.type,
      status: parent.status,
      permalink: parent.permalink,
      parent_id: parent.parent_id,
      variations_count: Array.isArray(parent.variations) ? parent.variations.length : 0,
      categories: Array.isArray(parent.categories) ? parent.categories.map((c: any) => c?.name).filter(Boolean) : [],
      regular_price: parent.regular_price ? Number(parent.regular_price) : null,
      price: parent.price ? Number(parent.price) : null,
    },
  });
});
