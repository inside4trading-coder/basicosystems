import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PosSalesChannelId } from "@/lib/posSalesChannels";
import type { PosPaymentMethodId } from "@/lib/posPaymentMethods";

const sb = supabase as any;

export interface SaleItemRow {
  id: string;
  line_kind: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string | null;
  title: string;
  subtitle: string | null;
  qty: number;
  unit_regular_ref: number;
  unit_final_ref: number;
  discount_ref: number;
  line_total_ref: number;
}

export interface SalePaymentRow {
  id: string;
  method: PosPaymentMethodId;
  currency: "USD" | "VES";
  amount: number;
  amount_ref: number;
  bank: string | null;
  reference: string | null;
}

export interface SaleRow {
  id: string;
  sale_number: string;
  sold_at: string;
  status: string;
  sale_origin: PosSalesChannelId;
  origin_detail: string | null;
  customer_id: string | null;
  customer_name: string | null;
  invoice_number: string | null;
  note: string | null;
  subtotal_regular_ref: number;
  discount_total_ref: number;
  total_ref: number;
  bcv_rate: number;
  units: number;
  register_code: string | null;
  cashier_code: string | null;
  session_code: string | null;
  cash_session_id: string | null;
  location_id: string | null;
  /** Número real de la sesión persistente; null en ventas anteriores al sistema de sesiones. */
  session_number: string | null;
  session_status: string | null;
  items: SaleItemRow[];
  payments: SalePaymentRow[];
}

const num = (v: unknown) => Number(v ?? 0);

/** Historial real de ventas Sublime con sus líneas, pagos y sesión de caja. */
export function useSublimeSalesHistory() {
  return useQuery({
    queryKey: ["sublime_sales_history"],
    queryFn: async (): Promise<SaleRow[]> => {
      const { data, error } = await sb
        .from("sublime_sales")
        .select(
          "*, sublime_sale_items(*), sublime_sale_payments(*), sublime_cash_sessions(session_number, status)"
        )
        .order("sold_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        ...s,
        subtotal_regular_ref: num(s.subtotal_regular_ref),
        discount_total_ref: num(s.discount_total_ref),
        total_ref: num(s.total_ref),
        bcv_rate: num(s.bcv_rate),
        units: num(s.units),
        session_number: s.sublime_cash_sessions?.session_number ?? null,
        session_status: s.sublime_cash_sessions?.status ?? null,
        items: (s.sublime_sale_items ?? []).map((i: any) => ({
          ...i,
          qty: num(i.qty),
          unit_regular_ref: num(i.unit_regular_ref),
          unit_final_ref: num(i.unit_final_ref),
          discount_ref: num(i.discount_ref),
          line_total_ref: num(i.line_total_ref),
        })),
        payments: (s.sublime_sale_payments ?? []).map((p: any) => ({
          ...p,
          amount: num(p.amount),
          amount_ref: num(p.amount_ref),
        })),
      }));
    },
  });
}

/** Movimientos de inventario generados por una venta (trazabilidad, solo lectura). */
export function useSaleInventoryMovements(saleNumber: string | null) {
  return useQuery({
    queryKey: ["sublime_sale_movements", saleNumber],
    enabled: !!saleNumber,
    queryFn: async () => {
      const { data, error } = await sb
        .from("sublime_inventory_movements")
        .select("id, movement_type, qty_delta, qty_result, note, created_at")
        .eq("movement_type", "pos_sale")
        .ilike("note", `%${saleNumber}%`)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export interface CustomerRow {
  id: string;
  name: string;
  id_card: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

/** Fichas reales de clientes Sublime — única fuente, compartida con el POS. */
export function useSublimeCustomers() {
  return useQuery({
    queryKey: ["sublime_pos_customers"],
    queryFn: async (): Promise<CustomerRow[]> => {
      const { data, error } = await sb
        .from("sublime_customers")
        .select("*")
        .order("name")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as CustomerRow[];
    },
  });
}

export interface CustomerWithStats extends CustomerRow {
  purchases: number;
  totalRef: number;
  avgTicketRef: number;
  lastPurchaseAt: string | null;
}

/**
 * Estadísticas derivadas de las ventas reales.
 * No se guardan en la ficha: se calculan para evitar totales inconsistentes.
 */
export function useSublimeCustomersWithStats() {
  const customers = useSublimeCustomers();
  const sales = useSublimeSalesHistory();

  const rows = useMemo<CustomerWithStats[]>(() => {
    const byCustomer = new Map<string, SaleRow[]>();
    for (const s of sales.data ?? []) {
      if (!s.customer_id) continue;
      const list = byCustomer.get(s.customer_id) ?? [];
      list.push(s);
      byCustomer.set(s.customer_id, list);
    }
    return (customers.data ?? []).map((c) => {
      const list = byCustomer.get(c.id) ?? [];
      const totalRef = list.reduce((a, s) => a + s.total_ref, 0);
      return {
        ...c,
        purchases: list.length,
        totalRef,
        avgTicketRef: list.length ? totalRef / list.length : 0,
        lastPurchaseAt:
          list.length > 0
            ? list.map((s) => s.sold_at).sort().slice(-1)[0]
            : null,
      };
    });
  }, [customers.data, sales.data]);

  return {
    rows,
    isLoading: customers.isLoading || sales.isLoading,
    sales: sales.data ?? [],
  };
}

const norm = (v?: string | null) => (v ?? "").replace(/[\s.-]/g, "").toLowerCase();

/** Coincidencias razonables por teléfono, correo o documento. Nunca fusiona. */
export function findCustomerDuplicates(
  candidate: { phone?: string; email?: string; idCard?: string },
  customers: CustomerRow[]
) {
  const phone = norm(candidate.phone);
  const email = norm(candidate.email);
  const idCard = norm(candidate.idCard);
  if (!phone && !email && !idCard) return [];
  return customers.filter(
    (c) =>
      (phone && norm(c.phone) === phone) ||
      (email && norm(c.email) === email) ||
      (idCard && norm(c.id_card) === idCard)
  );
}

export function useCreateSublimeCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      idCard?: string;
      phone?: string;
      email?: string;
      birthDate?: string;
      address?: string;
      notes?: string;
    }) => {
      const { data, error } = await sb
        .from("sublime_customers")
        .insert({
          name: input.name.trim(),
          id_card: input.idCard?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          birth_date: input.birthDate?.trim() || null,
          address: input.address?.trim() || null,
          notes: input.notes?.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as CustomerRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sublime_pos_customers"] }),
  });
}
