// Helpers puros para la Conciliación Woo vs Partidas de Fabricación.
// 100% read-only: este módulo no ejecuta consultas, solo provee constantes,
// clasificadores y serializadores.

export const CONFIRMED_STATUSES = new Set<string>([
  "processing",
  "pick-up-listo-par",
  "pedido-pick-up-re",
  "el-pedido-esta-si",
  "pedido-recibido-p",
  "recordartorio-de-",
  "tu-pedido-ha-sido",
  "pedido-listo-para",
  "tu-pago-fue-confi",
  "ml-pago-por-confi",
  "fabricacion",
  "enviado",
  "completed",
]);

export const REVERTING_STATUSES = new Set<string>([
  "cancelled",
  "refunded",
  "failed",
  "pago-pendiente-po",
]);

export const RECON_BASELINE = "2026-07-21";

// Pendings considerados NO activos (cerrados).
export const CLOSED_PENDING_STATUSES = new Set<string>([
  "resolved",
  "ignored",
  "completed",
  "cancelled",
]);

const SHIPPING_REGEX = /env[ií]o|shipping|delivery|fee/i;

export function isShippingLike(name: string | null | undefined, sku: string | null | undefined) {
  return SHIPPING_REGEX.test(name ?? "") || SHIPPING_REGEX.test(sku ?? "");
}

export type ReconResultKind =
  | "reserved"
  | "pending_cost"
  | "pending_mapping"
  | "pending_classification"
  | "excluded_shipping"
  | "excluded_status"
  | "not_processed";

export type ReconRow = {
  order_id: number;
  order_number: string | null;
  order_datetime: string | null;
  order_status: string | null;
  line_item_id: number | null;
  sku: string | null;
  product_name: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  quantity: number | null;
  line_total: number | null;
  result: ReconResultKind;
  is_late_confirmed: boolean;
  // Datos del movimiento cuando existe
  movement_amount: number | null;
  movement_unit_cost: number | null;
  movement_bucket: string | null;
  movement_type: string | null;
  reason: string | null;
};

export const RESULT_LABEL: Record<ReconResultKind, string> = {
  reserved: "Ya reservado",
  pending_cost: "Pendiente sin costo",
  pending_mapping: "Pendiente sin mapeo",
  pending_classification: "Pendiente de clasificación",
  excluded_shipping: "Excluido: delivery/envío",
  excluded_status: "Excluido por status",
  not_processed: "No procesado",
};

export const RESULT_BADGE: Record<ReconResultKind, string> = {
  reserved: "bg-emerald-100 text-emerald-800 border-emerald-300",
  pending_cost: "bg-yellow-100 text-yellow-800 border-yellow-300",
  pending_mapping: "bg-orange-100 text-orange-800 border-orange-300",
  pending_classification: "bg-amber-100 text-amber-800 border-amber-300",
  excluded_shipping: "bg-muted text-muted-foreground border-border",
  excluded_status: "bg-muted text-muted-foreground border-border",
  not_processed: "bg-destructive/10 text-destructive border-destructive/30",
};

function classifyPendingReason(reason: string | null | undefined): ReconResultKind {
  const r = (reason ?? "").toLowerCase();
  if (r === "unit_cost_missing" || r === "missing_cost") return "pending_cost";
  if (r === "variation_not_mapped" || r === "product_not_mapped") return "pending_mapping";
  if (r === "pending_classification") return "pending_classification";
  return "pending_classification";
}

export function classifyLine(params: {
  orderStatus: string | null;
  sku: string | null;
  productName: string | null;
  movement: {
    amount: number | null; unit_cost_snapshot: number | null;
    fund_bucket: string | null; movement_type: string | null;
  } | null;
  pending: { status: string | null; reason: string | null } | null;
}): { result: ReconResultKind; reason: string | null } {
  const { orderStatus, sku, productName, movement, pending } = params;
  // 1. Delivery/envío/fee — prioridad máxima
  if (isShippingLike(productName, sku)) return { result: "excluded_shipping", reason: null };
  // 2. Movimiento
  if (movement) return { result: "reserved", reason: null };
  // 3. Pending activo
  if (pending && pending.status && !CLOSED_PENDING_STATUSES.has(pending.status)) {
    return { result: classifyPendingReason(pending.reason), reason: pending.reason };
  }
  // 4. Excluido por status
  if (!orderStatus || !CONFIRMED_STATUSES.has(orderStatus)) {
    return { result: "excluded_status", reason: orderStatus ?? null };
  }
  // 5. No procesado
  return { result: "not_processed", reason: null };
}

// VE = UTC-4 fijo.
export function veRangeToUtc(fromISO: string, toISO: string): { fromUtc: string; toUtc: string } {
  // fromISO 00:00 VE = fromISO 04:00 UTC
  // toISO 23:59 VE = (toISO+1) 03:59 UTC
  const [ty, tm, td] = toISO.split("-").map(Number);
  const dt = new Date(Date.UTC(ty, (tm ?? 1) - 1, td ?? 1));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return {
    fromUtc: `${fromISO} 04:00 UTC`,
    toUtc: `${yy}-${mm}-${dd} 03:59 UTC`,
  };
}

// Convierte un rango VE (día completo) al intervalo timestamptz UTC que
// se envía a Supabase para filtrar order_datetime.
export function veRangeBounds(fromISO: string, toISO: string): { gte: string; lte: string } {
  // gte = fromISO 00:00 VE = fromISO T04:00:00Z
  // lte = toISO 23:59:59.999 VE = (toISO+1) T03:59:59.999Z
  const [ty, tm, td] = toISO.split("-").map(Number);
  const end = new Date(Date.UTC(ty, (tm ?? 1) - 1, td ?? 1));
  end.setUTCDate(end.getUTCDate() + 1);
  const endISO = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}T03:59:59.999Z`;
  return { gte: `${fromISO}T04:00:00.000Z`, lte: endISO };
}

// Formatea ISO -> DD/MM/YYYY HH:mm en VE (asumido UTC-4).
export function formatVE(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  // Convertir a VE: restar 4h del UTC
  const ve = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  const dd = String(ve.getUTCDate()).padStart(2, "0");
  const mm = String(ve.getUTCMonth() + 1).padStart(2, "0");
  const yy = ve.getUTCFullYear();
  const hh = String(ve.getUTCHours()).padStart(2, "0");
  const mi = String(ve.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

export function rowsToCsv(rows: ReconRow[]): string {
  const header = [
    "order_number", "order_id", "line_item_id", "order_datetime_ve", "order_status",
    "sku", "product_name", "woo_product_id", "woo_variation_id", "quantity",
    "line_total", "result", "movement_type", "movement_bucket", "movement_unit_cost",
    "movement_amount", "reason", "is_late_confirmed",
  ];
  const lines: string[] = [header.join(",")];
  for (const r of rows) {
    const cells = [
      r.order_number ?? "",
      r.order_id,
      r.line_item_id ?? "",
      formatVE(r.order_datetime),
      r.order_status ?? "",
      r.sku ?? "",
      r.product_name ?? "",
      r.woo_product_id ?? "",
      r.woo_variation_id ?? "",
      r.quantity ?? "",
      r.line_total ?? "",
      RESULT_LABEL[r.result],
      r.movement_type ?? "",
      r.movement_bucket ?? "",
      r.movement_unit_cost ?? "",
      r.movement_amount ?? "",
      r.reason ?? "",
      r.is_late_confirmed ? "yes" : "no",
    ];
    lines.push(cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Chunk helper para .in() con listas grandes de IDs.
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
