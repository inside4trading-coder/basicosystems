import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE = "https://basicoclothes.com/wp-json/wc/v3";
const EXCLUDED_STATUSES = new Set(["cancelled", "failed", "refunded", "trash"]);

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

function dateRange(period: string): { after: string; before: string } {
  const now = new Date();
  let after: Date;
  switch (period) {
    case "today":
      after = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week": {
      const day = now.getDay() || 7;
      after = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      break;
    }
    case "month":
      after = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      after = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      after = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return { after: after.toISOString(), before: now.toISOString() };
}

function prevDateRange(period: string): { after: string; before: string } {
  const now = new Date();
  let after: Date, before: Date;
  switch (period) {
    case "today":
      before = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      after = new Date(before); after.setDate(after.getDate() - 1);
      break;
    case "week": {
      const day = now.getDay() || 7;
      before = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      after = new Date(before); after.setDate(after.getDate() - 7);
      break;
    }
    case "month":
      before = new Date(now.getFullYear(), now.getMonth(), 1);
      after = new Date(before); after.setMonth(after.getMonth() - 1);
      break;
    case "year":
      before = new Date(now.getFullYear(), 0, 1);
      after = new Date(before); after.setFullYear(after.getFullYear() - 1);
      break;
    default:
      before = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      after = new Date(before); after.setDate(after.getDate() - 1);
  }
  return { after: after.toISOString(), before: before.toISOString() };
}

async function fetchAllOrders(afterDate: string, beforeDate: string) {
  const orders: any[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await wcFetch("/orders", {
      after: afterDate, before: beforeDate,
      per_page: "100", page: String(page), status: "any",
    });
    totalPages = parseInt(res.totalPages) || 1;
    if (Array.isArray(res.body)) orders.push(...res.body);
    page++;
  }
  return orders;
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

    const [currentOrders, prevOrders, lowStockRes] = await Promise.all([
      fetchAllOrders(after, before),
      fetchAllOrders(prev.after, prev.before),
      wcFetch("/products", { per_page: "50", orderby: "date", stock_status: "instock" }),
    ]);

    const isPaid = (o: any) => !EXCLUDED_STATUSES.has(o.status);
    const currentPaid = currentOrders.filter(isPaid);
    const prevPaid = prevOrders.filter(isPaid);

    const revenue = currentPaid.reduce((s: number, o: any) => s + parseFloat(o.total || "0"), 0);
    const prevRevenue = prevPaid.reduce((s: number, o: any) => s + parseFloat(o.total || "0"), 0);
    const totalOrders = currentPaid.length;
    const prevTotalOrders = prevPaid.length;
    const avgTicket = totalOrders > 0 ? revenue / totalOrders : 0;
    const prevAvgTicket = prevTotalOrders > 0 ? prevRevenue / prevTotalOrders : 0;

    const currentEmails = new Set(currentPaid.map((o: any) => o.billing?.email?.toLowerCase()).filter(Boolean));
    const prevEmails = new Set(prevPaid.map((o: any) => o.billing?.email?.toLowerCase()).filter(Boolean));
    const newCustomers = [...currentEmails].filter(e => !prevEmails.has(e)).length;
    const prevNewCustomers = prevEmails.size;

    const pct = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;

    const statusCounts: Record<string, number> = {};
    for (const o of currentOrders) statusCounts[o.status || "unknown"] = (statusCounts[o.status || "unknown"] || 0) + 1;

    const prodMap: Record<number, { name: string; qty: number }> = {};
    for (const o of currentPaid) {
      for (const item of (o.line_items || [])) {
        if (!prodMap[item.product_id]) prodMap[item.product_id] = { name: item.name, qty: 0 };
        prodMap[item.product_id].qty += item.quantity;
      }
    }
    const topProducts = Object.entries(prodMap)
      .map(([id, v]) => ({ name: v.name, product_id: Number(id), quantity: v.qty }))
      .sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    const lowStock = Array.isArray(lowStockRes.body)
      ? lowStockRes.body
          .filter((p: any) => p.manage_stock && p.stock_quantity != null && p.stock_quantity <= 5 && p.stock_quantity > 0)
          .map((p: any) => ({ name: p.name, stock: p.stock_quantity, id: p.id })).slice(0, 5)
      : [];

    const dailyRevenue: Record<string, number> = {};
    for (const o of currentPaid) {
      const day = (o.date_created_gmt || o.date_created || "").split("T")[0];
      if (day) dailyRevenue[day] = (dailyRevenue[day] || 0) + parseFloat(o.total || "0");
    }

    return new Response(JSON.stringify({
      kpis: {
        revenue: { value: revenue, change: pct(revenue, prevRevenue) },
        orders: { value: totalOrders, change: pct(totalOrders, prevTotalOrders) },
        avgTicket: { value: avgTicket, change: pct(avgTicket, prevAvgTicket) },
        newCustomers: { value: newCustomers, change: pct(newCustomers, prevNewCustomers) },
      },
      statuses: statusCounts, topProducts, lowStock, dailyRevenue, period, currency: "USD",
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
