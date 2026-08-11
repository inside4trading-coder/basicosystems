import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DispatchStatus =
  | "draft"
  | "closed"
  | "sent"
  | "received"
  | "received_with_differences"
  | "cancelled";

export type Dispatch = {
  id: string;
  dispatch_number: string | null;
  status: string;
  destination_location_id: string | null;
  destination_location_name: string | null;
  factory_responsible: string | null;
  carrier_name: string | null;
  production_order_id: string | null;
  expected_departure_date: string | null;
  notes: string | null;
  closed_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  received_by_name: string | null;
  difference_note: string | null;
  created_at: string;
  unit_count?: number;
};

export type DispatchUnit = {
  id: string;
  dispatch_id: string;
  unit_id: string;
  unit_code: string;
  production_order_id: string | null;
  product_name: string | null;
  sku: string | null;
  size: string | null;
  status: string;
  received_at: string | null;
  difference_note: string | null;
  order_code?: string | null;
};

export const DISPATCH_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  closed: "Cerrado preparado",
  sent: "Enviado",
  received: "Recibido",
  received_with_differences: "Recibido con diferencias",
  cancelled: "Cancelado",
};

export const UNIT_OPERATIONAL_LABEL: Record<string, string> = {
  completed: "Lista para inventario",
  in_dispatch: "En despacho",
  sent_to_store: "Enviada a tienda",
  received_in_store: "Recibida en tienda",
  entered_inventory: "Ingresada a inventario",
};

export function useCoreDispatches() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("core_dispatches")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = ((data as any[]) ?? []) as Dispatch[];
    const ids = rows.map((r) => r.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: units } = await supabase
        .from("core_dispatch_units")
        .select("dispatch_id")
        .in("dispatch_id", ids);
      for (const u of ((units as any[]) ?? [])) {
        counts.set(u.dispatch_id, (counts.get(u.dispatch_id) ?? 0) + 1);
      }
    }
    setDispatches(rows.map((r) => ({ ...r, unit_count: counts.get(r.id) ?? 0 })));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { dispatches, loading, reload };
}

export async function fetchDispatchUnits(dispatchId: string): Promise<DispatchUnit[]> {
  const { data } = await supabase
    .from("core_dispatch_units")
    .select("*")
    .eq("dispatch_id", dispatchId)
    .order("created_at");
  const rows = ((data as any[]) ?? []) as DispatchUnit[];
  const orderIds = Array.from(new Set(rows.map((r) => r.production_order_id).filter(Boolean))) as string[];
  if (orderIds.length) {
    const { data: orders } = await supabase
      .from("core_production_orders")
      .select("id, order_code")
      .in("id", orderIds);
    const map = new Map<string, string>(((orders as any[]) ?? []).map((o) => [o.id, o.order_code]));
    return rows.map((r) => ({
      ...r,
      order_code: r.production_order_id ? map.get(r.production_order_id) ?? null : null,
    }));
  }
  return rows;
}

export const READY_UNIT_STATUSES = ["completed", "entered_inventory"];

export type ScanResult = { ok: boolean; unit?: any; message?: string };

/** Busca una unidad por unit_code y valida que pueda despacharse. */
export async function resolveUnitForDispatch(code: string): Promise<ScanResult> {
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, message: "Código vacío." };

  const { data: unit } = await supabase
    .from("core_production_units")
    .select("id, unit_code, status, production_order_id, core_product_id, core_variant_id, sku, variant_sku, size")
    .eq("unit_code", clean)
    .maybeSingle();

  if (!unit) return { ok: false, message: `Unidad ${clean} no encontrada.` };

  const u: any = unit;
  if (!READY_UNIT_STATUSES.includes(u.status)) {
    if (["in_dispatch", "sent_to_store", "received_in_store"].includes(u.status)) {
      return {
        ok: false,
        message: `La unidad ${clean} ya está en un despacho (${UNIT_OPERATIONAL_LABEL[u.status] ?? u.status}).`,
      };
    }
    return { ok: false, message: "Esta unidad aún no está lista para despacho." };
  }

  const { data: existing } = await supabase
    .from("core_dispatch_units")
    .select("dispatch_id, status, core_dispatches!inner(dispatch_number, status)")
    .eq("unit_id", u.id)
    .eq("status", "in_dispatch")
    .maybeSingle();
  if (existing) {
    const d: any = (existing as any).core_dispatches;
    return {
      ok: false,
      message: `La unidad ${clean} ya está en el despacho ${d?.dispatch_number ?? "borrador"}.`,
    };
  }

  let productName: string | null = null;
  if (u.core_product_id) {
    const { data: p } = await supabase
      .from("core_products")
      .select("name")
      .eq("id", u.core_product_id)
      .maybeSingle();
    productName = (p as any)?.name ?? null;
  }

  return { ok: true, unit: { ...u, product_name: productName } };
}
