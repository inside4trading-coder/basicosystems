// Resolver visual del costo estratégico (no operativo).
// Orden: variante override > estructura base > política.manual > proveedor externo > core_products.manual (espejo) > core_products.unit_cost > 0

export type CostSource =
  | "variant_override"
  | "product_base_structure"
  | "policy_manual"
  | "external_supplier"
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
  externalSupplierCost?: number | null;
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
  const ext = c(input.externalSupplierCost);
  if (ext !== null) return { amount: ext, source: "external_supplier", hasWarning: false, label: "Proveedor externo (ref.)" };
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
  replaced: "Reemplazado",
  archived: "Archivado",
  ignored: "Ignorado",
};

// Rutas operativas seleccionables en "Ruta de reposición".
export const ROUTE_LABELS: Record<string, string> = {
  internal_factory: "Fabricación interna",
  external_supplier: "Proveedor externo",
  manual_cost_only: "Solo costo manual",
  none: "Sin ruta",
};

// Todas las rutas persistidas históricamente (incluye rutas de bloqueo).
export const ROUTE_LABELS_ALL: Record<string, string> = {
  ...ROUTE_LABELS,
  no_restock: "No restock",
  exit: "En salida",
  ignored: "Ignorado",
  replaced: "Reemplazado",
};

export function routeLabel(route?: string | null): string {
  const key = route ?? "internal_factory";
  return ROUTE_LABELS_ALL[key] ?? key;
}

// Política de reposición: concepto separado del Lifecycle comercial.
export const REPLENISHMENT_POLICY_LABELS: Record<string, string> = {
  restock: "Restock / Reposición",
  no_restock: "No restock",
  exit: "En salida",
  replaced: "Reemplazado",
};

export type ReplenishmentPolicyChoice = "restock" | "no_restock" | "exit" | "replaced";

/** Deriva la política de reposición efectiva a partir de lifecycle + ruta + restock_enabled. */
export function resolvePolicyChoice(p?: {
  lifecycle_status?: string | null;
  restock_enabled?: boolean | null;
  replenishment_route?: string | null;
  replacement_product_id?: string | null;
  replacement_woo_product_id?: number | null;
} | null): ReplenishmentPolicyChoice {
  const lc = p?.lifecycle_status ?? "active";
  if (lc === "replaced") return "replaced";
  if (lc === "exit") return "exit";
  if (lc === "no_restock" || lc === "ignored" || lc === "archived") return "no_restock";
  const route = p?.replenishment_route ?? "internal_factory";
  if (["no_restock", "none", "ignored", "exit", "replaced"].includes(route)) return "no_restock";
  if (p?.restock_enabled === false) return "no_restock";
  if (p?.replacement_product_id || p?.replacement_woo_product_id) return "replaced";
  return "restock";
}

export function policyChoiceLabel(p?: Parameters<typeof resolvePolicyChoice>[0]): string {
  return REPLENISHMENT_POLICY_LABELS[resolvePolicyChoice(p)];
}


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
