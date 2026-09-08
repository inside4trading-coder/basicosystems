/**
 * INVENTARIO MAESTRO SUBLIME V1
 *
 * Capas separadas y no intercambiables:
 *  - PRODUCTO      → lo que vendemos
 *  - VARIANTE      → la combinación vendible (aquí vive el SKU y el precio)
 *  - STOCK         → existencias por ubicación
 *  - LOTE          → de qué compra de Abastecimiento vino y cuánto costó
 *
 * Un artículo de Abastecimiento es una COMPRA/LOTE, nunca un producto maestro.
 */

export const SIZE_UNIQUE = "Única";

export interface SublimeInvLocation {
  id: string;
  name: string;
  code: string;
  type: string;
  is_active: boolean;
  sells_in_pos: boolean;
  notes: string | null;
}

export interface SublimeInvProduct {
  id: string;
  name: string;
  brand: string;
  category: string | null;
  product_type: string | null;
  main_image_url: string | null;
  is_active: boolean;
  notes: string | null;
  woo_product_id: number | null;
}

export interface SublimeInvVariant {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  sku: string | null;
  barcode: string | null;
  full_price_ref: number | null;
  current_price_ref: number | null;
  discount_pct: number | null;
  is_active: boolean;
  pos_enabled: boolean;
  cost_ref: number | null;
  cost_source: CostSource | null;
  cost_note: string | null;
}

/** Fila espejo del catálogo Woo (solo lectura, nunca fuente de verdad). */
export interface SublimeWooCatalogRow {
  id: string;
  woo_product_id: number;
  woo_variation_id: number | null;
  parent_id: number | null;
  woo_type: string | null;
  name: string;
  sku: string | null;
  size_label: string | null;
  color_label: string | null;
  price: number | null;
  regular_price: number | null;
  stock_quantity: number | null;
  stock_status: string | null;
  woo_status: string | null;
  image_url: string | null;
  permalink: string | null;
  last_read_at: string;
}

export interface SublimeChannelMapping {
  id: string;
  channel: string;
  product_id: string | null;
  variant_id: string | null;
  external_product_id: number;
  external_variation_id: number | null;
  status: "mapped" | "ignored";
  match_method: "saved_id" | "sku" | "reference" | "manual";
  mapped_at: string;
  note: string | null;
}

export interface SublimeInvStock {
  id: string;
  variant_id: string;
  location_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  last_counted_at: string | null;
}

export interface SublimeInvLot {
  id: string;
  variant_id: string;
  merch_item_id: string;
  size: string | null;
  qty_from_lot: number;
  unit_cost_ref: number | null;
  shipment_id: string | null;
  is_consignment: boolean;
  consignment_commission_pct: number | null;
  consignment_commission_amount: number | null;
}

export interface SublimeInvProposal {
  id: string;
  variant_id: string;
  location_id: string;
  suggested_qty: number;
  counted_qty: number | null;
  status: "pending" | "confirmed" | "discarded";
  source_merch_item_id: string | null;
  note: string | null;
  confirmed_at: string | null;
}

/** Nombre normalizado: sin acentos, minúsculas, espacios colapsados. */
export function normalizeName(name: string | null | undefined): string {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function variantDisplay(v: Pick<SublimeInvVariant, "size" | "color">): string {
  const parts = [v.size || "Talla pendiente", v.color || "Color pendiente"];
  return parts.join(" · ");
}

// ---------------------------------------------------------------
// Listo para POS
// ---------------------------------------------------------------

export type PosBlockReason =
  | "product_inactive"
  | "variant_inactive"
  | "no_sku"
  | "no_price"
  | "bad_price"
  | "no_category"
  | "no_size"
  | "no_stock";

export const POS_BLOCK_LABEL: Record<PosBlockReason, string> = {
  product_inactive: "Producto inactivo",
  variant_inactive: "Variante inactiva",
  no_sku: "Sin SKU",
  no_price: "Sin precio",
  bad_price: "Precio full menor al vigente",
  no_category: "Sin categoría",
  no_size: "Sin talla",
  no_stock: "Sin stock confirmado en tienda",
};

/**
 * Condiciones para que una variante sea vendible en el POS.
 * La imagen NO es requisito: si falta se muestra un marcador de posición.
 */
export function posBlockers(args: {
  product: Pick<SublimeInvProduct, "is_active" | "category">;
  variant: Pick<SublimeInvVariant, "is_active" | "sku" | "size" | "full_price_ref" | "current_price_ref">;
  posStock: number;
}): PosBlockReason[] {
  const { product, variant, posStock } = args;
  const out: PosBlockReason[] = [];
  if (!product.is_active) out.push("product_inactive");
  if (!variant.is_active) out.push("variant_inactive");
  if (!variant.sku || !variant.sku.trim()) out.push("no_sku");
  const current = Number(variant.current_price_ref ?? 0);
  if (!(current > 0)) out.push("no_price");
  const full = variant.full_price_ref == null ? null : Number(variant.full_price_ref);
  if (full != null && current > 0 && full < current) out.push("bad_price");
  if (!product.category) out.push("no_category");
  if (!variant.size) out.push("no_size");
  if (!(posStock > 0)) out.push("no_stock");
  return out;
}

export function isPosReady(args: Parameters<typeof posBlockers>[0]): boolean {
  return posBlockers(args).length === 0;
}

export type CostSource = "abastecimiento" | "historico_manual" | "estimado" | "consignacion" | "otro";
export const COST_SOURCE_LABEL: Record<CostSource, string> = {
  abastecimiento: "Abastecimiento",
  historico_manual: "Histórico manual",
  estimado: "Estimado",
  consignacion: "Consignación",
  otro: "Otro",
};

export type MissingField =
  | "SKU" | "Color" | "Categoría" | "Precio" | "Imagen" | "Talla"
  | "Costo" | "Ubicación" | "Stock validado" | "Mapeo Woo";

/**
 * Datos que faltan por completar. Los últimos cuatro son opcionales porque
 * dependen de tablas que no siempre están cargadas.
 */
export function missingFields(args: {
  product: Pick<SublimeInvProduct, "category" | "main_image_url">;
  variant: Pick<SublimeInvVariant, "sku" | "color" | "size" | "current_price_ref"> & Partial<Pick<SublimeInvVariant, "cost_ref">>;
  hasLocation?: boolean;
  hasValidatedStock?: boolean;
  hasWooMapping?: boolean;
}): MissingField[] {
  const out: MissingField[] = [];
  if (!args.variant.sku) out.push("SKU");
  if (!args.variant.size) out.push("Talla");
  if (!args.variant.color) out.push("Color");
  if (!args.product.category) out.push("Categoría");
  if (!(Number(args.variant.current_price_ref ?? 0) > 0)) out.push("Precio");
  if (!args.product.main_image_url) out.push("Imagen");
  if ("cost_ref" in args.variant && !(Number(args.variant.cost_ref ?? 0) > 0)) out.push("Costo");
  if (args.hasLocation === false) out.push("Ubicación");
  if (args.hasValidatedStock === false) out.push("Stock validado");
  if (args.hasWooMapping === false) out.push("Mapeo Woo");
  return out;
}

// ---------------------------------------------------------------
// Completitud
// ---------------------------------------------------------------

export type Completeness = "incomplete" | "operational" | "financial";
export const COMPLETENESS_LABEL: Record<Completeness, string> = {
  incomplete: "Incompleta",
  operational: "Operativa",
  financial: "Financiera",
};

/**
 * Operativa: producto + variante + SKU + precio válido + stock confirmado en
 * alguna ubicación. Financiera: además costo válido con origen declarado.
 */
export function completeness(args: {
  variant: Pick<SublimeInvVariant, "sku" | "size" | "current_price_ref" | "full_price_ref" | "cost_ref" | "cost_source">;
  hasValidatedStock: boolean;
}): Completeness {
  const v = args.variant;
  const current = Number(v.current_price_ref ?? 0);
  const full = v.full_price_ref == null ? null : Number(v.full_price_ref);
  const priceOk = current > 0 && (full == null || full >= current);
  const operational = !!v.sku?.trim() && !!v.size && priceOk && args.hasValidatedStock;
  if (!operational) return "incomplete";
  const costOk = Number(v.cost_ref ?? 0) > 0 && !!v.cost_source;
  return costOk ? "financial" : "operational";
}
