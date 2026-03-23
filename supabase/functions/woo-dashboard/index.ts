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
  const headers: Record<string, string> = {};
  headers.total = res.headers.get("X-WP-Total") || "0";
  headers.totalPages = res.headers.get("X-WP-TotalPages") || "0";
  const body = await res.json();
  return { body, headers };
}

function dateRange(period: string): { after: string; before: string } {
  const now = new Date();
  let after: Date;

  switch (period) {
    case "today": {
      after = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    }
    case "week": {
      const day = now.getDay() || 7;
      after = new Date(now);
      after.setDate(now.getDate() - day + 1);
      after.setHours(0, 0, 0, 0);
      break;
    }
    case "month": {
      after = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    case "year": {
      after = new Date(now.getFullYear(), 0, 1);
      break;
    }
    default:
      after = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return {
    after: after.toISOString(),
    before: now.toISOString(),
  };
}

function prevDateRange(period: string): { after: string; before: string } {
  const now = new Date();
  let after: Date, before: Date;

  switch (period) {
    case "today": {
      before = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      after = new Date(before);
      after.setDate(after.getDate() - 1);
      break;
    }
    case "week": {
      const day = now.getDay() || 7;
      before = new Date(now);
      before.setDate(now.getDate() - day + 1);
      before.setHours(0, 0, 0, 0);
      after = new Date(before);
      after.setDate(after.getDate() - 7);
      break;
    }
    case "month": {
      before = new Date(now.getFullYear(), now.getMonth(), 1);
      after = new Date(before);
      after.setMonth(after.getMonth() - 1);
      break;
    }
    case "year": {
      before = new Date(now.getFullYear(), 0, 1);
      after = new Date(before);
      after.setFullYear(after.getFullYear() - 1);
      break;
    }
    default: {
      before = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      after = new Date(before);
      after.setDate(after.getDate() - 1);
    }
  }

  return { after: after.toISOString(), before: before.toISOString() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "today";
    const { after, before } = dateRange(period);
    const prev = prevDateRange(period);

    // Fetch current period orders (all pages to get accurate totals)
    // WooCommerce max per_page is 100
    const fetchAllOrders = async (afterDate: string, beforeDate: string) => {
      const orders: any[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const res = await wcFetch("/orders", {
          after: afterDate,
          before: beforeDate,
          per_page: "100",
          page: String(page),
          status: "any",
        });
        totalPages = parseInt(res.headers.totalPages) || 1;
        if (Array.isArray(res.body)) orders.push(...res.body);
        page++;
      }
      return orders;
    };

    // Fetch current and previous period orders in parallel
    const [currentOrders, prevOrders, topProductsRes, lowStockRes] = await Promise.all([
      fetchAllOrders(after, before),
      fetchAllOrders(prev.after, prev.before),
      wcFetch("/reports/top_sellers", { period: "month", date_min: after.split("T")[0] }),
      wcFetch("/products", { per_page: "50", orderby: "date", stock_status: "instock" }),
    ]);

    // Compute KPIs from current period
    const paidStatuses = ["processing", "completed", "on-hold"];
    const currentPaid = currentOrders.filter((o: any) => paidStatuses.includes(o.status));
    const prevPaid = prevOrders.filter((o: any) => paidStatuses.includes(o.status));

    const revenue = currentPaid.reduce((sum: number, o: any) => sum + parseFloat(o.total || "0"), 0);
    const prevRevenue = prevPaid.reduce((sum: number, o: any) => sum + parseFloat(o.total || "0"), 0);

    const totalOrders = currentPaid.length;
    const prevTotalOrders = prevPaid.length;

    const avgTicket = totalOrders > 0 ? revenue / totalOrders : 0;
    const prevAvgTicket = prevTotalOrders > 0 ? prevRevenue / prevTotalOrders : 0;

    // New customers: unique billing emails in current period not in previous
    const currentEmails = new Set(currentPaid.map((o: any) => o.billing?.email).filter(Boolean));
    const prevEmails = new Set(prevPaid.map((o: any) => o.billing?.email).filter(Boolean));
    const newCustomers = [...currentEmails].filter(e => !prevEmails.has(e)).length;
    const prevNewCustomersCount = prevEmails.size; // approximate

    const pctChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    // Order statuses for current period
    const statusCounts: Record<string, number> = {};
    for (const o of currentOrders) {
      const s = o.status || "unknown";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    // Top products — use report if available, otherwise aggregate from line items
    let topProducts: { name: string; product_id: number; quantity: number }[] = [];
    if (Array.isArray(topProductsRes.body) && topProductsRes.body.length > 0) {
      topProducts = topProductsRes.body.slice(0, 5).map((p: any) => ({
        name: p.name || `Product #${p.product_id}`,
        product_id: p.product_id,
        quantity: p.quantity,
      }));
    } else {
      // Aggregate from order line items
      const prodMap: Record<number, { name: string; qty: number }> = {};
      for (const o of currentPaid) {
        for (const item of (o.line_items || [])) {
          const pid = item.product_id;
          if (!prodMap[pid]) prodMap[pid] = { name: item.name, qty: 0 };
          prodMap[pid].qty += item.quantity;
        }
      }
      topProducts = Object.entries(prodMap)
        .map(([id, v]) => ({ name: v.name, product_id: Number(id), quantity: v.qty }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
    }

    // Low stock products
    const lowStock = Array.isArray(lowStockRes.body)
      ? lowStockRes.body
          .filter((p: any) => p.manage_stock && p.stock_quantity !== null && p.stock_quantity <= 5 && p.stock_quantity > 0)
          .map((p: any) => ({ name: p.name, stock: p.stock_quantity, id: p.id }))
          .slice(0, 5)
      : [];

    // Daily revenue breakdown for chart (last 7 or 30 days depending on period)
    const dailyRevenue: Record<string, number> = {};
    for (const o of currentPaid) {
      const day = (o.date_created || "").split("T")[0];
      if (day) dailyRevenue[day] = (dailyRevenue[day] || 0) + parseFloat(o.total || "0");
    }

    const result = {
      kpis: {
        revenue: { value: revenue, change: pctChange(revenue, prevRevenue) },
        orders: { value: totalOrders, change: pctChange(totalOrders, prevTotalOrders) },
        avgTicket: { value: avgTicket, change: pctChange(avgTicket, prevAvgTicket) },
        newCustomers: { value: newCustomers, change: pctChange(newCustomers, prevNewCustomersCount) },
      },
      statuses: statusCounts,
      topProducts,
      lowStock,
      dailyRevenue,
      period,
      dateRange: { after, before },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
