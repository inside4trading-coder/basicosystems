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

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateRanges(period: string) {
  const now = new Date();
  let currentStart: Date;
  let prevStart: Date;
  let prevEnd: Date;

  switch (period) {
    case "today": {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      prevEnd = new Date(currentStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevStart = new Date(prevEnd);
      break;
    }
    case "week": {
      const day = now.getDay() || 7;
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      prevEnd = new Date(currentStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 6);
      break;
    }
    case "month": {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      prevEnd = new Date(currentStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
      break;
    }
    case "year": {
      currentStart = new Date(now.getFullYear(), 0, 1);
      prevEnd = new Date(currentStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevStart = new Date(prevEnd.getFullYear(), 0, 1);
      break;
    }
    default: {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      prevEnd = new Date(currentStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevStart = new Date(prevEnd);
    }
  }

  return {
    current: { start: formatDate(currentStart), end: formatDate(now) },
    prev: { start: formatDate(prevStart), end: formatDate(prevEnd) },
  };
}

const EXCLUDED_STATUSES = new Set(["cancelled", "failed", "refunded", "trash"]);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "today";
    const ranges = getDateRanges(period);

    // Use WooCommerce Reports API for accurate sales data
    const [currentReport, prevReport] = await Promise.all([
      wcFetch("/reports/sales", { date_min: ranges.current.start, date_max: ranges.current.end }),
      wcFetch("/reports/sales", { date_min: ranges.prev.start, date_max: ranges.prev.end }),
    ]);

    const cur = Array.isArray(currentReport.body) && currentReport.body.length > 0 ? currentReport.body[0] : {};
    const prv = Array.isArray(prevReport.body) && prevReport.body.length > 0 ? prevReport.body[0] : {};

    const revenue = parseFloat(cur.total_sales || "0");
    const prevRevenue = parseFloat(prv.total_sales || "0");
    const totalOrders = parseInt(cur.total_orders || "0");
    const prevTotalOrders = parseInt(prv.total_orders || "0");
    const avgTicket = totalOrders > 0 ? revenue / totalOrders : 0;
    const prevAvgTicket = prevTotalOrders > 0 ? prevRevenue / prevTotalOrders : 0;
    const newCustomers = parseInt(cur.total_customers || "0");
    const prevNewCustomers = parseInt(prv.total_customers || "0");

    const pctChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    // Fetch orders for status breakdown and top products
    const fetchAllOrders = async (dateMin: string, dateMax: string) => {
      const orders: any[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const res = await wcFetch("/orders", {
          after: new Date(dateMin).toISOString(),
          before: new Date(dateMax + "T23:59:59").toISOString(),
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

    const [currentOrders, lowStockRes] = await Promise.all([
      fetchAllOrders(ranges.current.start, ranges.current.end),
      wcFetch("/products", { per_page: "50", orderby: "date", stock_status: "instock" }),
    ]);

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    for (const o of currentOrders) {
      const s = o.status || "unknown";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    // Top products from paid orders
    const paidOrders = currentOrders.filter((o: any) => !EXCLUDED_STATUSES.has(o.status));
    const prodMap: Record<number, { name: string; qty: number }> = {};
    for (const o of paidOrders) {
      for (const item of (o.line_items || [])) {
        const pid = item.product_id;
        if (!prodMap[pid]) prodMap[pid] = { name: item.name, qty: 0 };
        prodMap[pid].qty += item.quantity;
      }
    }
    const topProducts = Object.entries(prodMap)
      .map(([id, v]) => ({ name: v.name, product_id: Number(id), quantity: v.qty }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Low stock
    const lowStock = Array.isArray(lowStockRes.body)
      ? lowStockRes.body
          .filter((p: any) => p.manage_stock && p.stock_quantity !== null && p.stock_quantity <= 5 && p.stock_quantity > 0)
          .map((p: any) => ({ name: p.name, stock: p.stock_quantity, id: p.id }))
          .slice(0, 5)
      : [];

    // Daily revenue from report totals array
    const dailyRevenue: Record<string, number> = {};
    const totals = cur.totals || {};
    for (const [day, info] of Object.entries(totals)) {
      const sales = parseFloat((info as any)?.sales || "0");
      if (sales > 0) dailyRevenue[day] = sales;
    }

    // If no totals breakdown, fallback to order-based daily revenue
    if (Object.keys(dailyRevenue).length === 0) {
      for (const o of paidOrders) {
        const dateStr = o.date_created_gmt || o.date_created || "";
        const day = dateStr.split("T")[0];
        if (day) dailyRevenue[day] = (dailyRevenue[day] || 0) + parseFloat(o.total || "0");
      }
    }

    const result = {
      kpis: {
        revenue: { value: revenue, change: pctChange(revenue, prevRevenue) },
        orders: { value: totalOrders, change: pctChange(totalOrders, prevTotalOrders) },
        avgTicket: { value: avgTicket, change: pctChange(avgTicket, prevAvgTicket) },
        newCustomers: { value: newCustomers, change: pctChange(newCustomers, prevNewCustomers) },
      },
      statuses: statusCounts,
      topProducts,
      lowStock,
      dailyRevenue,
      period,
      currency: "USD",
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
