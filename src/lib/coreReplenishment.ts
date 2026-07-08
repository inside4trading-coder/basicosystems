// Resolver visual del costo estratégico (no operativo).
// Orden: variante override > estructura base > política.manual > core_products.manual (espejo) > core_products.unit_cost > 0

export type CostSource =
  | "variant_override"
  | "product_base_structure"
  | "policy_manual"
  | "product_manual_mirror"
  | "product_unit_cost"
  | "zero_fallback";

export interface CostResolution {
  amount: number;
  source: CostSource;
  hasWarning: boolean;
  label: string;
}

export function resolveDisplayCost(input: {
  variantOverrideCost?: number | null;
  productBaseStructureCost?: number | null;
  policyManualCost?: number | null;
  productManualMirrorCost?: number | null;
  productUnitCost?: number | null;
}): CostResolution {
  const c = (v?: number | null) => (typeof v === "number" && !isNaN(v) && v > 0 ? v : null);
  const v = c(input.variantOverrideCost);
  if (v !== null) return { amount: v, source: "variant_override", hasWarning: false, label: "Override variante" };
  const b = c(input.productBaseStructureCost);
  if (b !== null) return { amount: b, source: "product_base_structure", hasWarning: false, label: "Estructura base" };
  const pm = c(input.policyManualCost);
  if (pm !== null) return { amount: pm, source: "policy_manual", hasWarning: false, label: "Costo manual (política)" };
  const pmm = c(input.productManualMirrorCost);
  if (pmm !== null) return { amount: pmm, source: "product_manual_mirror", hasWarning: false, label: "Costo manual (espejo)" };
  const pu = c(input.productUnitCost);
  if (pu !== null) return { amount: pu, source: "product_unit_cost", hasWarning: false, label: "Costo unitario producto" };
  return { amount: 0, source: "zero_fallback", hasWarning: true, label: "Sin costo (fallback 0)" };
}

export const LIFECYCLE_LABELS: Record<string, string> = {
  active: "Activo",
  no_restock: "No restock",
  exit: "En salida",
  archived: "Archivado",
  ignored: "Ignorado",
};

export const ROUTE_LABELS: Record<string, string> = {
  internal_factory: "Fabricación interna",
  external_supplier: "Proveedor externo",
  manual_cost_only: "Solo costo manual",
  none: "Sin ruta",
};

export const BRAND_ROLE_LABELS: Record<string, string> = {
  core: "Core",
  regular: "Regular",
  candidate: "Candidato",
};

export const REPLACEMENT_BEHAVIOR_LABELS: Record<string, string> = {
  suggest_only: "Solo sugerir",
  use_on_restock_with_confirmation: "Usar en reposición (confirmar)",
  block_and_suggest: "Bloquear y sugerir",
  ignore: "Ignorar",
};

export const MAPPING_STATUS_LABELS: Record<string, string> = {
  unmapped: "Sin conexión",
  mapped: "Conectado",
  ignored: "Ignorado",
  needs_review: "Revisar",
};

export const VARIANT_SYNC_LABELS: Record<string, string> = {
  not_synced: "No sincronizado",
  synced: "Sincronizado",
  partial: "Parcial",
  not_applicable: "No aplica",
};
