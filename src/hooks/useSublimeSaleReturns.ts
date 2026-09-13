import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PosPaymentMethodId } from "@/lib/posPaymentMethods";

const sb = supabase as any;

/**
 * Operaciones postventa reales de Sublime.
 * Nunca editan ni borran la venta original: todo se registra como
 * devolución/anulación vinculada, con movimientos de inventario y caja propios.
 */

export interface SaleReturnItemRow {
  id: string;
  sale_item_id: string;
  variant_id: string | null;
  sku: string | null;
  title: string;
  qty: number;
  unit_ref: number;
  line_total_ref: number;
  restocked: boolean;
}

export interface SaleRefundRow {
  id: string;
  method: PosPaymentMethodId | string;
  currency: "USD" | "VES";
  amount: number;
  amount_ref: number;
  bank: string | null;
  reference: string | null;
  created_at: string;
}

export interface SaleReturnRow {
  id: string;
  return_number: string;
  sale_id: string;
  kind: "return" | "void" | "exchange";
  reason: string | null;
  units: number;
  total_returned_ref: number;
  total_refund_ref: number;
  exchange_sale_id: string | null;
  cash_session_id: string | null;
  created_at: string;
  items: SaleReturnItemRow[];
  refunds: SaleRefundRow[];
}

const num = (v: unknown) => Number(v ?? 0);

const RETURN_SELECT =
  "*, sublime_sale_return_items(*), sublime_sale_refunds(*)";

const mapReturn = (r: any): SaleReturnRow => ({
  ...r,
  units: num(r.units),
  total_returned_ref: num(r.total_returned_ref),
  total_refund_ref: num(r.total_refund_ref),
  items: (r.sublime_sale_return_items ?? []).map((i: any) => ({
    ...i,
    qty: num(i.qty),
    unit_ref: num(i.unit_ref),
    line_total_ref: num(i.line_total_ref),
  })),
  refunds: (r.sublime_sale_refunds ?? []).map((p: any) => ({
    ...p,
    amount: num(p.amount),
    amount_ref: num(p.amount_ref),
  })),
});

/** Devoluciones, anulaciones y cambios asociados a una venta. */
export function useSaleReturns(saleId: string | null) {
  return useQuery({
    queryKey: ["sublime_sale_returns", saleId],
    enabled: !!saleId,
    queryFn: async (): Promise<SaleReturnRow[]> => {
      const { data, error } = await sb
        .from("sublime_sale_returns")
        .select(RETURN_SELECT)
        .eq("sale_id", saleId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map(mapReturn);
    },
  });
}

/** Sesión de caja abierta en la tienda de la venta (no se inventa ninguna). */
export function useOpenCashSessionAtLocation(locationId: string | null) {
  return useQuery({
    queryKey: ["sublime_open_session_at", locationId],
    enabled: !!locationId,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await sb
        .from("sublime_cash_sessions")
        .select("id, session_number, register_id, status")
        .eq("location_id", locationId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as
        | { id: string; session_number: string; register_id: string; status: string }
        | null;
    },
  });
}

export interface RegisterReturnInput {
  idempotencyKey: string;
  saleId: string;
  kind: "return" | "void";
  items: { sale_item_id: string; qty: number }[];
  reason: string;
  refunds: {
    method: string;
    currency: "USD" | "VES";
    amount: number;
    amount_ref: number;
    bank?: string | null;
    reference?: string | null;
  }[];
  cashSessionId: string | null;
}

export function useRegisterSaleReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterReturnInput) => {
      const { data, error } = await sb.rpc("sublime_register_sale_return", {
        p_idempotency_key: input.idempotencyKey,
        p_sale_id: input.saleId,
        p_kind: input.kind,
        p_items: input.items,
        p_reason: input.reason || null,
        p_refunds: input.refunds,
        p_cash_session_id: input.cashSessionId,
      });
      if (error) throw error;
      return data as {
        return_id: string;
        return_number: string;
        duplicate: boolean;
        sale_status: string;
        units: number;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sublime_sale_returns"] });
      qc.invalidateQueries({ queryKey: ["sublime_sales_history"] });
      qc.invalidateQueries({ queryKey: ["sublime_sale_by_number"] });
      qc.invalidateQueries({ queryKey: ["sublime_pos_catalog"] });
      qc.invalidateQueries({ queryKey: ["sublime_inv_all"] });
      qc.invalidateQueries({ queryKey: ["sublime_inv_movements"] });
      qc.invalidateQueries({ queryKey: ["sublime_cash_movements"] });
      qc.invalidateQueries({ queryKey: ["sublime_cash_summary"] });
    },
  });
}

/** Enlaza la nueva venta de un cambio con su devolución de origen. */
export function useLinkExchangeSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { returnId: string; newSaleId: string }) => {
      const { data, error } = await sb.rpc("sublime_link_exchange_sale", {
        p_return_id: p.returnId,
        p_new_sale_id: p.newSaleId,
      });
      if (error) throw error;
      return data as { return_id: string; exchange_sale_id: string; duplicate: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sublime_sale_returns"] });
      qc.invalidateQueries({ queryKey: ["sublime_sales_history"] });
    },
  });
}

export const saleStatusLabel = (s: string) =>
  s === "completed"
    ? "Completada"
    : s === "partially_returned"
      ? "Devuelta parcialmente"
      : s === "returned"
        ? "Devuelta"
        : s === "voided" || s === "anulada"
          ? "Anulada"
          : s;
