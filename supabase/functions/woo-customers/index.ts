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

// Build customer stats from orders (since WooCommerce customer fields are empty)
async function fetchBuyersFromOrders(page: number, perPage: number, search: string) {
  // Fetch 1 page of 100 orders (WooCommerce API is slow, keep it fast)
  const res1 = await wcFetch("/orders", {
    per_page: "25",
    page: "1",
  });

  const allOrders = Array.isArray(res1.body) ? res1.body : [];

  // Aggregate by customer_id or billing email
  const customerMap = new Map<string, {
    customer_id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    city: string;
    country: string;
    orders_count: number;
    total_spent: number;
    last_order_date: string;
  }>();

  for (const order of allOrders) {
    const email = order.billing?.email || "";
    const custId = order.customer_id || 0;
    // Use customer_id if available, otherwise email
    const key = custId > 0 ? `id:${custId}` : (email ? `email:${email}` : null);
    if (!key) continue;

    const existing = customerMap.get(key);
    if (existing) {
      existing.orders_count += 1;
      existing.total_spent += parseFloat(order.total || "0");
      if (order.date_created > existing.last_order_date) {
        existing.last_order_date = order.date_created;
      }
    } else {
      customerMap.set(key, {
        customer_id: custId,
        email,
        first_name: order.billing?.first_name || "",
        last_name: order.billing?.last_name || "",
        phone: order.billing?.phone || "",
        city: order.shipping?.city || order.billing?.city || "",
        country: order.shipping?.country || order.billing?.country || "",
        orders_count: 1,
        total_spent: parseFloat(order.total || "0"),
        last_order_date: order.date_created || "",
      });
    }
  }

  // Convert to array and sort by total_spent desc
  let buyers = Array.from(customerMap.values()).map(b => ({
    id: b.customer_id,
    email: b.email,
    first_name: b.first_name,
    last_name: b.last_name,
    username: "",
    avatar_url: "",
    billing_company: "",
    billing_city: b.city,
    billing_state: "",
    billing_country: b.country,
    billing_phone: b.phone,
    orders_count: b.orders_count,
    total_spent: b.total_spent.toFixed(2),
    date_created: "",
    last_order_date: b.last_order_date,
  }));

  // Apply search filter
  if (search) {
    const s = search.toLowerCase();
    buyers = buyers.filter(c =>
      c.first_name.toLowerCase().includes(s) ||
      c.last_name.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s)
    );
  }

  // Sort by total spent descending
  buyers.sort((a, b) => parseFloat(b.total_spent) - parseFloat(a.total_spent));

  const total = buyers.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const paginated = buyers.slice(start, start + perPage);

  return {
    customers: paginated,
    total,
    totalPages,
    page,
    totalOrders: parseInt(res1.total),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = parseInt(url.searchParams.get("per_page") || "20");
    const search = url.searchParams.get("search") || "";
    const orderby = url.searchParams.get("orderby") || "registered_date";
    const order = url.searchParams.get("order") || "desc";
    const mode = url.searchParams.get("mode") || "all";

    // Buyers mode: aggregate from orders
    if (mode === "buyers") {
      const result = await fetchBuyersFromOrders(page, perPage, search);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // All mode: standard WooCommerce customer list
    const params: Record<string, string> = {
      page: String(page),
      per_page: String(perPage),
      orderby,
      order,
    };
    if (search) params.search = search;

    const res = await wcFetch("/customers", params);
    const customers = Array.isArray(res.body) ? res.body.map(mapCustomer) : [];

    return new Response(JSON.stringify({
      customers,
      total: parseInt(res.total),
      totalPages: parseInt(res.totalPages),
      page,
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