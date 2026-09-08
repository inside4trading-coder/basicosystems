/**
 * Clasificación y matching Woo ↔ Inventario Maestro Sublime.
 * Funciones puras. Nunca fusionan: solo proponen.
 *
 * Prioridad:
 *  1. saved_id  → woo_product_id / woo_variation_id ya guardados (mapping o columnas espejo)
 *  2. sku       → SKU exacto
 *  3. reference → barcode / código de fabricante del lote
 *  4. name      → nombre + talla + color normalizados (solo sugerencia)
 */
import {
  normalizeName,
  type SublimeChannelMapping,
  type SublimeInvProduct,
  type SublimeInvVariant,
  type SublimeWooCatalogRow,
} from "./sublimeInventory";

export type WooMapStatus = "mapped" | "possible" | "unmapped" | "incomplete" | "ignored";
export const WOO_MAP_STATUS_LABEL: Record<WooMapStatus, string> = {
  mapped: "Mapeado",
  possible: "Posible coincidencia",
  unmapped: "Sin mapear",
  incomplete: "Incompleto",
  ignored: "Ignorado",
};

export type MatchMethod = "saved_id" | "sku" | "reference" | "name";

export interface WooCandidate {
  variant: SublimeInvVariant;
  product: SublimeInvProduct;
  method: MatchMethod;
}

export interface WooClassified {
  row: SublimeWooCatalogRow;
  status: WooMapStatus;
  mapping: SublimeChannelMapping | null;
  /** Variante del Hub ya vinculada (si hay mapping). */
  linked: { variant: SublimeInvVariant | null; product: SublimeInvProduct | null } | null;
  candidates: WooCandidate[];
}

export interface HubIndex {
  products: SublimeInvProduct[];
  variants: SublimeInvVariant[];
  mappings: SublimeChannelMapping[];
  /** referencias externas conocidas por variante (barcode, código de fabricante) */
  references?: Map<string, string[]>;
  /** variantes que NO cumplen mínimos operativos */
  incompleteVariantIds?: Set<string>;
}

export function mappingKey(productId: number, variationId: number | null | undefined): string {
  return `${productId}|${variationId ?? 0}`;
}

export function classifyWooCatalog(rows: SublimeWooCatalogRow[], hub: HubIndex): WooClassified[] {
  const productById = new Map(hub.products.map((p) => [p.id, p]));
  const variantById = new Map(hub.variants.map((v) => [v.id, v]));
  const mappingByKey = new Map(
    hub.mappings.filter((m) => m.channel === "woo").map((m) => [mappingKey(m.external_product_id, m.external_variation_id), m])
  );
  const variantBySku = new Map<string, SublimeInvVariant>();
  for (const v of hub.variants) if (v.sku?.trim()) variantBySku.set(v.sku.trim().toLowerCase(), v);
  const variantByBarcode = new Map<string, SublimeInvVariant>();
  for (const v of hub.variants) if (v.barcode?.trim()) variantByBarcode.set(v.barcode.trim().toLowerCase(), v);
  const variantByRef = new Map<string, SublimeInvVariant>();
  for (const [vid, refs] of hub.references ?? []) {
    const v = variantById.get(vid);
    if (!v) continue;
    for (const r of refs) if (r?.trim()) variantByRef.set(r.trim().toLowerCase(), v);
  }
  const variantBySavedWooId = new Map<number, SublimeInvVariant>();
  for (const v of hub.variants as (SublimeInvVariant & { woo_variation_id?: number | null })[]) {
    if (v.woo_variation_id) variantBySavedWooId.set(Number(v.woo_variation_id), v);
  }
  const productBySavedWooId = new Map<number, SublimeInvProduct>();
  for (const p of hub.products) if (p.woo_product_id) productBySavedWooId.set(Number(p.woo_product_id), p);

  const toCandidate = (variant: SublimeInvVariant, method: MatchMethod): WooCandidate | null => {
    const product = productById.get(variant.product_id);
    return product ? { variant, product, method } : null;
  };

  return rows.map((row) => {
    const key = mappingKey(row.woo_product_id, row.woo_variation_id);
    const mapping = mappingByKey.get(key) ?? null;

    if (mapping?.status === "ignored") {
      return { row, status: "ignored", mapping, linked: null, candidates: [] };
    }
    if (mapping?.status === "mapped") {
      const variant = mapping.variant_id ? variantById.get(mapping.variant_id) ?? null : null;
      const product =
        (variant ? productById.get(variant.product_id) : null) ??
        (mapping.product_id ? productById.get(mapping.product_id) ?? null : null);
      const incomplete = variant ? hub.incompleteVariantIds?.has(variant.id) ?? false : true;
      return { row, status: incomplete ? "incomplete" : "mapped", mapping, linked: { variant, product }, candidates: [] };
    }

    const candidates: WooCandidate[] = [];
    const seen = new Set<string>();
    const push = (v: SublimeInvVariant | undefined | null, m: MatchMethod) => {
      if (!v || seen.has(v.id)) return;
      const c = toCandidate(v, m);
      if (c) { candidates.push(c); seen.add(v.id); }
    };

    // 1. IDs guardados en columnas espejo
    if (row.woo_variation_id) push(variantBySavedWooId.get(row.woo_variation_id), "saved_id");
    if (!row.woo_variation_id) {
      const p = productBySavedWooId.get(row.woo_product_id);
      if (p) {
        const vs = hub.variants.filter((v) => v.product_id === p.id);
        if (vs.length === 1) push(vs[0], "saved_id");
      }
    }
    // 2. SKU exacto
    if (row.sku?.trim()) push(variantBySku.get(row.sku.trim().toLowerCase()), "sku");
    // 3. Referencias conocidas
    if (row.sku?.trim()) {
      push(variantByBarcode.get(row.sku.trim().toLowerCase()), "reference");
      push(variantByRef.get(row.sku.trim().toLowerCase()), "reference");
    }
    // 4. Nombre + talla + color (solo sugerencia)
    const nameKey = normalizeName(row.name);
    const sizeKey = normalizeName(row.size_label);
    const colorKey = normalizeName(row.color_label);
    for (const v of hub.variants) {
      const p = productById.get(v.product_id);
      if (!p) continue;
      if (normalizeName(p.name) !== nameKey) continue;
      if (sizeKey && normalizeName(v.size) !== sizeKey) continue;
      if (colorKey && v.color && normalizeName(v.color) !== colorKey) continue;
      push(v, "name");
      if (candidates.length >= 5) break;
    }

    return { row, status: candidates.length ? "possible" : "unmapped", mapping: null, linked: null, candidates };
  });
}

export const MATCH_METHOD_LABEL: Record<MatchMethod, string> = {
  saved_id: "ID guardado",
  sku: "SKU exacto",
  reference: "Referencia",
  name: "Nombre/atributos",
};

/** Traduce el método de sugerencia al valor persistible del mapping. */
export function persistedMethod(m: MatchMethod): SublimeChannelMapping["match_method"] {
  return m === "name" ? "manual" : m;
}
