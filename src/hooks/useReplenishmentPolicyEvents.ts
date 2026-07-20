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
  woo_order_id?: number | null;
  woo_order_item_id?: number | null;
  replacement_product_id: string | null;
  replacement_woo_product_id: number | null;
  external_supplier_name: string | null;
  external_supplier_unit_cost_usd: number | null;
  replacement_behavior?: string | null;
  resolution_data?: any;
  // synthetic (non-policy-event rows)
  _kind?: "policy_event" | "pending_item" | "pending_classification";
  _synthetic?: boolean;
  _dedupe_key?: string | null;
  // pending_classification-only
  sourceMovementId?: string | null;
  unit_cost_snapshot?: number | null;
  pendingClassificationResolution?: PendingClassificationResolution | null;
  isCorrected?: boolean;
  canClose?: boolean;
};

export type PendingClassificationResolution = {
  status?: "corrected" | "closed";
  action?: "no_restock" | "replace";
  resolved_at?: string;
  resolved_by?: string | null;
  closed_at?: string;
  closed_by?: string | null;
  replacement_event_id?: string;
  note?: string;
};

const OPEN_STATUSES = ["open", "reviewed"];
const PENDING_ITEM_ACTIVE_STATUSES = ["pending", "review", "open", "needs_action"];
const MISSING_MAP_REASONS = new Set([
  "missing_sku",
  "variation_not_mapped",
  "product_not_in_core",
  "product_not_mapped",
]);
const MISSING_COST_REASONS = new Set(["missing_cost", "unit_cost_missing"]);

function makeDedupeKey(orderId: number | null | undefined, orderItemId: number | null | undefined) {
  if (!orderId && !orderItemId) return null;
  return `${orderId ?? "-"}::${orderItemId ?? "-"}`;
}

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

  const pendingItemsQuery = useQuery({
    queryKey: ["fab_fund_pending_items", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_fabrication_fund_pending_items" as any)
        .select("*")
        .not("status", "in", "(processed,resolved,ignored,cancelled)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const pendingClassMovsQuery = useQuery({
    queryKey: ["fab_fund_movements", "pending_classification"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_fabrication_fund_movements" as any)
        .select(
          "id, created_at, fund_id, fund_bucket, status, source_order_id, source_order_item_id, woo_product_id, woo_variation_id, core_product_id, core_variant_id, sku, product_name, quantity, unit_cost_snapshot, amount, reason, resolution_data",
        )
        .eq("fund_bucket", "pending_classification")
        .eq("status", "posted")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const raw = (data ?? []) as any[];
      return raw.filter((m) => {
        const res = m.resolution_data?.pending_classification_resolution;
        if (!res) return true;
        if (res.status === "corrected") return true;
        return false; // closed → excluded
      });
    },
  });

  const policyRows = eventsQuery.data ?? [];
  const pendingItems = pendingItemsQuery.data ?? [];
  const pendingClassMovs = pendingClassMovsQuery.data ?? [];

  // Build merged, deduped rows (visual only)
  const rows = useMemo<PolicyEvent[]>(() => {
    const seen = new Set<string>();
    const out: PolicyEvent[] = [];

    for (const r of policyRows) {
      const key = makeDedupeKey(r.woo_order_id ?? null, r.woo_order_item_id ?? null);
      if (key) seen.add(key);
      out.push({ ...r, _kind: "policy_event", _dedupe_key: key });
    }

    for (const p of pendingItems) {
      const key = makeDedupeKey(p.source_order_id, p.source_order_item_id);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      const isMap = MISSING_MAP_REASONS.has(p.reason);
      const isCost = MISSING_COST_REASONS.has(p.reason);
      const action = isMap ? "missing_map" : isCost ? "missing_cost" : "financial_review";
      out.push({
        id: `pi:${p.id}`,
        created_at: p.created_at,
        source_type: "fabrication_fund_pending_item",
        action,
        severity: isCost ? "review" : "warning",
        message: p.notes ?? p.reason ?? null,
        warning: p.reason ?? null,
        status: p.status ?? "open",
        quantity: p.quantity != null ? Number(p.quantity) : null,
        unit_cost: null,
        amount: p.revenue != null ? Number(p.revenue) : null,
        cost_source: null,
        core_product_id: p.linked_core_product_id ?? null,
        core_variant_id: p.linked_core_variant_id ?? null,
        woo_product_id: p.woo_product_id ?? null,
        woo_variation_id: p.woo_variation_id ?? null,
        woo_order_id: p.source_order_id ?? null,
        woo_order_item_id: p.source_order_item_id ?? null,
        replacement_product_id: null,
        replacement_woo_product_id: null,
        external_supplier_name: null,
        external_supplier_unit_cost_usd: null,
        _kind: "pending_item",
        _synthetic: true,
        _dedupe_key: key,
        resolution_data: {
          product_name: p.product_name,
          woo_sku: p.woo_sku,
        },
      });
    }

    for (const m of pendingClassMovs) {
      const key = makeDedupeKey(m.source_order_id, m.source_order_item_id);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      out.push({
        id: `mv:${m.id}`,
        created_at: m.created_at,
        source_type: "fabrication_fund_movement",
        action: "unclassified_fund",
        severity: "warning",
        message: m.reason ?? "Partida sin clasificar",
        warning: "pending_classification",
        status: "open",
        quantity: m.quantity != null ? Number(m.quantity) : null,
        unit_cost: m.unit_cost_snapshot != null ? Number(m.unit_cost_snapshot) : null,
        amount: m.amount != null ? Number(m.amount) : null,
        cost_source: null,
        core_product_id: m.core_product_id ?? null,
        core_variant_id: m.core_variant_id ?? null,
        woo_product_id: m.woo_product_id ?? null,
        woo_variation_id: m.woo_variation_id ?? null,
        woo_order_id: m.source_order_id ?? null,
        woo_order_item_id: m.source_order_item_id ?? null,
        replacement_product_id: null,
        replacement_woo_product_id: null,
        external_supplier_name: null,
        external_supplier_unit_cost_usd: null,
        _kind: "pending_classification",
        _synthetic: true,
        _dedupe_key: key,
        resolution_data: {
          product_name: m.product_name,
          woo_sku: m.sku,
        },
      });
    }

    return out;
  }, [policyRows, pendingItems, pendingClassMovs]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: 0 };
    for (const r of rows) {
      c.total += 1;
      c[r.action] = (c[r.action] ?? 0) + 1;
    }
    c.missing_map = c.missing_map ?? 0;
    c.missing_cost = c.missing_cost ?? 0;
    c.unclassified_fund = c.unclassified_fund ?? 0;
    c.config_issues =
      (c.missing_map ?? 0) + (c.missing_cost ?? 0) + (c.unclassified_fund ?? 0);
    return c;
  }, [rows]);

  // Resolve product / variant names in one shot (for policy-event rows without embedded snapshots)
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
    const snap = (r.resolution_data ?? {}) as any;
    return {
      name:
        cp?.name ??
        wm?.woo_name ??
        snap?.product_name ??
        (r.woo_product_id ? `Woo #${r.woo_product_id}` : "—"),
      sku: cp?.core_sku ?? wm?.woo_sku ?? snap?.woo_sku ?? null,
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
    qc.invalidateQueries({ queryKey: ["fab_fund_pending_items"] });
    qc.invalidateQueries({ queryKey: ["fab_fund_movements"] });
  };

  const setEventStatus = async (id: string, newStatus: "reviewed" | "resolved" | "ignored") => {
    // synthetic rows cannot be transitioned
    if (id.startsWith("pi:") || id.startsWith("mv:")) {
      toast({
        title: "Acción no disponible",
        description: "Este pendiente se resuelve corrigiendo su configuración.",
      });
      return false;
    }
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
    isLoading:
      eventsQuery.isLoading || pendingItemsQuery.isLoading || pendingClassMovsQuery.isLoading,
    counts,
    resolveProductLabel,
    resolveVariantLabel,
    resolveReplacementLabel,
    setEventStatus,
    invalidateAll,
  };
}
