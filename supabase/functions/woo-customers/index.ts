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

async function fetchBuyers(page: number, perPage: number, search: string) {
  // Fetch 3 pages of 100 orders in parallel to find unique buyers fast
  const orderFetches = [1, 2, 3].map(p =>
    wcFetch("/orders", {
      per_page: "100",
      page: String(p),
      orderby: "date",
      order: "desc",
      status: "completed,processing,on-hold",
    })
  );

  const orderResults = await Promise.all(orderFetches);
  
  const customerIds = new Set<number>();
  for (const res of orderResults) {
    const orders = Array.isArray(res.body) ? res.body : [];
    for (const o of orders) {
      if (o.customer_id && o.customer_id > 0) {
        customerIds.add(o.customer_id);
      }
    }
  }

  console.log(`Found ${customerIds.size} unique buyer IDs from orders`);

  if (customerIds.size === 0) {
    return { customers: [], total: 0, totalPages: 0, page };
  }

  // Fetch customer details - up to 100 at a time
  const allIds = Array.from(customerIds);
  const batches: Promise<any>[] = [];
  for (let i = 0; i < allIds.length; i += 100) {
    const batchIds = allIds.slice(i, i + 100);
    batches.push(wcFetch("/customers", {
      include: batchIds.join(","),
      per_page: "100",
    }));
  }

  const batchResults = await Promise.all(batches);
  const allCustomers: any[] = [];
  for (const res of batchResults) {
    const custs = Array.isArray(res.body) ? res.body : [];
    allCustomers.push(...custs);
  }

  let mapped = allCustomers.map(mapCustomer);

  // Filter by search if needed
  if (search) {
    const s = search.toLowerCase();
    mapped = mapped.filter(c =>
      c.first_name.toLowerCase().includes(s) ||
      c.last_name.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s) ||
      c.billing_company.toLowerCase().includes(s)
    );
  }

  // Sort by total_spent desc
  mapped.sort((a, b) => parseFloat(b.total_spent) - parseFloat(a.total_spent));

  const total = mapped.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const paginated = mapped.slice(start, start + perPage);

  return { customers: paginated, total, totalPages, page };
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

    if (mode === "buyers") {
      const result = await fetchBuyers(page, perPage, search);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: standard WooCommerce customer list
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