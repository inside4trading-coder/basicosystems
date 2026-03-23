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
  const base = "https://basicoclothes.es/wp-json/wc/v3";
  const auth = `consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`;

  try {
    const [ordersRes, customersRes, productsRes] = await Promise.all([
      fetch(`${base}/orders?per_page=1&${auth}`),
      fetch(`${base}/customers?per_page=1&${auth}`),
      fetch(`${base}/products?per_page=1&${auth}`),
    ]);

    const orders = await ordersRes.json();
    const customers = await customersRes.json();
    const products = await productsRes.json();

    return new Response(JSON.stringify({ orders, customers, products }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
