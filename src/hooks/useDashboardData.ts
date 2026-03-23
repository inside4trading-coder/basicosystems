import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Period = "today" | "week" | "month" | "year";

interface KPI {
  value: number;
  change: number;
}

export interface DashboardData {
  kpis: {
    revenue: KPI;
    orders: KPI;
    avgTicket: KPI;
    newCustomers: KPI;
    productsSold: KPI;
  };
  statuses: Record<string, number>;
  topProducts: { name: string; quantity: number; revenue: number }[];
  dailyRevenue: { date: string; revenue: number }[];
  dailyOrders: { date: string; count: number }[];
  revenueByState: { state: string; revenue: number }[];
  revenueByPayment: { method: string; revenue: number }[];
  hourlyDistribution: { hour: number; count: number }[];
  categoryBreakdown: { category: string; revenue: number; quantity: number }[];
}

function getDateRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week": {
      const day = now.getDay() || 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      break;
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return { start, end: now };
}

function getPrevDateRange(period: Period): { start: Date; end: Date } {
  const { start, end } = getDateRange(period);
  const diff = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - diff), end: start };
}

const EXCLUDED = new Set(["cancelled", "failed", "refunded", "trash"]);

export function useDashboardData(period: Period) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRange(period);
      const prev = getPrevDateRange(period);

      // Fetch current orders
      const { data: currentOrders, error: cErr } = await supabase
        .from("orders")
        .select("*")
        .gte("order_date", start.toISOString().split("T")[0])
        .lte("order_date", end.toISOString().split("T")[0]);
      if (cErr) throw new Error(cErr.message);

      // Fetch previous period orders
      const { data: prevOrders, error: pErr } = await supabase
        .from("orders")
        .select("order_id, total_amount, total_amount_usd, order_status, customer_email")
        .gte("order_date", prev.start.toISOString().split("T")[0])
        .lt("order_date", prev.end.toISOString().split("T")[0]);
      if (pErr) throw new Error(pErr.message);

      // Fetch order items for current period
      const orderIds = (currentOrders || []).map(o => o.order_id);
      let items: any[] = [];
      if (orderIds.length > 0) {
        // Batch fetch in chunks of 200
        for (let i = 0; i < orderIds.length; i += 200) {
          const chunk = orderIds.slice(i, i + 200);
          const { data: itemData } = await supabase
            .from("order_items")
            .select("*")
            .in("order_id", chunk);
          if (itemData) items.push(...itemData);
        }
      }

      const all = currentOrders || [];
      const paid = all.filter(o => !EXCLUDED.has(o.order_status || ""));
      const prevPaid = (prevOrders || []).filter(o => !EXCLUDED.has(o.order_status || ""));

      const getUsd = (o: any) => o.total_amount_usd ?? o.total_amount ?? 0;
      const revenue = paid.reduce((s, o) => s + getUsd(o), 0);
      const prevRevenue = prevPaid.reduce((s, o) => s + getUsd(o), 0);
      const totalOrders = paid.length;
      const prevTotalOrders = prevPaid.length;
      const avgTicket = totalOrders > 0 ? revenue / totalOrders : 0;
      const prevAvgTicket = prevTotalOrders > 0 ? prevRevenue / prevTotalOrders : 0;

      // Products sold
      const paidIds = new Set(paid.map(o => o.order_id));
      const prevPaidIds = new Set(prevPaid.map(o => o.order_id));
      const productsSold = items.filter(i => paidIds.has(i.order_id)).reduce((s, i) => s + (i.quantity || 0), 0);
      // For prev products sold we don't fetch prev items, so use estimate
      const prevProductsSold = 0;

      const pct = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;

      const curEmails = new Set(paid.map(o => o.customer_email?.toLowerCase()).filter(Boolean));
      const prevEmails = new Set(prevPaid.map(o => o.customer_email?.toLowerCase()).filter(Boolean));
      const newCustomers = [...curEmails].filter(e => !prevEmails.has(e)).length;
      const prevNewCustomers = prevEmails.size;

      // Statuses
      const statuses: Record<string, number> = {};
      for (const o of all) statuses[o.order_status || "unknown"] = (statuses[o.order_status || "unknown"] || 0) + 1;

      // Daily revenue
      const dailyMap: Record<string, number> = {};
      const dailyCountMap: Record<string, number> = {};
      for (const o of paid) {
        const d = o.order_date || "";
        dailyMap[d] = (dailyMap[d] || 0) + getUsd(o);
        dailyCountMap[d] = (dailyCountMap[d] || 0) + 1;
      }
      const dailyRevenue = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))
        .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }));
      const dailyOrders = Object.entries(dailyCountMap).sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      // Revenue by state
      const stateMap: Record<string, number> = {};
      for (const o of paid) {
        const s = o.billing_state || "Sin estado";
        stateMap[s] = (stateMap[s] || 0) + getUsd(o);
      }
      const revenueByState = Object.entries(stateMap)
        .map(([state, revenue]) => ({ state, revenue: Math.round(revenue * 100) / 100 }))
        .sort((a, b) => b.revenue - a.revenue).slice(0, 10);

      // Revenue by payment
      const payMap: Record<string, number> = {};
      for (const o of paid) {
        const m = o.payment_method || "Otro";
        payMap[m] = (payMap[m] || 0) + getUsd(o);
      }
      const revenueByPayment = Object.entries(payMap)
        .map(([method, revenue]) => ({ method, revenue: Math.round(revenue * 100) / 100 }))
        .sort((a, b) => b.revenue - a.revenue);

      // Hourly distribution
      const hourMap: Record<number, number> = {};
      for (const o of paid) {
        if (o.order_datetime) {
          const h = new Date(o.order_datetime).getHours();
          hourMap[h] = (hourMap[h] || 0) + 1;
        }
      }
      const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourMap[i] || 0,
      }));

      // Top products from items
      const prodMap: Record<string, { name: string; qty: number }> = {};
      const paidIds = new Set(paid.map(o => o.order_id));
      for (const item of items) {
        if (!paidIds.has(item.order_id)) continue;
        const key = item.product_name || item.sku || "unknown";
        if (!prodMap[key]) prodMap[key] = { name: key, qty: 0 };
        prodMap[key].qty += item.quantity || 0;
      }
      const topProducts = Object.values(prodMap)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10)
        .map(p => ({ name: p.name, quantity: p.qty }));

      // Category breakdown
      const catMap: Record<string, { revenue: number; quantity: number }> = {};
      for (const item of items) {
        if (!paidIds.has(item.order_id)) continue;
        const cat = item.analytic_category || "Sin categoría";
        if (!catMap[cat]) catMap[cat] = { revenue: 0, quantity: 0 };
        catMap[cat].revenue += item.line_total || 0;
        catMap[cat].quantity += item.quantity || 0;
      }
      const categoryBreakdown = Object.entries(catMap)
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.revenue - a.revenue);

      setData({
        kpis: {
          revenue: { value: revenue, change: pct(revenue, prevRevenue) },
          orders: { value: totalOrders, change: pct(totalOrders, prevTotalOrders) },
          avgTicket: { value: avgTicket, change: pct(avgTicket, prevAvgTicket) },
          newCustomers: { value: newCustomers, change: pct(newCustomers, prevNewCustomers) },
        },
        statuses,
        topProducts,
        dailyRevenue,
        revenueByState,
        revenueByPayment,
        hourlyDistribution,
        categoryBreakdown,
      });
    } catch (e: any) {
      setError(e.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
