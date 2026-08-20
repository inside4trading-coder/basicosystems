// Resolución tolerante de la variante Core viva de una unidad de producción.
// Motivo: históricamente al guardar un producto se borraban e insertaban de nuevo todas
// sus variantes, dejando unidades con core_variant_id inexistente y por tanto sin
// woo_variation_id para ingresar a inventario.
import { supabase } from "@/integrations/supabase/client";

export type VariantRow = {
  id: string;
  core_product_id?: string | null;
  woo_variation_id: number | null;
  variant_sku: string | null;
  woo_sku: string | null;
  size: string | null;
  color: string | null;
  variant_label: string | null;
};

export type UnitLike = {
  id?: string;
  core_product_id: string | null;
  core_variant_id: string | null;
  variant_sku?: string | null;
  size?: string | null;
  variant_label?: string | null;
  /** Corrección manual de variante para inventario (admin/partner). */
  inventory_variant_override_enabled?: boolean | null;
  inventory_override_variant_id?: string | null;
};

/** Variante efectiva que debe entrar a inventario: override manual o la original. */
export function effectiveInventoryVariantId(unit: UnitLike): string | null {
  if (unit.inventory_variant_override_enabled && unit.inventory_override_variant_id) {
    return unit.inventory_override_variant_id;
  }
  return unit.core_variant_id ?? null;
}

export type ResolvedVariant = {
  status: "resolved" | "ambiguous" | "not_found";
  variant: VariantRow | null;
  /** true si se resolvió por fallback (sku / talla+color), no por core_variant_id directo */
  recovered: boolean;
  reason?: string;
};

export const VARIANT_SELECT =
  "id, core_product_id, woo_variation_id, variant_sku, woo_sku, size, color, variant_label";

function norm(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^talla\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Resolución pura contra una lista de variantes vivas del mismo producto. */
export function pickVariant(unit: UnitLike, variants: VariantRow[]): ResolvedVariant {
  if (unit.core_variant_id) {
    const direct = variants.find((v) => v.id === unit.core_variant_id);
    if (direct) return { status: "resolved", variant: direct, recovered: false };
  }
  const all = variants.filter((v) => !unit.core_product_id || !v.core_product_id || v.core_product_id === unit.core_product_id);
  if (all.length === 0) {
    return { status: "not_found", variant: null, recovered: false, reason: "El producto no tiene variantes en el catálogo" };
  }

  const sku = norm(unit.variant_sku);
  if (sku) {
    const bySku = all.filter((v) => norm(v.variant_sku) === sku || norm(v.woo_sku) === sku);
    if (bySku.length === 1) return { status: "resolved", variant: bySku[0], recovered: true };
    if (bySku.length > 1) {
      return { status: "ambiguous", variant: null, recovered: false, reason: `Varias variantes con SKU ${unit.variant_sku}` };
    }
  }

  const size = norm(unit.size);
  if (size) {
    let bySize = all.filter((v) => norm(v.size) === size);
    if (bySize.length > 1) {
      const hint = norm(`${unit.variant_label ?? ""} ${unit.variant_sku ?? ""}`);
      const byColor = bySize.filter((v) => v.color && hint.includes(norm(v.color)));
      if (byColor.length === 1) bySize = byColor;
    }
    if (bySize.length === 1) return { status: "resolved", variant: bySize[0], recovered: true };
    if (bySize.length > 1) {
      return {
        status: "ambiguous",
        variant: null,
        recovered: false,
        reason: `Hay ${bySize.length} variantes de talla ${unit.size}; falta el color`,
      };
    }
  }

  return { status: "not_found", variant: null, recovered: false, reason: "No se pudo resolver Woo Variation ID" };
}

/** Resolución con lecturas a base de datos, para una sola unidad (ficha viajera / escaneo). */
export async function resolveUnitVariant(unit: UnitLike): Promise<ResolvedVariant> {
  const effectiveId = effectiveInventoryVariantId(unit);
  if (effectiveId) {
    const { data } = await supabase
      .from("core_product_variants")
      .select(VARIANT_SELECT)
      .eq("id", effectiveId)
      .maybeSingle();
    if (data) return { status: "resolved", variant: data as any, recovered: false };
  }
  if (!unit.core_product_id) {
    return { status: "not_found", variant: null, recovered: false, reason: "Unidad sin producto Core" };
  }
  const { data: allRaw } = await supabase
    .from("core_product_variants")
    .select(VARIANT_SELECT)
    .eq("core_product_id", unit.core_product_id);
  return pickVariant(unit, ((allRaw as any[]) ?? []) as VariantRow[]);
}

/** Persiste el vínculo recuperado en la unidad para que el backend pueda escribir en Woo. */
export async function persistUnitVariantLink(unitId: string, variant: VariantRow): Promise<boolean> {
  const { error } = await supabase
    .from("core_production_units")
    .update({
      core_variant_id: variant.id,
      variant_sku: variant.variant_sku ?? variant.woo_sku ?? undefined,
    })
    .eq("id", unitId);
  return !error;
}
