// Read-only test: GET a product/variation from WooCommerce. No writes.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const productId = url.searchParams.get("product_id") ?? "32299";
  const variationId = url.searchParams.get("variation_id") ?? "32302";

  const key = Deno.env.get("WC_CONSUMER_KEY");
  const secret = Deno.env.get("WC_CONSUMER_SECRET");
  if (!key || !secret) {
    return new Response(JSON.stringify({ error: "missing WC_CONSUMER_KEY/SECRET" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const auth = "Basic " + btoa(`${key}:${secret}`);
  const base = "https://basicoclothes.com/wp-json/wc/v3";
  const endpoint = `${base}/products/${productId}/variations/${variationId}`;
  const r = await fetch(endpoint, { headers: { Authorization: auth } });
  const body = await r.json().catch(() => null);

  // Read-only probe: detect if key has write scope by checking permissions via WC index
  const idxR = await fetch(`${base}`, { headers: { Authorization: auth } });
  const idxBody = await idxR.json().catch(() => null);

  return new Response(JSON.stringify({
    endpoint,
    status: r.status,
    secret_used: "WC_CONSUMER_KEY / WC_CONSUMER_SECRET",
    wc_base: base,
    variation: body && {
      id: body.id, sku: body.sku, name: body.name,
      stock_quantity: body.stock_quantity, manage_stock: body.manage_stock,
      stock_status: body.stock_status, parent_id: body.parent_id,
    },
    wc_index_status: idxR.status,
    wc_index_routes_sample: idxBody?.routes ? Object.keys(idxBody.routes).slice(0, 5) : null,
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
