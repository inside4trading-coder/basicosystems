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
  product_type?: string | null;
  use_manual_pvp?: boolean | null;
  pvp_manual?: number | null;
  is_consignment?: boolean | null;
  consignment_commission_pct?: number | null;
  consignment_commission_amount?: number | null;
}

export interface PricingRuleLike {
  product_type: string;
  label: string;
  profit_percentage: number;
  active?: boolean;
}

export const IVA_RATE = 0.16;

export const FALLBACK_PRICING_RULES: PricingRuleLike[] = [
  { product_type: "franelas_hoodies", label: "Franelas / Hoodies", profit_percentage: 100, active: true },
  { product_type: "pantalones", label: "Pantalones", profit_percentage: 100, active: true },
  { product_type: "chaquetas", label: "Chaquetas", profit_percentage: 100, active: true },
  { product_type: "zapatos", label: "Zapatos", profit_percentage: 100, active: true },
  { product_type: "gorras", label: "Gorras", profit_percentage: 100, active: true },
  { product_type: "accesorios", label: "Accesorios", profit_percentage: 100, active: true },
  { product_type: "otros", label: "Otros", profit_percentage: 100, active: true },
];

export function slugifyProductType(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function findPricingRule(
  rules: PricingRuleLike[] | null | undefined,
  productType: string | null | undefined,
): PricingRuleLike | null {
  if (!productType) return null;
  const list = rules && rules.length ? rules : FALLBACK_PRICING_RULES;
  return list.find((r) => r.product_type === productType) ?? null;
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

export function calculatePurchaseTotal(item: MerchItemLike): number {
  const precio = Number(item.precio_compra ?? 0);
  const units = Math.max(1, calculateTotalUnits(item));
  return precio * units;
}

export function calculateSuggestedBasePvp(cost: number, profitPercentage: number): number {
  const pct = Number(profitPercentage ?? 0);
  return Number(cost ?? 0) * (1 + pct / 100);
}

export function calculateIvaAmount(basePvp: number, ivaRate: number = IVA_RATE): number {
  return Number(basePvp ?? 0) * Number(ivaRate ?? 0);
}

export function calculateSuggestedFinalPvp(cost: number, profitPercentage: number): number {
  const base = calculateSuggestedBasePvp(cost, profitPercentage);
  return base + calculateIvaAmount(base);
}

/** Base PVP (per unit): precio sugerido/manual sin la participación de SUBLIME. */
export function getBasePvp(
  item: MerchItemLike,
  rule?: PricingRuleLike | null,
  shipment?: MerchShipmentLike | null,
): number | null {
  if (item.use_manual_pvp) {
    const m = item.pvp_manual != null ? Number(item.pvp_manual) : item.pvp != null ? Number(item.pvp) : null;
    if (m == null || Number.isNaN(m) || m <= 0) return null;
    return m;
  }
  const cost = calculateTotalCost(item, shipment);
  const units = Math.max(1, calculateTotalUnits(item));
  const perUnitCost = cost / units;
  const pct = rule ? Number(rule.profit_percentage ?? 0) : 0;
  const suggested = calculateSuggestedFinalPvp(perUnitCost, pct);
  return suggested > 0 ? suggested : null;
}

function consignmentPct(item: MerchItemLike): number {
  if (!item.is_consignment) return 0;
  // Clamp: 100% haría infinito el PVP final.
  return Math.min(99.99, Math.max(0, Number(item.consignment_commission_pct ?? 0)));
}

/**
 * Final PVP (per unit) aplicado al item.
 * En consignación, la comisión es un porcentaje DEL PVP FINAL:
 *   PVP final = PVP base / (1 - pct)
 */
export function getFinalPvp(
  item: MerchItemLike,
  rule?: PricingRuleLike | null,
  shipment?: MerchShipmentLike | null,
): number | null {
  const base = getBasePvp(item, rule, shipment);
  if (base == null) return null;
  if (!item.is_consignment) return base;
  const pct = consignmentPct(item);
  return base / (1 - pct / 100);
}

export type ConsignmentBreakdown = {
  units: number;
  pct: number;
  basePvpUnit: number;
  finalPvpUnit: number;
  ivaUnit: number;
  commissionUnit: number;
  netOwnerUnit: number;
  basePvpTotal: number;
  finalPvpTotal: number;
  ivaTotal: number;
  commissionTotal: number;
  netOwnerTotal: number;
};

/** IVA contenido en un precio que YA incluye IVA. */
export function calculateIncludedIva(priceWithIva: number, ivaRate: number = IVA_RATE): number {
  const p = Number(priceWithIva ?? 0);
  const r = Number(ivaRate ?? 0);
  return p - p / (1 + r);
}

export function getConsignmentBreakdown(
  item: MerchItemLike,
  rule?: PricingRuleLike | null,
  shipment?: MerchShipmentLike | null,
): ConsignmentBreakdown | null {
  if (!item.is_consignment) return null;
  const base = getBasePvp(item, rule, shipment);
  if (base == null) return null;
  const pct = consignmentPct(item);
  const units = Math.max(1, calculateTotalUnits(item));
  const finalPvpUnit = base / (1 - pct / 100);
  const ivaUnit = calculateIncludedIva(finalPvpUnit);
  const commissionUnit = finalPvpUnit * pct / 100;
  const netOwnerUnit = finalPvpUnit - commissionUnit - ivaUnit;
  return {
    units,
    pct,
    basePvpUnit: base,
    finalPvpUnit,
    ivaUnit,
    commissionUnit,
    netOwnerUnit,
    basePvpTotal: base * units,
    finalPvpTotal: finalPvpUnit * units,
    ivaTotal: ivaUnit * units,
    commissionTotal: commissionUnit * units,
    netOwnerTotal: netOwnerUnit * units,
  };
}


export function calculateConsignmentCommission(
  item: MerchItemLike,
  rule?: PricingRuleLike | null,
  shipment?: MerchShipmentLike | null,
): number {
  return getConsignmentBreakdown(item, rule, shipment)?.commissionTotal ?? 0;
}

export function calculateConsignmentNet(
  item: MerchItemLike,
  rule?: PricingRuleLike | null,
  shipment?: MerchShipmentLike | null,
): number | null {
  const b = getConsignmentBreakdown(item, rule, shipment);
  return b ? b.netOwnerTotal : null;
}


export function calculateMargin(
  item: MerchItemLike,
  shipment?: MerchShipmentLike | null,
  rule?: PricingRuleLike | null,
): number | null {
  const pvpUnit = getFinalPvp(item, rule, shipment);
  if (pvpUnit == null) return null;
  const units = Math.max(1, calculateTotalUnits(item));
  return pvpUnit * units - calculateTotalCost(item, shipment) - calculateConsignmentCommission(item, rule, shipment);
}

export function calculateMerchMargin(
  item: MerchItemLike,
  rule?: PricingRuleLike | null,
  shipment?: MerchShipmentLike | null,
): number | null {
  return calculateMargin(item, shipment, rule);
}

export type UploadValidation = {
  ok: boolean;
  reason?: "missing_sku" | "missing_pvp";
  message?: string;
};

export function canMarkUploaded(
  item: MerchItemLike,
  rule?: PricingRuleLike | null,
  shipment?: MerchShipmentLike | null,
): UploadValidation {
  if (!item.sku_web || !item.sku_web.trim()) {
    return {
      ok: false,
      reason: "missing_sku",
      message:
        "Debes asignar un SKU web antes de marcar este producto como subido al sistema.",
    };
  }
  const finalPvp = getFinalPvp(item, rule, shipment);
  const legacyManual =
    item.use_manual_pvp && (Number(item.pvp_manual ?? 0) > 0 || Number(item.pvp ?? 0) > 0);
  if (!(finalPvp && finalPvp > 0) && !legacyManual) {
    return {
      ok: false,
      reason: "missing_pvp",
      message:
        "Debes tener un PVP final válido antes de marcar este producto como subido al sistema.",
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
// Stock value summary (cards)
// -----------------------------

export interface StockValueItemLike extends MerchItemLike {
  estado?: string | null;
  shipment_id?: string | null;
  box_id?: string | null;
}

export interface StockValueSummary {
  amountEur: number;
  itemCount: number;
  unitCount: number;
}

function unitsOrOne(item: MerchItemLike): number {
  const u = calculateTotalUnits(item);
  return u > 0 ? u : 1;
}

export function isPurchasedNotAssigned(item: StockValueItemLike): boolean {
  if (item.estado === "cancelled") return false;
  return !item.shipment_id || !item.box_id;
}

export function isInTransit(item: StockValueItemLike): boolean {
  if (item.estado === "cancelled" || item.estado === "available") return false;
  if (item.estado === "in_transit") return true;
  return Boolean(item.shipment_id && item.box_id);
}

export function calculateStockValuePurchased(items: StockValueItemLike[]): StockValueSummary {
  let amount = 0;
  let units = 0;
  let count = 0;
  for (const it of items) {
    if (!isPurchasedNotAssigned(it)) continue;
    const u = unitsOrOne(it);
    amount += Number(it.precio_compra ?? 0) * u;
    units += u;
    count += 1;
  }
  return { amountEur: amount, itemCount: count, unitCount: units };
}

export function calculateStockValueInTransit(
  items: StockValueItemLike[],
  shipments: { id: string; cost_per_kg_eur: number | null }[],
): StockValueSummary {
  const shipMap = new Map<string, { id: string; cost_per_kg_eur: number | null }>();
  for (const s of shipments) shipMap.set(s.id, s);
  let amount = 0;
  let units = 0;
  let count = 0;
  for (const it of items) {
    if (!isInTransit(it)) continue;
    const ship = it.shipment_id ? shipMap.get(it.shipment_id) ?? null : null;
    amount += calculateTotalCost(it, ship);
    units += unitsOrOne(it);
    count += 1;
  }
  return { amountEur: amount, itemCount: count, unitCount: units };
}

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
  "product_type",
  "product_type_label",
  "profit_percentage",
  "size_group",
  "no_size",
  "size_quantities",
  "tallas_resumen",
  "total_units",
  "precio_compra_unitario",
  "precio_compra_total",
  "peso_kg",
  "cost_per_kg_eur",
  "shipping_cost_eur",
  "costo_total_con_envio",
  "pvp_base_sugerido",
  "iva_rate",
  "iva_amount",
  "pvp_sugerido_tentativo",
  "pvp_sugerido_final",
  "pvp_tipo",
  "pvp_modo",
  "use_manual_pvp",
  "pvp_manual",
  "pvp_final_aplicado",
  "pvp_total",
  "margen_estimado",
  "consignacion",
  "comision_sublime_pct",
  "comision_sublime",
  "iva_incluido_consignacion",
  "neto_consignacion",
  "shipment_number",
  "box_number",
  "sent_at",
  "received_at",
  "estado",
  "subido_al_sistema",
  "uploaded_at",
  "notas",
  "fotos_origen_count",
  "fotos_web_count",
] as const;


export function buildSublimeMerchCsv(
  items: CsvItemLike[],
  shipments: CsvShipmentLike[],
  boxes: CsvBoxLike[],
  rules: PricingRuleLike[] = FALLBACK_PRICING_RULES,
): string {
  const shipMap = new Map<string, CsvShipmentLike>();
  for (const s of shipments) shipMap.set(s.id, s);
  const boxMap = new Map<string, CsvBoxLike>();
  for (const b of boxes) boxMap.set(b.id, b);

  const rows: string[] = [CSV_COLUMNS.join(",")];
  for (const it of items) {
    const ship = it.shipment_id ? shipMap.get(it.shipment_id) ?? null : null;
    const box = it.box_id ? boxMap.get(it.box_id) ?? null : null;
    const rule = findPricingRule(rules, it.product_type ?? null);
    const hasShipment = !!(ship && ship.cost_per_kg_eur != null);
    const shipping = hasShipment ? calculateShippingCost(it, ship) : 0;
    const units = Math.max(1, calculateTotalUnits(it));
    const precioTotal = Number(it.precio_compra ?? 0) * units;
    const total = precioTotal + shipping;
    const perUnitCost = total / units;
    const pct = rule ? Number(rule.profit_percentage ?? 0) : 0;
    const baseSuggested = calculateSuggestedBasePvp(perUnitCost, pct);
    const ivaAmount = calculateIvaAmount(baseSuggested);
    const suggestedFull = baseSuggested + ivaAmount;
    // Tentativo siempre calculado sin envío
    const perUnitBuy = Number(it.precio_compra ?? 0);
    const tentBase = calculateSuggestedBasePvp(perUnitBuy, pct);
    const tentIva = calculateIvaAmount(tentBase);
    const suggestedTent = tentBase + tentIva;
    const finalPvp = getFinalPvp(it, rule, hasShipment ? ship : null);
    const margin = calculateMargin(it, hasShipment ? ship : null, rule);
    const commission = calculateConsignmentCommission(it, rule, hasShipment ? ship : null);
    const consignmentNet = calculateConsignmentNet(it, rule, hasShipment ? ship : null);
    const consignmentBreak = getConsignmentBreakdown(it, rule, hasShipment ? ship : null);
    const pvpTotal = finalPvp != null ? finalPvp * units : null;
    const row = [
      it.sku_web ?? "",
      it.name ?? "",
      it.codigo_fabricante ?? "",
      it.product_type ?? "",
      rule?.label ?? "",
      rule ? String(pct) : "",
      it.size_group ?? "",
      it.no_size ? "true" : "false",
      JSON.stringify(it.size_quantities ?? {}),
      formatSizeSummary(it),
      String(calculateTotalUnits(it)),
      Number(it.precio_compra ?? 0).toFixed(2),
      precioTotal.toFixed(2),
      Number(it.peso_kg ?? 0).toFixed(3),
      ship?.cost_per_kg_eur != null ? Number(ship.cost_per_kg_eur).toFixed(2) : "",
      shipping.toFixed(2),
      total.toFixed(2),
      baseSuggested.toFixed(2),
      IVA_RATE.toFixed(2),
      ivaAmount.toFixed(2),
      suggestedTent.toFixed(2),
      hasShipment ? suggestedFull.toFixed(2) : "",
      hasShipment ? "final" : "tentativo",
      it.use_manual_pvp ? "manual" : "sugerido",
      it.use_manual_pvp ? "true" : "false",
      it.pvp_manual != null ? Number(it.pvp_manual).toFixed(2) : "",
      finalPvp != null ? finalPvp.toFixed(2) : "",
      pvpTotal != null ? pvpTotal.toFixed(2) : "",
      margin != null ? margin.toFixed(2) : "",
      it.is_consignment ? "true" : "false",
      it.is_consignment ? Number(it.consignment_commission_pct ?? 0).toFixed(2) : "",
      it.is_consignment ? commission.toFixed(2) : "",
      it.is_consignment && consignmentBreak ? consignmentBreak.ivaTotal.toFixed(2) : "",
      it.is_consignment && consignmentNet != null ? consignmentNet.toFixed(2) : "",
      ship?.shipment_number ?? "",
      box?.box_number ?? "",
      ship?.sent_at ?? "",
      it.received_at ?? "",
      it.estado ?? "",
      it.subido_al_sistema ? "true" : "false",
      it.uploaded_at ?? "",
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
  rules: PricingRuleLike[] = FALLBACK_PRICING_RULES,
): void {
  const csv = buildSublimeMerchCsv(items, shipments, boxes, rules);
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

