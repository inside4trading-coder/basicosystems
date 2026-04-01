import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Period = "today" | "week" | "month" | "year" | "custom";

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
  ordersByPayment: { method: string; count: number }[];
  hourlyDistribution: { hour: number; count: number }[];
  categoryBreakdown: { category: string; revenue: number; quantity: number }[];
}

function getDateRange(period: Period, customRange?: { start: Date; end: Date }): { start: Date; end: Date } {
  if (period === "custom" && customRange) {
    return { start: customRange.start, end: customRange.end };
  }
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
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return { start, end: now };
}

function getPrevDateRange(period: Period, customRange?: { start: Date; end: Date }): { start: Date; end: Date } {
  const { start, end } = getDateRange(period, customRange);
  const diff = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - diff), end: start };
}

const EXCLUDED = new Set(["cancelled", "failed", "refunded", "trash"]);

export function useDashboardData(period: Period, customRange?: { start: Date; end: Date }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRange(period, customRange);
      const prev = getPrevDateRange(period, customRange);

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
      const paid = all.filter(o => !EXCLUDED.has(o.order_status || "") && (o.total_amount_usd ?? o.total_amount ?? 0) > 0);
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

      // Build currency map (used by payments and products)
      const orderCurrencyMap = new Map<number, { rate: number; currency: string }>();
      for (const o of paid) {
        orderCurrencyMap.set(o.order_id, { 
          rate: o.exchange_rate || 1, 
          currency: o.order_currency || "USD" 
        });
      }

      // Revenue by payment — use payments table for accuracy
      const paidOrderIds = paid.map(o => o.order_id);
      let paymentRows: any[] = [];
      if (paidOrderIds.length > 0) {
        for (let i = 0; i < paidOrderIds.length; i += 200) {
          const chunk = paidOrderIds.slice(i, i + 200);
          const { data: pData } = await supabase
            .from("payments")
            .select("order_id, payment_method, payment_amount, payment_currency")
            .in("order_id", chunk);
          if (pData) paymentRows.push(...pData);
        }
      }
      // Count orders per payment method
      const payCountMap: Record<string, Set<number>> = {};
      for (const p of paymentRows) {
        const m = p.payment_method || "Otro";
        if (!payCountMap[m]) payCountMap[m] = new Set();
        payCountMap[m].add(p.order_id);
      }
      // Fallback: if no payments rows, use orders table
      if (paymentRows.length === 0) {
        for (const o of paid) {
          const m = o.payment_method || "Otro";
          if (!payCountMap[m]) payCountMap[m] = new Set();
          payCountMap[m].add(o.order_id);
        }
      }
      const ordersByPayment = Object.entries(payCountMap)
        .map(([method, ids]) => ({ method, count: ids.size }))
        .sort((a, b) => b.count - a.count);

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

      // Top products from items (with revenue in USD)
      const prodMap: Record<string, { name: string; qty: number; rev: number }> = {};
      for (const item of items) {
        if (!paidIds.has(item.order_id)) continue;
        const key = item.product_name || item.sku || "unknown";
        if (!prodMap[key]) prodMap[key] = { name: key, qty: 0, rev: 0 };
        prodMap[key].qty += item.quantity || 0;
        const oc = orderCurrencyMap.get(item.order_id);
        const lineTotal = item.line_total || 0;
        const lineUsd = oc && oc.currency !== "USD" && oc.rate > 1 ? lineTotal / oc.rate : lineTotal;
        prodMap[key].rev += lineUsd;
      }
      const topProducts = Object.values(prodMap)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10)
        .map(p => ({ name: p.name, quantity: p.qty, revenue: Math.round(p.rev * 100) / 100 }));

      // Category breakdown
      const catMap: Record<string, { revenue: number; quantity: number }> = {};
      for (const item of items) {
        if (!paidIds.has(item.order_id)) continue;
        const cat = item.product_category || item.analytic_category || "Sin categoría";
        if (!catMap[cat]) catMap[cat] = { revenue: 0, quantity: 0 };
        const oc = orderCurrencyMap.get(item.order_id);
        const lineTotal = item.line_total || 0;
        const lineUsd = oc && oc.currency !== "USD" && oc.rate > 1 ? lineTotal / oc.rate : lineTotal;
        catMap[cat].revenue += lineUsd;
        catMap[cat].quantity += item.quantity || 0;
      }
      const categoryBreakdown = Object.entries(catMap)
        .map(([category, v]) => ({ category, revenue: Math.round(v.revenue * 100) / 100, quantity: v.quantity }))
        .sort((a, b) => b.revenue - a.revenue);

      setData({
        kpis: {
          revenue: { value: revenue, change: pct(revenue, prevRevenue) },
          orders: { value: totalOrders, change: pct(totalOrders, prevTotalOrders) },
          avgTicket: { value: avgTicket, change: pct(avgTicket, prevAvgTicket) },
          newCustomers: { value: newCustomers, change: pct(newCustomers, prevNewCustomers) },
          productsSold: { value: productsSold, change: pct(productsSold, prevProductsSold) },
        },
        statuses,
        topProducts,
        dailyRevenue,
        dailyOrders,
        revenueByState,
        ordersByPayment,
        hourlyDistribution,
        categoryBreakdown,
      });
    } catch (e: any) {
      setError(e.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [period, customRange?.start?.getTime(), customRange?.end?.getTime()]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
