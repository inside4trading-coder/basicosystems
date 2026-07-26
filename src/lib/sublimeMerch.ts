export interface MerchItemLike {
  precio_compra: number | null;
  peso_kg: number | null;
  pvp: number | null;
  sku_web: string | null;
}

export interface MerchShipmentLike {
  cost_per_kg_eur: number | null;
}

export function calculateShippingCost(
  item: Pick<MerchItemLike, "peso_kg">,
  shipment?: MerchShipmentLike | null,
): number {
  const peso = Number(item.peso_kg ?? 0);
  const rate = Number(shipment?.cost_per_kg_eur ?? 0);
  return peso * rate;
}

export function calculateTotalCost(
  item: Pick<MerchItemLike, "precio_compra" | "peso_kg">,
  shipment?: MerchShipmentLike | null,
): number {
  const precio = Number(item.precio_compra ?? 0);
  return precio + calculateShippingCost(item, shipment);
}

export function calculateMargin(
  item: MerchItemLike,
  shipment?: MerchShipmentLike | null,
): number | null {
  if (item.pvp == null) return null;
  return Number(item.pvp) - calculateTotalCost(item, shipment);
}

export type UploadValidation = {
  ok: boolean;
  reason?: "missing_sku" | "missing_pvp";
  message?: string;
};

export function canMarkUploaded(item: MerchItemLike): UploadValidation {
  if (!item.sku_web || !item.sku_web.trim()) {
    return {
      ok: false,
      reason: "missing_sku",
      message:
        "Debes asignar un SKU web antes de marcar este producto como subido al sistema.",
    };
  }
  if (item.pvp == null || Number.isNaN(Number(item.pvp))) {
    return {
      ok: false,
      reason: "missing_pvp",
      message:
        "Debes asignar un PVP antes de marcar este producto como subido al sistema.",
    };
  }
  return { ok: true };
}

export const MERCH_ESTADOS = [
  "purchased",
  "in_transit",
  "received",
  "available",
  "cancelled",
] as const;

export type MerchEstado = (typeof MERCH_ESTADOS)[number];

export const MERCH_ESTADO_LABEL: Record<MerchEstado, string> = {
  purchased: "Comprado",
  in_transit: "En camino",
  received: "Recibido",
  available: "Disponible",
  cancelled: "Cancelado",
};

// -----------------------------
// Photos (Fase 1.5)
// -----------------------------

import { supabase } from "@/integrations/supabase/client";

export const SUBLIME_MERCH_BUCKET = "sublime-merch";
export const PHOTO_ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const STORAGE_PREFIX = "sb:";

export type PhotoType = "origen" | "web";

export function isStoragePath(url: string): boolean {
  return url.startsWith(STORAGE_PREFIX);
}

export function stripStoragePrefix(url: string): string {
  return url.startsWith(STORAGE_PREFIX) ? url.slice(STORAGE_PREFIX.length) : url;
}

const signedUrlCache = new Map<string, { url: string; exp: number }>();

export async function resolvePhotoUrl(url: string): Promise<string> {
  if (!isStoragePath(url)) return url;
  const path = stripStoragePrefix(url);
  const cached = signedUrlCache.get(path);
  const now = Date.now();
  if (cached && cached.exp > now + 60_000) return cached.url;
  const { data, error } = await supabase.storage
    .from(SUBLIME_MERCH_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return "";
  signedUrlCache.set(path, { url: data.signedUrl, exp: now + 55 * 60 * 1000 });
  return data.signedUrl;
}

export function validatePhotoFile(file: File): { ok: boolean; message?: string } {
  if (!PHOTO_ACCEPTED_MIME.includes(file.type)) {
    return { ok: false, message: "Solo puedes subir imágenes JPG, PNG o WEBP." };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return { ok: false, message: "La imagen supera el límite de 10 MB." };
  }
  return { ok: true };
}

export function validatePhotoUrl(url: string): { ok: boolean; message?: string } {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, message: "URL de imagen inválida." };
  }
  return { ok: true };
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function uploadSublimeMerchPhoto(
  itemId: string,
  type: PhotoType,
  file: File,
): Promise<string> {
  const check = validatePhotoFile(file);
  if (!check.ok) throw new Error(check.message);
  const ext = extForMime(file.type);
  const path = `${type}/${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(SUBLIME_MERCH_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return `${STORAGE_PREFIX}${path}`;
}

export async function deleteSublimeMerchPhotoFromStorage(url: string): Promise<void> {
  if (!isStoragePath(url)) return;
  const path = stripStoragePrefix(url);
  await supabase.storage.from(SUBLIME_MERCH_BUCKET).remove([path]);
}

export async function downloadPhoto(url: string, filename?: string): Promise<void> {
  const resolved = await resolvePhotoUrl(url);
  if (!resolved) return;
  try {
    const res = await fetch(resolved);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename ?? resolved.split("/").pop()?.split("?")[0] ?? "foto.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  } catch {
    window.open(resolved, "_blank");
  }
}

export async function copyPhotoUrl(url: string): Promise<void> {
  const resolved = await resolvePhotoUrl(url);
  await navigator.clipboard.writeText(resolved || url);
}
