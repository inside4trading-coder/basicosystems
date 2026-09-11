/**
 * PREPARACIÓN COMERCIAL SUBLIME
 *
 * Dos conceptos SEPARADOS:
 *  - "Preparación web": qué falta para publicar el producto (título, descripción,
 *    imágenes, categoría/marca, SKU, precio, tallas).
 *  - "Listo para POS": si la variante puede venderse hoy en tienda física.
 *
 * La preparación web NUNCA bloquea la venta física.
 */

import { isValidSku } from "@/lib/sublimeSku";
import type { SublimeInvProduct, SublimeInvVariant } from "@/lib/sublimeInventory";
import type { PreparationStatus } from "@/types/sublimeHub";

export type PrepKey = "price" | "variants" | "sku" | "title" | "description" | "images";

export const PREP_CHECKLIST: { key: PrepKey; label: string }[] = [
  { key: "price", label: "Precio" },
  { key: "variants", label: "Tallas/variantes" },
  { key: "sku", label: "SKU" },
  { key: "title", label: "Título" },
  { key: "description", label: "Descripción" },
  { key: "images", label: "Imágenes web" },
];

export interface PrepInput {
  product: Pick<SublimeInvProduct, "name" | "notes" | "main_image_url">;
  variants: Pick<SublimeInvVariant, "sku" | "size" | "current_price_ref">[];
}

export function prepDone(input: PrepInput): Record<PrepKey, boolean> {
  const vs = input.variants;
  return {
    price: vs.length > 0 && vs.every((v) => Number(v.current_price_ref ?? 0) > 0),
    variants: vs.length > 0 && vs.every((v) => !!v.size),
    sku: vs.length > 0 && vs.every((v) => isValidSku(v.sku)),
    title: !!input.product.name?.trim(),
    description: !!input.product.notes?.trim(),
    images: !!input.product.main_image_url?.trim(),
  };
}

export function prepPercent(input: PrepInput): number {
  const done = prepDone(input);
  const total = PREP_CHECKLIST.length;
  const ok = PREP_CHECKLIST.filter((c) => done[c.key]).length;
  return Math.round((ok / total) * 100);
}

/** Estado de preparación derivado del avance real y de la publicación en Woo. */
export function prepStatus(pct: number, publishedInWoo: boolean): PreparationStatus {
  if (publishedInWoo) return "published";
  if (pct >= 100) return "ready";
  if (pct <= 0) return "not_started";
  return "in_progress";
}
