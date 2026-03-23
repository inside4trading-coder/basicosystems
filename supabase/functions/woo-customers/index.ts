import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

function mapCustomer(c: any) {
  return {
    id: c.id,
    email: c.email || "",
    first_name: c.first_name || "",
    last_name: c.last_name || "",
    username: c.username || "",
    avatar_url: c.avatar_url || "",
    billing_company: c.billing?.company || "",
    billing_city: c.billing?.city || "",
    billing_state: c.billing?.state || "",
    billing_country: c.billing?.country || "",
    billing_phone: c.billing?.phone || "",
    orders_count: c.orders_count ?? 0,
    total_spent: c.total_spent ?? "0.00",
    date_created: c.date_created_gmt || c.date_created || "",
    last_order_date: c.date_last_active_gmt || c.date_last_active || null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const page = url.searchParams.get("page") || "1";
    const perPage = url.searchParams.get("per_page") || "20";
    const search = url.searchParams.get("search") || "";
    const orderby = url.searchParams.get("orderby") || "registered_date";
    const order = url.searchParams.get("order") || "desc";

    const params: Record<string, string> = { page, per_page: perPage, orderby, order };
    if (search) params.search = search;

    const res = await wcFetch("/customers", params);
    const customers = Array.isArray(res.body) ? res.body.map(mapCustomer) : [];

    return new Response(JSON.stringify({
      customers,
      total: parseInt(res.total),
      totalPages: parseInt(res.totalPages),
      page: parseInt(page),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("woo-customers error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});