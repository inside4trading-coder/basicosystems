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

/** Datos que faltan por completar (independiente del stock). */
export function missingFields(args: {
  product: Pick<SublimeInvProduct, "category" | "main_image_url">;
  variant: Pick<SublimeInvVariant, "sku" | "color" | "current_price_ref">;
}): string[] {
  const out: string[] = [];
  if (!args.variant.sku) out.push("SKU");
  if (!args.variant.color) out.push("Color");
  if (!args.product.category) out.push("Categoría");
  if (!(Number(args.variant.current_price_ref ?? 0) > 0)) out.push("Precio");
  if (!args.product.main_image_url) out.push("Imagen");
  return out;
}
