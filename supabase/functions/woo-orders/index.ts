import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = "https://basicoclothes.com/wp-json/wc/v3";

async function wcFetch(path: string, params: Record<string, string> = {}) {
  const WC_KEY = Deno.env.get("WC_CONSUMER_KEY")!;
  const WC_SECRET = Deno.env.get("WC_CONSUMER_SECRET")!;
  const qs = new URLSearchParams({ consumer_key: WC_KEY, consumer_secret: WC_SECRET, ...params });
  const res = await fetch(`${BASE}${path}?${qs}`);
  return {
    body: await res.json(),
    total: res.headers.get("X-WP-Total") || "0",
    totalPages: res.headers.get("X-WP-TotalPages") || "0",
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const page = url.searchParams.get("page") || "1";
    const perPage = url.searchParams.get("per_page") || "20";
    const status = url.searchParams.get("status") || "any";
    const search = url.searchParams.get("search") || "";

    const params: Record<string, string> = {
      page,
      per_page: perPage,
      status,
      orderby: "date",
      order: "desc",
    };
    if (search) params.search = search;

    const res = await wcFetch("/orders", params);

    const orders = Array.isArray(res.body)
      ? res.body.map((o: any) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          total: o.total,
          currency: o.currency,
          date_created: o.date_created_gmt || o.date_created,
          billing: {
            first_name: o.billing?.first_name || "",
            last_name: o.billing?.last_name || "",
            email: o.billing?.email || "",
            phone: o.billing?.phone || "",
          },
          shipping: {
            city: o.shipping?.city || "",
            country: o.shipping?.country || "",
          },
          line_items: (o.line_items || []).map((li: any) => ({
            name: li.name,
            quantity: li.quantity,
            total: li.total,
          })),
          payment_method_title: o.payment_method_title || "",
        }))
      : [];

    return new Response(JSON.stringify({
      orders,
      total: parseInt(res.total),
      totalPages: parseInt(res.totalPages),
      page: parseInt(page),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
