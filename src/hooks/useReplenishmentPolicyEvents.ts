import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type PolicyEvent = {
  id: string;
  created_at: string;
  source_type: string;
  action: string;
  severity: string;
  message: string | null;
  warning: string | null;
  status: string;
  quantity: number | null;
  unit_cost: number | null;
  amount: number | null;
  cost_source: string | null;
  core_product_id: string | null;
  core_variant_id: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  replacement_product_id: string | null;
  replacement_woo_product_id: number | null;
  external_supplier_name: string | null;
  external_supplier_unit_cost_usd: number | null;
  replacement_behavior?: string | null;
  resolution_data?: any;
};

const OPEN_STATUSES = ["open", "reviewed"];

export function useReplenishmentPolicyEvents() {
  const qc = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ["policy_events", "attention_open_reviewed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_replenishment_policy_events" as any)
        .select("*")
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as PolicyEvent[];
    },
  });

  const rows = eventsQuery.data ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: 0 };
    for (const r of rows) {
      c.total += 1;
      c[r.action] = (c[r.action] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  // Resolve product / variant names in one shot
  const productIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.core_product_id).filter(Boolean))) as string[],
    [rows],
  );
  const variantIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.core_variant_id).filter(Boolean))) as string[],
    [rows],
  );
  const wooIds = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...rows.map((r) => r.woo_product_id),
            ...rows.map((r) => r.replacement_woo_product_id),
          ].filter((n): n is number => typeof n === "number"),
        ),
      ),
    [rows],
  );
  const replacementProductIds = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.replacement_product_id).filter(Boolean))) as string[],
    [rows],
  );

  const { data: productsMap = {} } = useQuery({
    queryKey: ["policy_events_products", [...productIds, ...replacementProductIds].sort()],
    enabled: productIds.length + replacementProductIds.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set([...productIds, ...replacementProductIds]));
      const { data } = await supabase
        .from("core_products")
        .select("id,name,core_sku,woo_product_id")
        .in("id", ids);
      const map: Record<string, any> = {};
      (data ?? []).forEach((p: any) => (map[p.id] = p));
      return map;
    },
  });

  const { data: variantsMap = {} } = useQuery({
    queryKey: ["policy_events_variants", variantIds.sort()],
    enabled: variantIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("core_product_variants")
        .select("id,size,variant_label,variant_sku,woo_variation_id")
        .in("id", variantIds);
      const map: Record<string, any> = {};
      (data ?? []).forEach((v: any) => (map[v.id] = v));
      return map;
    },
  });

  const { data: wooMap = {} } = useQuery({
    queryKey: ["policy_events_woo_map", wooIds.sort()],
    enabled: wooIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("core_woo_product_map")
        .select("woo_product_id,woo_name,woo_sku")
        .in("woo_product_id", wooIds);
      const map: Record<number, any> = {};
      (data ?? []).forEach((w: any) => (map[w.woo_product_id] = w));
      return map;
    },
  });

  const resolveProductLabel = (r: PolicyEvent) => {
    const cp = r.core_product_id ? (productsMap as any)[r.core_product_id] : null;
    const wm = r.woo_product_id ? (wooMap as any)[r.woo_product_id] : null;
    return {
      name: cp?.name ?? wm?.woo_name ?? (r.woo_product_id ? `Woo #${r.woo_product_id}` : "—"),
      sku: cp?.core_sku ?? wm?.woo_sku ?? null,
      wooId: r.woo_product_id ?? cp?.woo_product_id ?? null,
    };
  };

  const resolveVariantLabel = (r: PolicyEvent) => {
    const v = r.core_variant_id ? (variantsMap as any)[r.core_variant_id] : null;
    if (!v) return r.woo_variation_id ? `var ${r.woo_variation_id}` : "—";
    return v.size ?? v.variant_label ?? v.variant_sku ?? "—";
  };

  const resolveReplacementLabel = (r: PolicyEvent) => {
    const cp = r.replacement_product_id ? (productsMap as any)[r.replacement_product_id] : null;
    const wm = r.replacement_woo_product_id ? (wooMap as any)[r.replacement_woo_product_id] : null;
    if (cp) return cp.name;
    if (wm) return wm.woo_name;
    if (r.replacement_woo_product_id) return `Woo #${r.replacement_woo_product_id}`;
    return null;
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["policy_events"] });
    qc.invalidateQueries({ queryKey: ["policy_events_summary"] });
  };

  const setEventStatus = async (id: string, newStatus: "reviewed" | "resolved" | "ignored") => {
    const { error } = await supabase
      .from("core_replenishment_policy_events" as any)
      .update({
        status: newStatus,
        resolved_at:
          newStatus === "resolved" || newStatus === "ignored" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Evento actualizado" });
    invalidateAll();
    return true;
  };

  return {
    rows,
    isLoading: eventsQuery.isLoading,
    counts,
    resolveProductLabel,
    resolveVariantLabel,
    resolveReplacementLabel,
    setEventStatus,
    invalidateAll,
  };
}
