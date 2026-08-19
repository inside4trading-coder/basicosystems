// Resolución tolerante de la variante Core viva de una unidad de producción.
// Motivo: históricamente al guardar un producto se borraban e insertaban de nuevo todas
// sus variantes, dejando unidades con core_variant_id inexistente y por tanto sin
// woo_variation_id para ingresar a inventario.
import { supabase } from "@/integrations/supabase/client";

export type ResolvedVariant = {
  status: "resolved" | "ambiguous" | "not_found";
  variant: {
    id: string;
    woo_variation_id: number | null;
    variant_sku: string | null;
    woo_sku: string | null;
    size: string | null;
    color: string | null;
    variant_label: string | null;
  } | null;
  /** true si se resolvió por fallback (sku / talla+color), no por core_variant_id directo */
  recovered: boolean;
  reason?: string;
};

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

const SELECT = "id, core_product_id, woo_variation_id, variant_sku, woo_sku, size, color, variant_label";

export async function resolveUnitVariant(unit: {
  core_product_id: string | null;
  core_variant_id: string | null;
  variant_sku?: string | null;
  size?: string | null;
  variant_label?: string | null;
}): Promise<ResolvedVariant> {
  // 1) por core_variant_id
  if (unit.core_variant_id) {
    const { data } = await supabase
      .from("core_product_variants")
      .select(SELECT)
      .eq("id", unit.core_variant_id)
      .maybeSingle();
    if (data) return { status: "resolved", variant: data as any, recovered: false };
  }

  if (!unit.core_product_id) {
    return { status: "not_found", variant: null, recovered: false, reason: "Unidad sin producto Core" };
  }

  const { data: allRaw } = await supabase
    .from("core_product_variants")
    .select(SELECT)
    .eq("core_product_id", unit.core_product_id);
  const all = ((allRaw as any[]) ?? []) as NonNullable<ResolvedVariant["variant"]>[];
  if (all.length === 0) {
    return { status: "not_found", variant: null, recovered: false, reason: "El producto no tiene variantes en el catálogo" };
  }

  // 2) por SKU de variante
  const sku = norm(unit.variant_sku);
  if (sku) {
    const bySku = all.filter((v) => norm(v.variant_sku) === sku || norm(v.woo_sku) === sku);
    if (bySku.length === 1) return { status: "resolved", variant: bySku[0], recovered: true };
    if (bySku.length > 1) {
      return { status: "ambiguous", variant: null, recovered: false, reason: `Varias variantes con SKU ${unit.variant_sku}` };
    }
  }

  // 3) por talla (+ color deducido de la etiqueta / SKU)
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
