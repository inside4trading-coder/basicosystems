import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type SuspendedCartStatus = "open" | "recovered" | "cancelled" | "converted_to_sale";

export const SUSPENDED_STATUS_LABEL: Record<SuspendedCartStatus, string> = {
  open: "Suspendido",
  recovered: "Recuperado",
  cancelled: "Cancelado",
  converted_to_sale: "Convertido en venta",
};

export interface SuspendedCartItem {
  id: string;
  line_kind: "catalog" | "manual";
  product_id: string | null;
  variant_id: string | null;
  sku: string | null;
  title: string;
  subtitle: string | null;
  qty: number;
  unit_regular_ref: number;
  unit_final_ref: number;
  line_total_ref: number;
}

export interface SuspendedCart {
  id: string;
  cart_number: string;
  register_code: string | null;
  origin_session_code: string | null;
  cashier_code: string | null;
  customer_id: string | null;
  customer_name: string | null;
  sale_origin: string | null;
  origin_detail: string | null;
  note: string | null;
  cart_discount_ref: number;
  cart_discount_reason: string | null;
  units: number;
  total_ref: number;
  status: SuspendedCartStatus;
  sale_id: string | null;
  suspended_at: string;
  items: SuspendedCartItem[];
}

/** Carritos suspendidos REALES: viven en el servidor, no en la pantalla. */
export function useSublimeSuspendedCarts() {
  return useQuery({
    queryKey: ["sublime_suspended_carts"],
    queryFn: async (): Promise<SuspendedCart[]> => {
      const { data, error } = await sb
        .from("sublime_suspended_carts")
        .select("*")
        .order("suspended_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const carts = (data ?? []) as any[];
      if (!carts.length) return [];

      const { data: items, error: itemsErr } = await sb
        .from("sublime_suspended_cart_items")
        .select("*")
        .in("cart_id", carts.map((c) => c.id));
      if (itemsErr) throw itemsErr;

      const byCart = new Map<string, SuspendedCartItem[]>();
      for (const it of (items ?? []) as any[]) {
        const list = byCart.get(it.cart_id) ?? [];
        list.push({
          id: it.id,
          line_kind: it.line_kind === "manual" ? "manual" : "catalog",
          product_id: it.product_id,
          variant_id: it.variant_id,
          sku: it.sku,
          title: it.title,
          subtitle: it.subtitle,
          qty: Number(it.qty ?? 0),
          unit_regular_ref: Number(it.unit_regular_ref ?? 0),
          unit_final_ref: Number(it.unit_final_ref ?? 0),
          line_total_ref: Number(it.line_total_ref ?? 0),
        });
        byCart.set(it.cart_id, list);
      }

      return carts.map((c) => ({
        ...c,
        cart_discount_ref: Number(c.cart_discount_ref ?? 0),
        units: Number(c.units ?? 0),
        total_ref: Number(c.total_ref ?? 0),
        items: byCart.get(c.id) ?? [],
      })) as SuspendedCart[];
    },
  });
}

export interface SuspendCartInput {
  idempotencyKey: string;
  items: Array<{
    line_kind: "catalog" | "manual";
    product_id: string | null;
    variant_id: string | null;
    sku: string | null;
    title: string;
    subtitle: string | null;
    qty: number;
    unit_regular_ref: number;
    unit_final_ref: number;
    line_total_ref: number;
  }>;
  locationId: string | null;
  registerId: string | null;
  registerCode: string | null;
  cashSessionId: string | null;
  sessionCode: string | null;
  cashierCode: string | null;
  customer: { id?: string; name: string } | null;
  saleOrigin: string | null;
  originDetail: string | null;
  note: string | null;
  cartDiscountRef: number;
  cartDiscountReason: string | null;
}

export function useSuspendCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SuspendCartInput) => {
      const { data, error } = await sb.rpc("sublime_suspend_cart", {
        p_idempotency_key: input.idempotencyKey,
        p_items: input.items,
        p_location_id: input.locationId,
        p_register_id: input.registerId,
        p_register_code: input.registerCode,
        p_cash_session_id: input.cashSessionId,
        p_session_code: input.sessionCode,
        p_cashier_code: input.cashierCode,
        p_customer: input.customer,
        p_sale_origin: input.saleOrigin,
        p_origin_detail: input.originDetail,
        p_note: input.note,
        p_cart_discount_ref: input.cartDiscountRef,
        p_cart_discount_reason: input.cartDiscountReason,
      });
      if (error) throw error;
      return data as { cart_id: string; cart_number: string; duplicate: boolean };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sublime_suspended_carts"] }),
  });
}

export function useSetSuspendedCartStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      cartId: string;
      status: Exclude<SuspendedCartStatus, "open">;
      saleId?: string | null;
    }) => {
      const { data, error } = await sb.rpc("sublime_set_suspended_cart_status", {
        p_cart_id: input.cartId,
        p_status: input.status,
        p_sale_id: input.saleId ?? null,
      });
      if (error) throw error;
      return data as { cart_id: string; status: string; changed: boolean };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sublime_suspended_carts"] }),
  });
}
