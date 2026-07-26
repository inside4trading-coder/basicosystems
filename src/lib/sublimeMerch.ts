export type SizeGroup = "franelas_hoodies" | "pantalones" | "custom";

export interface MerchItemLike {
  precio_compra: number | null;
  peso_kg: number | null;
  pvp: number | null;
  sku_web: string | null;
  no_size?: boolean | null;
  unit_count?: number | null;
  size_group?: string | null;
  size_quantities?: Record<string, number> | null;
}

export interface MerchShipmentLike {
  cost_per_kg_eur: number | null;
}

export function getDefaultSizesForGroup(sizeGroup: string | null | undefined): string[] {
  if (sizeGroup === "pantalones") return ["28", "30", "32", "34", "36"];
  if (sizeGroup === "custom") return [];
  return ["S", "M", "L", "XL", "U"];
}

export function normalizeSizeQuantities(
  input: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) {
    const key = String(k).trim();
    if (!key) continue;
    const n = Math.max(0, Math.floor(Number(v ?? 0)));
    if (n > 0) out[key] = n;
  }
  return out;
}

export function calculateTotalUnits(item: MerchItemLike): number {
  if (item.no_size) {
    const n = Math.max(0, Math.floor(Number(item.unit_count ?? 0)));
    return n;
  }
  const q = item.size_quantities ?? {};
  let total = 0;
  for (const v of Object.values(q)) total += Math.max(0, Math.floor(Number(v ?? 0)));
  return total;
}

export function formatSizeSummary(item: MerchItemLike): string {
  const units = calculateTotalUnits(item);
  if (item.no_size) return `Sin talla · ${units} unidad${units === 1 ? "" : "es"}`;
  const q = item.size_quantities ?? {};
  const parts = Object.entries(q)
    .filter(([, v]) => Number(v ?? 0) > 0)
    .map(([k, v]) => `${k}:${v}`);
  if (parts.length === 0) return "Sin cantidades";
  return parts.join(" · ");
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
  item: MerchItemLike,
  shipment?: MerchShipmentLike | null,
): number {
  const precio = Number(item.precio_compra ?? 0);
  const units = Math.max(1, calculateTotalUnits(item));
  return precio * units + calculateShippingCost(item, shipment);
}

export function calculateMargin(
  item: MerchItemLike,
  shipment?: MerchShipmentLike | null,
): number | null {
  if (item.pvp == null) return null;
  const units = Math.max(1, calculateTotalUnits(item));
  return Number(item.pvp) * units - calculateTotalCost(item, shipment);
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

// -----------------------------
// CSV export (Fase 3)
// -----------------------------

export interface CsvItemLike extends MerchItemLike {
  id: string;
  name: string;
  codigo_fabricante: string | null;
  shipment_id: string | null;
  box_id: string | null;
  estado: string;
  subido_al_sistema: boolean;
  uploaded_at: string | null;
  received_at: string | null;
  tax_enabled: boolean;
  tax_amount: number;
  notas: string | null;
  fotos_origen: string[];
  fotos_web: string[];
}

export interface CsvShipmentLike extends MerchShipmentLike {
  id: string;
  shipment_number: string;
  sent_at: string | null;
}

export interface CsvBoxLike {
  id: string;
  box_number: string;
  shipment_id: string;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const CSV_COLUMNS = [
  "sku_web",
  "nombre",
  "codigo_fabricante",
  "size_group",
  "no_size",
  "unit_count",
  "total_units",
  "tallas_resumen",
  "size_quantities",
  "precio_compra",
  "precio_compra_total",
  "peso_kg",
  "cost_per_kg_eur",
  "shipping_cost_eur",
  "costo_total",
  "pvp",
  "margen_estimado",
  "shipment_number",
  "box_number",
  "sent_at",
  "received_at",
  "estado",
  "subido_al_sistema",
  "uploaded_at",
  "tax_enabled",
  "tax_amount",
  "notas",
  "fotos_origen_count",
  "fotos_web_count",
] as const;

export function buildSublimeMerchCsv(
  items: CsvItemLike[],
  shipments: CsvShipmentLike[],
  boxes: CsvBoxLike[],
): string {
  const shipMap = new Map<string, CsvShipmentLike>();
  for (const s of shipments) shipMap.set(s.id, s);
  const boxMap = new Map<string, CsvBoxLike>();
  for (const b of boxes) boxMap.set(b.id, b);

  const rows: string[] = [CSV_COLUMNS.join(",")];
  for (const it of items) {
    const ship = it.shipment_id ? shipMap.get(it.shipment_id) ?? null : null;
    const box = it.box_id ? boxMap.get(it.box_id) ?? null : null;
    const shipping = calculateShippingCost(it, ship);
    const total = calculateTotalCost(it, ship);
    const margin = calculateMargin(it, ship);
    const units = calculateTotalUnits(it);
    const precioTotal = Number(it.precio_compra ?? 0) * Math.max(1, units);
    const row = [
      it.sku_web ?? "",
      it.name ?? "",
      it.codigo_fabricante ?? "",
      it.size_group ?? "",
      it.no_size ? "true" : "false",
      String(it.unit_count ?? 0),
      String(units),
      formatSizeSummary(it),
      JSON.stringify(it.size_quantities ?? {}),
      Number(it.precio_compra ?? 0).toFixed(2),
      precioTotal.toFixed(2),
      Number(it.peso_kg ?? 0).toFixed(3),
      ship?.cost_per_kg_eur != null ? Number(ship.cost_per_kg_eur).toFixed(2) : "",
      shipping.toFixed(2),
      total.toFixed(2),
      it.pvp != null ? Number(it.pvp).toFixed(2) : "",
      margin != null ? margin.toFixed(2) : "",
      ship?.shipment_number ?? "",
      box?.box_number ?? "",
      ship?.sent_at ?? "",
      it.received_at ?? "",
      it.estado ?? "",
      it.subido_al_sistema ? "true" : "false",
      it.uploaded_at ?? "",
      it.tax_enabled ? "true" : "false",
      Number(it.tax_amount ?? 0).toFixed(2),
      it.notas ?? "",
      String(it.fotos_origen?.length ?? 0),
      String(it.fotos_web?.length ?? 0),
    ].map(csvEscape);
    rows.push(row.join(","));
  }
  return rows.join("\r\n");
}

export function downloadSublimeMerchCsv(
  items: CsvItemLike[],
  shipments: CsvShipmentLike[],
  boxes: CsvBoxLike[],
): void {
  const csv = buildSublimeMerchCsv(items, shipments, boxes);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `sublime-mercancia-costos_${d}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
