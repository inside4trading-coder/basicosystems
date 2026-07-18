import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PendingExternalEvent {
  id: string;
  action: string;
  status: string;
  core_product_id: string | null;
  core_variant_id: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  quantity: number | null;
  unit_cost: number | null;
  external_supplier_name: string | null;
  external_supplier_unit_cost_usd: number | null;
  policy_id: string | null;
  message: string | null;
  created_at: string;
}

export interface ExternalPurchaseOrder {
  id: string;
  order_number: string;
  supplier_name_snapshot: string;
  status: string;
  payment_status: string;
  currency: string;
  subtotal: number;
  shipping_cost: number;
  other_cost: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  supplier_order_reference: string | null;
  estimated_delivery_date: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  approved_at: string | null;
  ordered_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface ExternalPurchaseOrderLine {
  id: string;
  order_id: string;
  policy_event_id: string | null;
  core_product_id: string | null;
  core_variant_id: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  product_name_snapshot: string | null;
  variant_label_snapshot: string | null;
  sku_snapshot: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  line_subtotal: number;
  status: string;
  notes: string | null;
  cancellation_notes: string | null;
}

export function usePendingExternalEvents() {
  return useQuery({
    queryKey: ["ext-po-pending-events"],
    queryFn: async () => {
      // eventos external_supplier_review sin línea externa
      const { data: events, error } = await supabase
        .from("core_replenishment_policy_events")
        .select("*")
        .eq("action", "external_supplier_review")
        .in("status", ["open", "reviewed"])
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const evs = (events ?? []) as any[];
      if (evs.length === 0) return [] as PendingExternalEvent[];
      const { data: lines } = await supabase
        .from("core_external_purchase_order_lines")
        .select("policy_event_id")
        .in("policy_event_id", evs.map(e => e.id));
      const usedIds = new Set((lines ?? []).map(l => l.policy_event_id));
      return evs.filter(e => !usedIds.has(e.id)) as PendingExternalEvent[];
    },
  });
}

export function useExternalPurchaseOrders(status?: string) {
  return useQuery({
    queryKey: ["ext-po-orders", status ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("core_external_purchase_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ExternalPurchaseOrder[];
    },
  });
}

export function useExternalPurchaseOrderLines(orderId: string | null) {
  return useQuery({
    queryKey: ["ext-po-lines", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_external_purchase_order_lines")
        .select("*")
        .eq("order_id", orderId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ExternalPurchaseOrderLine[];
    },
  });
}

export function useExtPoMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ext-po-orders"] });
    qc.invalidateQueries({ queryKey: ["ext-po-lines"] });
    qc.invalidateQueries({ queryKey: ["ext-po-pending-events"] });
    qc.invalidateQueries({ queryKey: ["core-fabrication-funds"] });
    qc.invalidateQueries({ queryKey: ["core-fabrication-fund-movements"] });
    qc.invalidateQueries({ queryKey: ["core_fabrication_funds"] });
    qc.invalidateQueries({ queryKey: ["core_fabrication_fund_movements"] });
  };
  return {
    createFromEvents: useMutation({
      mutationFn: async (args: { event_ids: string[]; overrides: any; dry_run: boolean }) => {
        const { data, error } = await supabase.rpc("core_create_external_purchase_orders_from_events", {
          p_event_ids: args.event_ids,
          p_overrides: args.overrides ?? {},
          p_dry_run: args.dry_run,
        });
        if (error) throw error;
        return data as any;
      },
      onSuccess: (_d, args) => { if (!args.dry_run) invalidate(); },
    }),
    updateDraft: useMutation({
      mutationFn: async (args: { order_id: string; header: any; lines: any[] }) => {
        const { data, error } = await supabase.rpc("core_update_external_purchase_order_draft", {
          p_order_id: args.order_id, p_header: args.header ?? {}, p_lines: args.lines ?? [],
        });
        if (error) throw error;
        return data as any;
      },
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: async (order_id: string) => {
        const { data, error } = await supabase.rpc("core_approve_external_purchase_order", { p_order_id: order_id });
        if (error) throw error; return data;
      },
      onSuccess: invalidate,
    }),
    markOrdered: useMutation({
      mutationFn: async (args: { order_id: string; reference?: string; eta?: string; notes?: string }) => {
        const { data, error } = await supabase.rpc("core_mark_external_purchase_order_ordered", {
          p_order_id: args.order_id,
          p_reference: args.reference ?? null,
          p_eta: args.eta ?? null,
          p_notes: args.notes ?? null,
        });
        if (error) throw error; return data;
      },
      onSuccess: invalidate,
    }),
    receive: useMutation({
      mutationFn: async (args: { order_id: string; lines: { line_id: string; qty_now: number }[] }) => {
        const { data, error } = await supabase.rpc("core_receive_external_purchase_order", {
          p_order_id: args.order_id, p_lines: args.lines as any,
        });
        if (error) throw error; return data;
      },
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: async (args: { order_id: string; reason: string }) => {
        const { data, error } = await supabase.rpc("core_cancel_external_purchase_order", {
          p_order_id: args.order_id, p_reason: args.reason,
        });
        if (error) throw error; return data;
      },
      onSuccess: invalidate,
    }),
    reopen: useMutation({
      mutationFn: async (order_id: string) => {
        const { data, error } = await supabase.rpc("core_reopen_external_purchase_order", { p_order_id: order_id });
        if (error) throw error; return data;
      },
      onSuccess: invalidate,
    }),
    updatePayment: useMutation({
      mutationFn: async (args: { order_id: string; amount_paid: number }) => {
        const { data, error } = await supabase.rpc("core_update_external_purchase_order_payment", {
          p_order_id: args.order_id, p_amount_paid: args.amount_paid,
        });
        if (error) throw error; return data;
      },
      onSuccess: invalidate,
    }),
  };
}
