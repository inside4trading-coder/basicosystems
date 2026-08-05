// Revalidación de filas de "Requieren atención".
// Lectura de configuración actual (costo / mapa Woo-Core / catálogo de fabricación)
// + resolución de ruta operativa (resolve_core_replenishment_action).
// No crea OP, ni unidades/QR, ni movimientos financieros, ni toca Woo.
import { supabase } from "@/integrations/supabase/client";
import { normalizeSize } from "@/lib/coreNormalize";
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
  selfReplacement?: boolean;
};

const NOT_VALIDATABLE: RevalidationResult = {
  resolved: false,
  reason: "not_validatable",
  message: "No se pudo validar automáticamente.",
};

const COST_ACTIONS = new Set(["missing_cost", "financial_review", "manual_cost_review"]);
const MAP_ACTIONS = new Set(["missing_map"]);
const REPLACEMENT_ACTIONS = new Set(["suggest_replacement"]);

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

/** Normaliza SKU: sin acentos, separadores a espacio, mayúsculas. */
function normalizeSku(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

type VariantLinkResult =
  | { status: "linked"; coreVariantId: string; skuMatched: string | null; sizeLabel: string | null }
  | { status: "not_found"; sizeLabel: string | null }
  | { status: "ambiguous"; sizeLabel: string | null };

/**
 * Intenta vincular la variación Woo con una variante Core del producto padre
 * ya conectado, usando SKU y/o talla normalizados.
 */
export async function resolveVariantLinkByParent(
  row: PolicyEvent,
  coreProductId: string,
): Promise<VariantLinkResult> {
  const wooVariationId = row.woo_variation_id!;

  const { data: vm } = await supabase
    .from("core_woo_variant_map")
    .select("woo_variant_sku, size_label, normalized_size")
    .eq("woo_variation_id", wooVariationId)
    .maybeSingle();

  const wooSku = normalizeSku((vm as any)?.woo_variant_sku ?? (row as any)?.sku ?? null);
  const wooSize = normalizeSize((vm as any)?.normalized_size ?? (vm as any)?.size_label ?? null);
  const sizeLabel = wooSize || null;

  // Talla derivada del SKU cuando no hay atributo (ej. "JGM08 M" -> "M")
  const skuTokens = wooSku ? wooSku.split(" ") : [];
  const sizeFromSku = skuTokens.length > 1 ? skuTokens[skuTokens.length - 1] : "";
  const targetSize = wooSize || sizeFromSku;

  const { data: variants } = await supabase
    .from("core_product_variants")
    .select("id, size, normalized_size, variant_sku, woo_sku, variant_label")
    .eq("core_product_id", coreProductId);

  const list = (variants ?? []) as any[];
  if (list.length === 0) return { status: "not_found", sizeLabel };

  let matches: any[] = [];
  let skuMatched: string | null = null;

  if (wooSku) {
    matches = list.filter(
      (v) => normalizeSku(v.variant_sku) === wooSku || normalizeSku(v.woo_sku) === wooSku,
    );
    if (matches.length === 1) skuMatched = wooSku;
  }
  if (matches.length === 0 && targetSize) {
    matches = list.filter(
      (v) =>
        normalizeSize(v.normalized_size) === targetSize ||
        normalizeSize(v.size) === targetSize ||
        normalizeSize(v.variant_label) === targetSize,
    );
    if (matches.length === 1) skuMatched = normalizeSku(matches[0].variant_sku ?? matches[0].woo_sku) || targetSize;
  }

  if (matches.length === 0) return { status: "not_found", sizeLabel: sizeLabel ?? targetSize ?? null };
  if (matches.length > 1) return { status: "ambiguous", sizeLabel: sizeLabel ?? targetSize ?? null };

  const coreVariantId = String(matches[0].id);

  const { error: upErr } = await supabase
    .from("core_woo_variant_map")
    .upsert(
      {
        woo_product_id: row.woo_product_id ?? null,
        woo_variation_id: wooVariationId,
        core_product_id: coreProductId,
        core_variant_id: coreVariantId,
        mapping_status: "mapped",
      } as any,
      { onConflict: "woo_variation_id" },
    );
  if (upErr) return { status: "not_found", sizeLabel: sizeLabel ?? targetSize ?? null };

  // Trazabilidad (best-effort)
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("core_product_strategy_decisions").insert({
      woo_product_id: row.woo_product_id ?? null,
      core_product_id: coreProductId,
      decision_type: "variant_link_refresh",
      new_values: {
        resolved_by_refresh: true,
        resolved_reason: "variant_link_resolved_by_parent_and_sku",
        woo_product_id: row.woo_product_id ?? null,
        woo_variation_id: wooVariationId,
        core_product_id: coreProductId,
        core_variant_id: coreVariantId,
        sku_matched: skuMatched,
      } as any,
      reason: "Vínculo de variante resuelto al actualizar Requieren atención",
      created_by: auth?.user?.id ?? null,
    } as any);
  } catch {
    /* auditoría opcional */
  }

  return { status: "linked", coreVariantId, skuMatched, sizeLabel: sizeLabel ?? targetSize ?? null };
}

type MapCheck = {
  mapped: boolean;
  productId?: string | null;
  variantId?: string | null;
  parentConnected?: boolean;
  variantIssue?: "not_found" | "ambiguous" | null;
  sizeLabel?: string | null;
};

async function hasWooCoreMap(row: PolicyEvent): Promise<MapCheck> {
  if (row.core_product_id && (!row.woo_variation_id || row.core_variant_id)) {
    return { mapped: true, productId: row.core_product_id, variantId: row.core_variant_id ?? null };
  }

  let coreProductId: string | null = row.core_product_id ?? null;
  if (!coreProductId) {
    if (!row.woo_product_id) return { mapped: false };
    const { data: pm } = await supabase
      .from("core_woo_product_map")
      .select("core_product_id")
      .eq("woo_product_id", row.woo_product_id)
      .maybeSingle();
    coreProductId = (pm as any)?.core_product_id ?? null;
  }
  if (!coreProductId) return { mapped: false };

  if (row.woo_variation_id) {
    const { data: vm } = await supabase
      .from("core_woo_variant_map")
      .select("core_variant_id")
      .eq("woo_variation_id", row.woo_variation_id)
      .maybeSingle();
    const existingVariantId = (vm as any)?.core_variant_id ?? null;
    if (existingVariantId) {
      return { mapped: true, productId: coreProductId, variantId: existingVariantId, parentConnected: true };
    }
    // Padre conectado, falta variante: intentar resolver automáticamente
    const link = await resolveVariantLinkByParent(row, coreProductId);
    if (link.status === "linked") {
      return { mapped: true, productId: coreProductId, variantId: link.coreVariantId, parentConnected: true };
    }
    return {
      mapped: false,
      productId: coreProductId,
      parentConnected: true,
      variantIssue: link.status,
      sizeLabel: link.sizeLabel,
    };
  }
  return { mapped: true, productId: coreProductId, parentConnected: true };
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
      const check = await hasWooCoreMap(row);
      const { mapped, productId, variantId } = check;
      if (!mapped) {
        if (check.parentConnected && check.variantIssue === "ambiguous") {
          return {
            resolved: false,
            reason: "variant_link_ambiguous",
            message: "Encontramos varias variantes posibles. Selecciona la correcta.",
          };
        }
        if (check.parentConnected) {
          return {
            resolved: false,
            reason: "variant_link_missing",
            message: check.sizeLabel
              ? `Producto conectado, falta vincular la talla ${check.sizeLabel}.`
              : "Producto conectado, falta vincular la variante.",
          };
        }
        return {
          resolved: false,
          reason: "map_still_missing",
          message: "Falta vincular esta talla con el producto del catálogo.",
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
      const route = await resolveRouteInfo({
        ...row,
        core_product_id: productId ?? row.core_product_id,
        core_variant_id: variantId ?? row.core_variant_id,
      } as PolicyEvent);
      return {
        resolved: true,
        reason: variantId && !row.core_variant_id
          ? "variant_link_resolved_by_parent_and_sku"
          : "map_now_configured",
        message:
          variantId && !row.core_variant_id
            ? "Talla vinculada con el catálogo."
            : "Mapa Woo/Core configurado.",
        ...route,
        coreProductId: route.coreProductId ?? productId ?? row.core_product_id ?? null,
        coreVariantId: route.coreVariantId ?? variantId ?? row.core_variant_id ?? null,
      };
    }

    // A — falta costo
    if (COST_ACTIONS.has(row.action) || row.warning === "unit_cost_missing") {
      const cost = await resolveUnitCost(row);
      if (cost != null && cost > 0) {
        const route = await resolveRouteInfo(row);
        return {
          resolved: true,
          reason: "cost_now_configured",
          message: `Costo configurado (${cost.toFixed(2)} USD).`,
          unitCost: cost,
          ...route,
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
