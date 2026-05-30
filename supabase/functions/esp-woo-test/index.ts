// Test WooCommerce España connection (read-only)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("WC_ES_CONSUMER_KEY");
  const secret = Deno.env.get("WC_ES_CONSUMER_SECRET");
  const baseRaw = (Deno.env.get("WC_ES_BASE_URL") || "https://basicoclothes.es").trim();

  if (!key || !secret) {
    return new Response(JSON.stringify({ ok: false, error: "missing_credentials" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const withProto = /^https?:\/\//i.test(baseRaw) ? baseRaw : `https://${baseRaw}`;
  const base = withProto.replace(/\/+$/, "") + "/wp-json/wc/v3";
  const auth = "Basic " + btoa(`${key}:${secret}`);
  const headers = { Authorization: auth };

  try {
    const [rootR, ordersR, productsR, customersR] = await Promise.all([
      fetch(base, { headers }),
      fetch(`${base}/orders?per_page=1`, { headers }),
      fetch(`${base}/products?per_page=1`, { headers }),
      fetch(`${base}/customers?per_page=1`, { headers }),
    ]);

    const ordersTotal = ordersR.headers.get("X-WP-Total");
    const productsTotal = productsR.headers.get("X-WP-Total");
    const customersTotal = customersR.headers.get("X-WP-Total");

    const ok = rootR.ok && ordersR.ok && productsR.ok;

    return new Response(JSON.stringify({
      ok,
      base_url: baseRaw,
      wc_endpoint: base,
      checks: {
        root: rootR.status,
        orders: { status: ordersR.status, total: ordersTotal },
        products: { status: productsR.status, total: productsTotal },
        customers: { status: customersR.status, total: customersTotal },
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
