import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PosSalesChannelId } from "@/lib/posSalesChannels";
import type { PosPaymentMethodId } from "@/lib/posPaymentMethods";

const sb = supabase as any;
const num = (v: unknown) => Number(v ?? 0);

/**
 * Cierres reales: no persisten nada nuevo.
 * Todo se calcula desde ventas, pagos, devoluciones/reembolsos y sesiones de caja
 * ya registrados por el POS. Un día pasado se reconstruye igual aunque cambien
 * productos, precios o stock después.
 */

export interface ClosureSale {
  id: string;
  sale_number: string;
  sold_at: string;
  status: string;
  sale_origin: PosSalesChannelId;
  origin_detail: string | null;
  customer_name: string | null;
  cashier_code: string | null;
  register_code: string | null;
  cash_session_id: string | null;
  subtotal_regular_ref: number;
  discount_total_ref: number;
  total_ref: number;
  units: number;
  payments: {
    id: string;
    method: PosPaymentMethodId | string;
    currency: "USD" | "VES";
    amount: number;
    amount_ref: number;
  }[];
}

export interface ClosureReturn {
  id: string;
  return_number: string;
  sale_id: string;
  kind: "return" | "void" | "exchange";
  created_at: string;
  units: number;
  total_refund_ref: number;
  cash_session_id: string | null;
  sale_number: string | null;
  refunds: {
    id: string;
    method: PosPaymentMethodId | string;
    currency: "USD" | "VES";
    amount: number;
    amount_ref: number;
    cash_session_id: string | null;
  }[];
}

export interface ClosureSession {
  id: string;
  session_number: string;
  status: "open" | "closed";
  register_id: string;
  register_name: string | null;
  cashier_name: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_ref: number;
  opening_bs: number;
  expected_ref: number | null;
  expected_bs: number | null;
  counted_ref: number | null;
  counted_bs: number | null;
  difference_ref: number | null;
  difference_bs: number | null;
}

export interface PosLocation {
  id: string;
  name: string;
  code: string | null;
}

/** Sedes que venden en POS (fuente del cierre). */
export function usePosLocations() {
  return useQuery({
    queryKey: ["sublime_pos_locations"],
    queryFn: async (): Promise<PosLocation[]> => {
      const { data, error } = await sb
        .from("sublime_locations")
        .select("id, name, code")
        .eq("is_active", true)
        .eq("sells_in_pos", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

const dayRange = (date: string) => {
  const from = new Date(`${date}T00:00:00`);
  const to = new Date(`${date}T23:59:59.999`);
  return { from: from.toISOString(), to: to.toISOString() };
};

export function useClosureData(date: string, locationId: string | null) {
  const { from, to } = dayRange(date);

  const sales = useQuery({
    queryKey: ["sublime_closure_sales", date, locationId],
    enabled: !!locationId,
    queryFn: async (): Promise<ClosureSale[]> => {
      const { data, error } = await sb
        .from("sublime_sales")
        .select("*, sublime_sale_payments(*)")
        .eq("location_id", locationId)
        .gte("sold_at", from)
        .lte("sold_at", to)
        .order("sold_at");
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        ...s,
        subtotal_regular_ref: num(s.subtotal_regular_ref),
        discount_total_ref: num(s.discount_total_ref),
        total_ref: num(s.total_ref),
        units: num(s.units),
        payments: (s.sublime_sale_payments ?? []).map((p: any) => ({
          ...p,
          amount: num(p.amount),
          amount_ref: num(p.amount_ref),
        })),
      }));
    },
  });

  const returns = useQuery({
    queryKey: ["sublime_closure_returns", date, locationId],
    enabled: !!locationId,
    queryFn: async (): Promise<ClosureReturn[]> => {
      const { data, error } = await sb
        .from("sublime_sale_returns")
        .select("*, sublime_sale_refunds(*), sale:sublime_sales!sublime_sale_returns_sale_id_fkey(sale_number)")
        .eq("location_id", locationId)
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        units: num(r.units),
        total_refund_ref: num(r.total_refund_ref),
        sale_number: r.sale?.sale_number ?? null,
        refunds: (r.sublime_sale_refunds ?? []).map((f: any) => ({
          ...f,
          amount: num(f.amount),
          amount_ref: num(f.amount_ref),
        })),
      }));
    },
  });

  const sessions = useQuery({
    queryKey: ["sublime_closure_sessions", date, locationId],
    enabled: !!locationId,
    queryFn: async (): Promise<ClosureSession[]> => {
      const { data, error } = await sb
        .from("sublime_cash_sessions")
        .select("*, sublime_registers(name)")
        .eq("location_id", locationId)
        .gte("opened_at", from)
        .lte("opened_at", to)
        .order("opened_at");
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        ...s,
        register_name: s.sublime_registers?.name ?? null,
        opening_ref: num(s.opening_ref),
        opening_bs: num(s.opening_bs),
      }));
    },
  });

  return { sales, returns, sessions };
}

export interface ClosureTotals {
  gross: number;
  discounts: number;
  refunds: number;
  net: number;
  tickets: number;
  avgTicket: number;
  units: number;
  byOrigin: { origin: PosSalesChannelId; sales: number; total: number }[];
  byMethod: {
    method: string;
    currency: "USD" | "VES";
    amount: number;
    amountRef: number;
    refundRef: number;
    netRef: number;
  }[];
}

/** Ventas netas = brutas − descuentos − devoluciones/reembolsos. Las anuladas no suman. */
export function useClosureTotals(sales: ClosureSale[], returns: ClosureReturn[]): ClosureTotals {
  return useMemo(() => {
    const valid = sales.filter((s) => s.status !== "voided");
    const gross = valid.reduce((a, s) => a + s.subtotal_regular_ref, 0);
    const discounts = valid.reduce((a, s) => a + s.discount_total_ref, 0);
    const refunds = returns.reduce((a, r) => a + r.total_refund_ref, 0);
    const tickets = valid.length;
    const net = gross - discounts - refunds;

    const originMap = new Map<string, { sales: number; total: number }>();
    valid.forEach((s) => {
      const e = originMap.get(s.sale_origin) ?? { sales: 0, total: 0 };
      originMap.set(s.sale_origin, { sales: e.sales + 1, total: e.total + s.total_ref });
    });

    const methodMap = new Map<
      string,
      { method: string; currency: "USD" | "VES"; amount: number; amountRef: number; refundRef: number }
    >();
    const bucket = (method: string, currency: "USD" | "VES") => {
      const key = `${method}|${currency}`;
      let e = methodMap.get(key);
      if (!e) {
        e = { method, currency, amount: 0, amountRef: 0, refundRef: 0 };
        methodMap.set(key, e);
      }
      return e;
    };
    valid.forEach((s) =>
      s.payments.forEach((p) => {
        const e = bucket(p.method, p.currency);
        e.amount += p.amount;
        e.amountRef += p.amount_ref;
      })
    );
    returns.forEach((r) =>
      r.refunds.forEach((f) => {
        bucket(f.method, f.currency).refundRef += f.amount_ref;
      })
    );

    return {
      gross,
      discounts,
      refunds,
      net,
      tickets,
      avgTicket: tickets ? net / tickets : 0,
      units: valid.reduce((a, s) => a + s.units, 0),
      byOrigin: Array.from(originMap.entries())
        .map(([origin, v]) => ({ origin: origin as PosSalesChannelId, ...v }))
        .sort((a, b) => b.total - a.total),
      byMethod: Array.from(methodMap.values())
        .map((m) => ({ ...m, netRef: m.amountRef - m.refundRef }))
        .sort((a, b) => b.netRef - a.netRef),
    };
  }, [sales, returns]);
}
