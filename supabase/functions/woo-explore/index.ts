import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const WC_KEY = Deno.env.get("WC_CONSUMER_KEY")!;
  const WC_SECRET = Deno.env.get("WC_CONSUMER_SECRET")!;
  const base = "https://basicoclothes.com/wp-json/wc/v3";
  const authHeader = "Basic " + btoa(`${WC_KEY}:${WC_SECRET}`);
  const headers = { "Authorization": authHeader };

  try {
    // First test: check if WC API root is accessible
    const rootRes = await fetch("https://basicoclothes.com/wp-json/wc/v3", { headers });
    const rootText = await rootRes.text();
    
    let orders, customers, products;
    try {
      const [ordersRes, customersRes, productsRes] = await Promise.all([
        fetch(`${base}/orders?per_page=1`, { headers }),
        fetch(`${base}/customers?per_page=1`, { headers }),
        fetch(`${base}/products?per_page=1`, { headers }),
      ]);
      orders = { status: ordersRes.status, body: await ordersRes.json().catch(() => ordersRes.statusText) };
      customers = { status: customersRes.status, body: await customersRes.json().catch(() => customersRes.statusText) };
      products = { status: productsRes.status, body: await productsRes.json().catch(() => productsRes.statusText) };
    } catch (e) {
      orders = customers = products = { error: e instanceof Error ? e.message : String(e) };
    }

    // Also try query param auth as fallback
    const fallbackRes = await fetch(`${base}/orders?per_page=1&consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`);
    const fallbackBody = await fallbackRes.text();

    return new Response(JSON.stringify({
      root: { status: rootRes.status, body: rootText.substring(0, 500) },
      orders, customers, products,
      fallback: { status: fallbackRes.status, body: fallbackBody.substring(0, 500) },
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
