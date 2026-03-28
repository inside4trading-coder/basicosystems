import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const {
      min_orders,
      max_orders,
      min_spent,
      max_spent,
      last_order_days_min,
      last_order_days_max,
      country,
      city,
      exclude_emails,
      count_only,
    } = body;

    // Source: customers_cache (7,922 customers with email)
    // Paginate to get all records
    let allCustomers: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      let query = supabase
        .from("customers_cache")
        .select("email, first_name, last_name, orders_count, total_spent, last_order_date, date_created, billing_country, billing_city")
        .not("email", "is", null)
        .neq("email", "")
        .range(from, from + pageSize - 1);

      if (country) {
        query = query.eq("billing_country", country);
      }
      if (city) {
        query = query.ilike("billing_city", `%${city}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;
      allCustomers = allCustomers.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Filter out excluded emails
    if (exclude_emails && Array.isArray(exclude_emails) && exclude_emails.length > 0) {
      const excludeSet = new Set(exclude_emails.map((e: string) => e.toLowerCase()));
      allCustomers = allCustomers.filter((c: any) => !excludeSet.has(c.email?.toLowerCase()));
    }

    // Apply numeric/date filters
    let contacts = allCustomers;

    if (min_orders != null) {
      contacts = contacts.filter((c: any) => (c.orders_count || 0) >= min_orders);
    }
    if (max_orders != null) {
      contacts = contacts.filter((c: any) => (c.orders_count || 0) <= max_orders);
    }
    if (min_spent != null) {
      contacts = contacts.filter((c: any) => (parseFloat(c.total_spent) || 0) >= min_spent);
    }
    if (max_spent != null) {
      contacts = contacts.filter((c: any) => (parseFloat(c.total_spent) || 0) <= max_spent);
    }

    const now = Date.now();
    if (last_order_days_min != null) {
      const cutoff = now - parseInt(last_order_days_min) * 86400000;
      contacts = contacts.filter((c: any) => c.last_order_date && new Date(c.last_order_date).getTime() >= cutoff);
    }
    if (last_order_days_max != null) {
      const cutoff = now - parseInt(last_order_days_max) * 86400000;
      contacts = contacts.filter((c: any) => c.last_order_date && new Date(c.last_order_date).getTime() <= cutoff);
    }

    // Format output
    const formatted = contacts.map((c: any) => ({
      email: c.email,
      first_name: c.first_name || "",
      last_name: c.last_name || "",
      orders_count: c.orders_count || 0,
      total_spent: parseFloat(c.total_spent) || 0,
      last_order_date: c.last_order_date || null,
      first_order_date: c.date_created || null,
      billing_country: c.billing_country || "",
      billing_city: c.billing_city || "",
    }));

    if (count_only) {
      return new Response(JSON.stringify({ total: formatted.length, contacts: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ total: formatted.length, contacts: formatted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("campaign-audience error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
