import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WooProductMapRow {
  id: string;
  woo_product_id: number;
  woo_product_name: string | null;
  woo_product_sku: string | null;
  woo_product_type: string | null;
  woo_status: string | null;
  woo_permalink: string | null;
  woo_parent_id: number | null;
  woo_variations_count: number;
  woo_raw_payload: any;
  core_product_id: string | null;
  mapping_status: string;
  variants_sync_status: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReplenishmentPolicyRow {
  id: string;
  woo_product_id: number | null;
  core_product_id: string | null;
  product_name_snapshot: string | null;
  sku_snapshot: string | null;
  brand_role: string;
  lifecycle_status: string;
  replenishment_route: string;
  restock_enabled: boolean;
  manual_unit_cost_usd: number | null;
  manual_cost_reason: string | null;
  external_supplier_name: string | null;
  external_supplier_unit_cost_usd: number | null;
  external_supplier_min_qty: number | null;
  external_supplier_lead_time_days: number | null;
  external_supplier_notes: string | null;
  replacement_product_id: string | null;
  replacement_woo_product_id: number | null;
  replacement_behavior: string;
  decision_reason: string | null;
  last_reviewed_at: string | null;
  updated_at: string;
}

export interface CoreProductLite {
  id: string;
  core_sku: string;
  name: string;
  unit_cost: number;
  manual_unit_cost_usd: number | null;
  cost_structure_id: string | null;
  woo_product_id: number | null;
}

export function useWooProductMap() {
  return useQuery({
    queryKey: ["woo-core-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_woo_product_map")
        .select("*")
        .order("woo_product_name", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as WooProductMapRow[];
    },
  });
}

export function useReplenishmentPolicies() {
  return useQuery({
    queryKey: ["replenishment-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_replenishment_policies")
        .select("*")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as ReplenishmentPolicyRow[];
    },
  });
}

export function useCoreProductsLite() {
  return useQuery({
    queryKey: ["core-products-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_products")
        .select("id, core_sku, name, unit_cost, manual_unit_cost_usd, cost_structure_id, woo_product_id")
        .order("name", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as CoreProductLite[];
    },
  });
}

export function useStrategyAudit(filters?: { wooProductId?: number; coreProductId?: string }) {
  return useQuery({
    queryKey: ["strategy-audit", filters],
    queryFn: async () => {
      let q = supabase
        .from("core_product_strategy_decisions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (filters?.wooProductId) q = q.eq("woo_product_id", filters.wooProductId);
      if (filters?.coreProductId) q = q.eq("core_product_id", filters.coreProductId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWooVariantMap(wooProductId: number | null) {
  return useQuery({
    queryKey: ["woo-variant-map", wooProductId],
    enabled: !!wooProductId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_woo_variant_map")
        .select("*")
        .eq("woo_product_id", wooProductId as number)
        .order("normalized_size", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function logStrategyDecision(entry: {
  woo_product_id?: number | null;
  core_product_id?: string | null;
  policy_id?: string | null;
  decision_type: string;
  previous_values?: any;
  new_values?: any;
  reason?: string | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("core_product_strategy_decisions").insert({
    woo_product_id: entry.woo_product_id ?? null,
    core_product_id: entry.core_product_id ?? null,
    policy_id: entry.policy_id ?? null,
    decision_type: entry.decision_type,
    previous_values: entry.previous_values ?? null,
    new_values: entry.new_values ?? null,
    reason: entry.reason ?? null,
    created_by: user?.id ?? null,
  });
}

export async function upsertPolicy(patch: Partial<ReplenishmentPolicyRow> & { woo_product_id?: number | null; core_product_id?: string | null }) {
  // Prefer core_product_id as conflict key; fallback woo_product_id.
  const query = supabase.from("core_replenishment_policies");
  if (patch.core_product_id) {
    const { data: existing } = await query.select("*").eq("core_product_id", patch.core_product_id).maybeSingle();
    if (existing) {
      const { data, error } = await supabase.from("core_replenishment_policies").update(patch).eq("id", existing.id).select("*").maybeSingle();
      if (error) throw error;
      return { policy: data, previous: existing };
    }
  }
  if (patch.woo_product_id) {
    const { data: existing } = await query.select("*").eq("woo_product_id", patch.woo_product_id).maybeSingle();
    if (existing) {
      const { data, error } = await supabase.from("core_replenishment_policies").update(patch).eq("id", existing.id).select("*").maybeSingle();
      if (error) throw error;
      return { policy: data, previous: existing };
    }
  }
  const { data, error } = await supabase.from("core_replenishment_policies").insert(patch).select("*").maybeSingle();
  if (error) throw error;
  return { policy: data, previous: null };
}
