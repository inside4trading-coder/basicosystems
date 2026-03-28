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

    // Build WHERE clauses
    const whereClauses: string[] = [
      "customer_email IS NOT NULL",
      "customer_email != ''",
    ];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (country) {
      whereClauses.push(`billing_country = $${paramIdx}`);
      params.push(country);
      paramIdx++;
    }

    if (city) {
      whereClauses.push(`billing_city ILIKE $${paramIdx}`);
      params.push(`%${city}%`);
      paramIdx++;
    }

    if (exclude_emails && Array.isArray(exclude_emails) && exclude_emails.length > 0) {
      const placeholders = exclude_emails.map((_, i) => `$${paramIdx + i}`).join(", ");
      whereClauses.push(`customer_email NOT IN (${placeholders})`);
      params.push(...exclude_emails);
      paramIdx += exclude_emails.length;
    }

    // Build HAVING clauses
    const havingClauses: string[] = [];

    if (min_orders != null) {
      havingClauses.push(`COUNT(*) >= $${paramIdx}`);
      params.push(min_orders);
      paramIdx++;
    }
    if (max_orders != null) {
      havingClauses.push(`COUNT(*) <= $${paramIdx}`);
      params.push(max_orders);
      paramIdx++;
    }
    if (min_spent != null) {
      havingClauses.push(`COALESCE(SUM(total_amount_usd), 0) >= $${paramIdx}`);
      params.push(min_spent);
      paramIdx++;
    }
    if (max_spent != null) {
      havingClauses.push(`COALESCE(SUM(total_amount_usd), 0) <= $${paramIdx}`);
      params.push(max_spent);
      paramIdx++;
    }
    if (last_order_days_min != null) {
      havingClauses.push(`MAX(order_datetime) >= NOW() - INTERVAL '${parseInt(last_order_days_min)} days'`);
    }
    if (last_order_days_max != null) {
      havingClauses.push(`MAX(order_datetime) <= NOW() - INTERVAL '${parseInt(last_order_days_max)} days'`);
    }

    const whereSQL = whereClauses.join(" AND ");
    const havingSQL = havingClauses.length > 0 ? `HAVING ${havingClauses.join(" AND ")}` : "";

    if (count_only) {
      // For count_only, wrap in a subquery to count
      const countSQL = `
        SELECT COUNT(*) as total FROM (
          SELECT customer_email
          FROM orders
          WHERE ${whereSQL}
          GROUP BY customer_email
          ${havingSQL}
        ) sub
      `;
      const { data, error } = await supabase.rpc("execute_raw_query", {
        query_text: countSQL,
        query_params: params,
      });

      // Fallback: use raw pg if rpc not available
      if (error) {
        // Use a simpler approach with the Supabase client
        const fullSQL = `
          SELECT 
            customer_email AS email,
            COUNT(*) AS orders_count,
            COALESCE(SUM(total_amount_usd), 0) AS total_spent,
            MAX(order_datetime) AS last_order_date,
            MIN(order_datetime) AS first_order_date
          FROM orders
          WHERE ${whereSQL}
          GROUP BY customer_email
          ${havingSQL}
        `;
        
        // Since we can't use raw SQL easily, let's use the REST API approach
        // We'll build the query using Supabase client filters
        const result = await queryWithClient(supabase, body);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ total: data?.[0]?.total || 0, contacts: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Full query - use client-based approach
    const result = await queryWithClient(supabase, body);
    return new Response(JSON.stringify(result), {
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

async function queryWithClient(supabase: any, filters: any) {
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
  } = filters;

  // Fetch all orders with relevant fields
  // We need to paginate since there could be many
  let allOrders: any[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    let query = supabase
      .from("orders")
      .select("customer_email, billing_name, billing_country, billing_city, order_datetime, total_amount_usd")
      .not("customer_email", "is", null)
      .neq("customer_email", "")
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
    allOrders = allOrders.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Filter out excluded emails
  if (exclude_emails && Array.isArray(exclude_emails) && exclude_emails.length > 0) {
    const excludeSet = new Set(exclude_emails.map((e: string) => e.toLowerCase()));
    allOrders = allOrders.filter((o: any) => !excludeSet.has(o.customer_email?.toLowerCase()));
  }

  // Group by email
  const grouped = new Map<string, {
    email: string;
    billing_name: string;
    orders_count: number;
    total_spent: number;
    last_order_date: string;
    first_order_date: string;
    billing_country: string;
    billing_city: string;
  }>();

  for (const order of allOrders) {
    const email = order.customer_email?.toLowerCase();
    if (!email) continue;

    const existing = grouped.get(email);
    const amount = parseFloat(order.total_amount_usd) || 0;
    const orderDate = order.order_datetime || "";

    if (existing) {
      existing.orders_count++;
      existing.total_spent += amount;
      if (orderDate > existing.last_order_date) {
        existing.last_order_date = orderDate;
        existing.billing_name = order.billing_name || existing.billing_name;
        existing.billing_country = order.billing_country || existing.billing_country;
        existing.billing_city = order.billing_city || existing.billing_city;
      }
      if (orderDate < existing.first_order_date) {
        existing.first_order_date = orderDate;
      }
    } else {
      grouped.set(email, {
        email,
        billing_name: order.billing_name || "",
        orders_count: 1,
        total_spent: amount,
        last_order_date: orderDate,
        first_order_date: orderDate,
        billing_country: order.billing_country || "",
        billing_city: order.billing_city || "",
      });
    }
  }

  // Apply HAVING-like filters
  let contacts = Array.from(grouped.values());

  if (min_orders != null) {
    contacts = contacts.filter((c) => c.orders_count >= min_orders);
  }
  if (max_orders != null) {
    contacts = contacts.filter((c) => c.orders_count <= max_orders);
  }
  if (min_spent != null) {
    contacts = contacts.filter((c) => c.total_spent >= min_spent);
  }
  if (max_spent != null) {
    contacts = contacts.filter((c) => c.total_spent <= max_spent);
  }

  const now = Date.now();
  if (last_order_days_min != null) {
    const cutoff = now - parseInt(last_order_days_min) * 86400000;
    contacts = contacts.filter((c) => new Date(c.last_order_date).getTime() >= cutoff);
  }
  if (last_order_days_max != null) {
    const cutoff = now - parseInt(last_order_days_max) * 86400000;
    contacts = contacts.filter((c) => new Date(c.last_order_date).getTime() <= cutoff);
  }

  // Format output
  const formatted = contacts.map((c) => {
    const parts = (c.billing_name || "").trim().split(/\s+/);
    const first_name = parts[0] || "";
    const last_name = parts.slice(1).join(" ") || "";
    return {
      email: c.email,
      first_name,
      last_name,
      orders_count: c.orders_count,
      total_spent: Math.round(c.total_spent * 100) / 100,
      last_order_date: c.last_order_date,
      first_order_date: c.first_order_date,
      billing_country: c.billing_country,
      billing_city: c.billing_city,
    };
  });

  if (count_only) {
    return { total: formatted.length, contacts: [] };
  }

  return { total: formatted.length, contacts: formatted };
}
