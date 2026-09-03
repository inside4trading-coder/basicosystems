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
  /** true cuando "Actualizar" detectó cambios de política/ruta respecto al snapshot previo */
  changed?: boolean;
  changes?: string[];
  snapshot?: PolicySnapshot;
};

/** Foto de la política/ruta vigente de un producto en un momento dado. */
export type PolicySnapshot = {
  route: string | null;
  lifecycle_status: string | null;
  restock_enabled: boolean | null;
  replacement_behavior: string | null;
  replacement_product_id: string | null;
  unit_cost: number | null;
  core_product_id: string | null;
  core_variant_id: string | null;
  captured_at?: string;
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

/**
 * Revalida el PRODUCTO ORIGINAL de un evento "Reemplazo sugerido".
 * No aplica reemplazo: solo comprueba si el original ya es fabricable.
 */
export async function revalidateOriginalProduct(row: PolicyEvent): Promise<RevalidationResult> {
  // 1) Mapa Woo/Core del producto original (vincula la talla si falta y es única)
  const check = await hasWooCoreMap(row);
  const coreProductId = check.productId ?? row.core_product_id ?? null;
  const coreVariantId = check.variantId ?? row.core_variant_id ?? null;

  // 4) Detectar reemplazo auto-referencial / no-op
  const selfReplacement =
    (!!row.replacement_product_id && !!coreProductId && row.replacement_product_id === coreProductId) ||
    (!!row.replacement_woo_product_id &&
      !!row.woo_product_id &&
      row.replacement_woo_product_id === row.woo_product_id);

  const notReady = (reason: string, message: string): RevalidationResult => ({
    resolved: false,
    reason: selfReplacement ? "self_replacement_original_not_ready" : reason,
    message: selfReplacement
      ? "El reemplazo sugerido apunta al mismo producto. Revisa la política."
      : message,
    coreProductId,
    coreVariantId,
    selfReplacement,
  });

  if (!check.mapped) {
    return notReady(
      "original_not_ready_link",
      "Falta vincular esta talla con el producto del catálogo.",
    );
  }

  const rowResolved = {
    ...row,
    core_product_id: coreProductId,
    core_variant_id: coreVariantId,
  } as PolicyEvent;

  // 2) Costo
  const cost = await resolveUnitCost(rowResolved);
  if (cost == null || !(cost > 0)) {
    return notReady(
      "original_not_ready_cost",
      "Todavía falta vincular producto/talla o costo para fabricar.",
    );
  }

  // 3) Ruta operativa
  const route = await resolveRouteInfo(rowResolved);
  const lifecycleTerminal = ["discontinued", "archived", "inactive"].includes(
    String(route.lifecycleStatus ?? "").toLowerCase(),
  );
  if (route.route !== "internal_factory" || route.restockEnabled === false || lifecycleTerminal) {
    return notReady(
      "original_not_ready_route",
      "El producto original no está habilitado para fabricación interna.",
    );
  }

  return {
    resolved: true,
    reason: "original_product_now_fabricable",
    message: "Producto original listo para fabricar.",
    unitCost: cost,
    route: "internal_factory",
    lifecycleStatus: route.lifecycleStatus,
    restockEnabled: route.restockEnabled,
    coreProductId: route.coreProductId ?? coreProductId,
    coreVariantId: route.coreVariantId ?? coreVariantId,
    selfReplacement,
  };
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

    // D — reemplazo sugerido: revalidar primero el producto ORIGINAL
    if (REPLACEMENT_ACTIONS.has(row.action)) {
      return await revalidateOriginalProduct(row);
    }

    return NOT_VALIDATABLE;
  } catch {
    return NOT_VALIDATABLE;
  }
}

// ---------------------------------------------------------------------------
// "Actualizar" = detectar y sincronizar cambios de política/ruta.
// Nunca resuelve la necesidad, ni crea reposición, ni movimientos financieros.
// ---------------------------------------------------------------------------

const ROUTE_LABEL: Record<string, string> = {
  internal_factory: "Fabricación interna",
  external_supplier: "Proveedor externo",
  no_restock: "No restock",
  replacement: "Reemplazo",
  pending_classification: "Sin clasificar",
  manual_cost: "Costo manual",
};

const BEHAVIOR_LABEL: Record<string, string> = {
  suggest_only: "Solo sugerir",
  use_on_restock: "Usar en reposición",
  use_on_restock_with_confirmation: "Usar con confirmación",
};

function routeLabel(v: string | null | undefined): string {
  if (!v) return "sin política";
  return ROUTE_LABEL[v] ?? v;
}

function behaviorLabel(v: string | null | undefined): string {
  if (!v) return "sin definir";
  return BEHAVIOR_LABEL[v] ?? v;
}

/** Snapshot registrado cuando se generó/evaluó la necesidad. */
export function readStoredPolicySnapshot(row: PolicyEvent): PolicySnapshot {
  const stored = (row.resolution_data as any)?.policy_snapshot ?? null;
  if (stored) {
    return {
      route: stored.route ?? null,
      lifecycle_status: stored.lifecycle_status ?? null,
      restock_enabled: stored.restock_enabled ?? null,
      replacement_behavior: stored.replacement_behavior ?? null,
      replacement_product_id: stored.replacement_product_id ?? null,
      unit_cost: stored.unit_cost != null ? Number(stored.unit_cost) : null,
      core_product_id: stored.core_product_id ?? null,
      core_variant_id: stored.core_variant_id ?? null,
      captured_at: stored.captured_at ?? null,
    };
  }
  // Sin snapshot previo: reconstruir desde los datos con los que nació la fila.
  const rd = (row.resolution_data as any) ?? {};
  return {
    route: rd.route ?? row._unlinkedRoute ?? null,
    lifecycle_status: rd.lifecycle_status ?? null,
    restock_enabled: rd.restock_enabled ?? null,
    replacement_behavior: row.replacement_behavior ?? null,
    replacement_product_id: row.replacement_product_id ?? null,
    unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
    core_product_id: row.core_product_id ?? null,
    core_variant_id: row.core_variant_id ?? null,
  };
}

/** Lee la política vigente del producto (solo lectura). */
export async function readCurrentPolicySnapshot(row: PolicyEvent): Promise<PolicySnapshot> {
  const route = await resolveRouteInfo(row);
  const rowResolved = {
    ...row,
    core_product_id: route.coreProductId ?? row.core_product_id ?? null,
    core_variant_id: route.coreVariantId ?? row.core_variant_id ?? null,
  } as PolicyEvent;
  const unitCost = await resolveUnitCost(rowResolved);

  let behavior: string | null = null;
  let replacementProductId: string | null = null;
  const productId = route.coreProductId ?? row.core_product_id ?? null;
  if (productId) {
    const { data } = await (supabase as any)
      .from("core_replenishment_policies")
      .select("replacement_behavior, replacement_product_id")
      .eq("core_product_id", productId)
      .maybeSingle();
    behavior = (data as any)?.replacement_behavior ?? null;
    replacementProductId = (data as any)?.replacement_product_id ?? null;
  }

  return {
    route: route.route,
    lifecycle_status: route.lifecycleStatus,
    restock_enabled: route.restockEnabled,
    replacement_behavior: behavior,
    replacement_product_id: replacementProductId,
    unit_cost: unitCost,
    core_product_id: route.coreProductId ?? row.core_product_id ?? null,
    core_variant_id: route.coreVariantId ?? row.core_variant_id ?? null,
    captured_at: new Date().toISOString(),
  };
}

/** Compara snapshot previo vs actual y devuelve la lista de cambios legibles. */
export function diffPolicySnapshots(prev: PolicySnapshot, next: PolicySnapshot): string[] {
  const changes: string[] = [];
  if ((prev.route ?? null) !== (next.route ?? null)) {
    changes.push(`Política: ${routeLabel(prev.route)} → ${routeLabel(next.route)}`);
  }
  if ((prev.lifecycle_status ?? null) !== (next.lifecycle_status ?? null)) {
    changes.push(
      `Estado comercial: ${prev.lifecycle_status ?? "sin definir"} → ${next.lifecycle_status ?? "sin definir"}`,
    );
  }
  if ((prev.restock_enabled ?? null) !== (next.restock_enabled ?? null)) {
    const fmt = (v: boolean | null) => (v == null ? "sin definir" : v ? "reposición activa" : "reposición desactivada");
    changes.push(`Reposición: ${fmt(prev.restock_enabled ?? null)} → ${fmt(next.restock_enabled ?? null)}`);
  }
  if ((prev.replacement_behavior ?? null) !== (next.replacement_behavior ?? null)) {
    changes.push(
      `Comportamiento de reemplazo: ${behaviorLabel(prev.replacement_behavior)} → ${behaviorLabel(next.replacement_behavior)}`,
    );
  }
  if ((prev.replacement_product_id ?? null) !== (next.replacement_product_id ?? null)) {
    changes.push("Producto de reemplazo actualizado");
  }
  const prevCost = prev.unit_cost != null ? Number(prev.unit_cost) : null;
  const nextCost = next.unit_cost != null ? Number(next.unit_cost) : null;
  if ((prevCost ?? null) !== (nextCost ?? null)) {
    const fmt = (v: number | null) => (v == null ? "sin costo" : `${v.toFixed(2)} USD`);
    changes.push(`Costo unitario: ${fmt(prevCost)} → ${fmt(nextCost)}`);
  }
  if ((prev.core_variant_id ?? null) !== (next.core_variant_id ?? null) && next.core_variant_id) {
    changes.push("Vínculo de variante Core actualizado");
  } else if ((prev.core_product_id ?? null) !== (next.core_product_id ?? null) && next.core_product_id) {
    changes.push("Vínculo de producto Core actualizado");
  }
  return changes;
}

/**
 * Actualizar: sincroniza la fila con la política vigente y reporta los cambios.
 * Mantiene la necesidad ABIERTA. Resolver sigue siendo manual e independiente.
 */
export async function syncAttentionRowPolicy(row: PolicyEvent): Promise<RevalidationResult> {
  try {
    // Sincroniza vínculo Woo/Core si el padre ya está conectado (solo información).
    const mapCheck = await hasWooCoreMap(row);
    const rowForRead = {
      ...row,
      core_product_id: mapCheck.productId ?? row.core_product_id ?? null,
      core_variant_id: mapCheck.variantId ?? row.core_variant_id ?? null,
    } as PolicyEvent;

    const prev = readStoredPolicySnapshot(row);
    const next = await readCurrentPolicySnapshot(rowForRead);
    const changes = diffPolicySnapshots(prev, next);

    return {
      resolved: false,
      changed: changes.length > 0,
      changes,
      snapshot: next,
      reason: changes.length > 0 ? "policy_changed" : "policy_unchanged",
      message:
        changes.length > 0
          ? `Cambios detectados: ${changes.join(" · ")}. La necesidad sigue abierta; resuélvela manualmente.`
          : "Sin cambios de política. La necesidad sigue abierta.",
      unitCost: next.unit_cost,
      route: next.route,
      lifecycleStatus: next.lifecycle_status,
      restockEnabled: next.restock_enabled,
      coreProductId: next.core_product_id,
      coreVariantId: next.core_variant_id,
    };
  } catch (e: any) {
    return {
      resolved: false,
      changed: false,
      changes: [],
      reason: "sync_failed",
      message: e?.message ?? "No se pudo actualizar la información.",
    };
  }
}
