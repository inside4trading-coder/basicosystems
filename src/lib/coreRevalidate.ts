// Revalidación de filas de "Requieren atención".
// Lectura de configuración actual (costo / mapa Woo-Core / catálogo de fabricación)
// + resolución de ruta operativa (resolve_core_replenishment_action).
// No crea OP, ni unidades/QR, ni movimientos financieros, ni toca Woo.
import { supabase } from "@/integrations/supabase/client";
import type { PolicyEvent } from "@/hooks/useReplenishmentPolicyEvents";

export type RevalidationResult = {
  resolved: boolean;
  reason: string;
  message: string;
  unitCost?: number | null;
  route?: string | null;
  lifecycleStatus?: string | null;
  restockEnabled?: boolean | null;
  coreProductId?: string | null;
  coreVariantId?: string | null;
  createdNeedId?: string | null;
};

const NOT_VALIDATABLE: RevalidationResult = {
  resolved: false,
  reason: "not_validatable",
  message: "No se pudo validar automáticamente.",
};

const COST_ACTIONS = new Set(["missing_cost", "financial_review", "manual_cost_review"]);
const MAP_ACTIONS = new Set(["missing_map"]);

/** Resuelve ruta/política actual (solo lectura). */
export async function resolveRouteInfo(row: PolicyEvent): Promise<{
  route: string | null;
  lifecycleStatus: string | null;
  restockEnabled: boolean | null;
  coreProductId: string | null;
  coreVariantId: string | null;
}> {
  const empty = {
    route: null,
    lifecycleStatus: null,
    restockEnabled: null,
    coreProductId: row.core_product_id ?? null,
    coreVariantId: row.core_variant_id ?? null,
  };
  try {
    const { data, error } = await (supabase as any).rpc("resolve_core_replenishment_action", {
      p_core_product_id: row.core_product_id ?? null,
      p_core_variant_id: row.core_variant_id ?? null,
      p_woo_product_id: row.woo_product_id ?? null,
      p_woo_variation_id: row.woo_variation_id ?? null,
    });
    if (error) return empty;
    const first = Array.isArray(data) ? data[0] : data;
    if (!first) return empty;
    return {
      route: (first as any).replenishment_route ?? null,
      lifecycleStatus: (first as any).lifecycle_status ?? null,
      restockEnabled: (first as any).restock_enabled ?? null,
      coreProductId: (first as any).core_product_id ?? row.core_product_id ?? null,
      coreVariantId: (first as any).core_variant_id ?? row.core_variant_id ?? null,
    };
  } catch {
    return empty;
  }
}

async function resolveUnitCost(row: PolicyEvent): Promise<number | null> {
  const { data, error } = await (supabase as any).rpc("resolve_core_operational_unit_cost", {
    p_core_product_id: row.core_product_id ?? null,
    p_core_variant_id: row.core_variant_id ?? null,
    p_woo_product_id: row.woo_product_id ?? null,
    p_woo_variation_id: row.woo_variation_id ?? null,
  });
  if (error) return null;
  const first = Array.isArray(data) ? data[0] : data;
  const cost = first?.unit_cost != null ? Number(first.unit_cost) : null;
  return cost != null && Number.isFinite(cost) ? cost : null;
}

async function hasWooCoreMap(row: PolicyEvent): Promise<{ mapped: boolean; productId?: string | null }> {
  if (row.core_product_id && (!row.woo_variation_id || row.core_variant_id)) {
    return { mapped: true, productId: row.core_product_id };
  }
  if (!row.woo_product_id) return { mapped: false };

  const { data: pm } = await supabase
    .from("core_woo_product_map")
    .select("core_product_id")
    .eq("woo_product_id", row.woo_product_id)
    .maybeSingle();
  const coreProductId = (pm as any)?.core_product_id ?? null;
  if (!coreProductId) return { mapped: false };

  if (row.woo_variation_id) {
    const { data: vm } = await supabase
      .from("core_woo_variant_map")
      .select("core_variant_id")
      .eq("woo_variation_id", row.woo_variation_id)
      .maybeSingle();
    if (!(vm as any)?.core_variant_id) return { mapped: false, productId: coreProductId };
  }
  return { mapped: true, productId: coreProductId };
}

async function hasFabricationCatalog(coreProductId: string | null | undefined): Promise<boolean> {
  if (!coreProductId) return false;
  const { data } = await supabase
    .from("core_products")
    .select("id,is_active")
    .eq("id", coreProductId)
    .maybeSingle();
  return !!data;
}

/** Revalida una fila contra la configuración actual (solo lectura). */
export async function revalidateAttentionRow(row: PolicyEvent): Promise<RevalidationResult> {
  try {
    // B / C — falta mapeo o vínculo Core
    if (MAP_ACTIONS.has(row.action) || row.warning === "missing_core_ids") {
      const { mapped, productId } = await hasWooCoreMap(row);
      if (!mapped) {
        return {
          resolved: false,
          reason: "map_still_missing",
          message: "Todavía falta configurar el mapa Woo/Core.",
        };
      }
      const inCatalog = await hasFabricationCatalog(productId ?? row.core_product_id);
      if (!inCatalog) {
        return {
          resolved: false,
          reason: "catalog_still_missing",
          message: "Todavía falta configurar el catálogo de fabricación.",
        };
      }
      return {
        resolved: true,
        reason: "map_now_configured",
        message: "Mapa Woo/Core configurado.",
      };
    }

    // A — falta costo
    if (COST_ACTIONS.has(row.action) || row.warning === "unit_cost_missing") {
      const cost = await resolveUnitCost(row);
      if (cost != null && cost > 0) {
        return {
          resolved: true,
          reason: "cost_now_configured",
          message: `Costo configurado (${cost.toFixed(2)} USD).`,
          unitCost: cost,
        };
      }
      return {
        resolved: false,
        reason: "cost_still_missing",
        message: "Todavía falta configurar costo/catálogo.",
      };
    }

    return NOT_VALIDATABLE;
  } catch {
    return NOT_VALIDATABLE;
  }
}
