// Single source of truth for order status classification.
// Public constants match EXACTLY the spec strings (no renaming, no translations).
// Internal SLUG_TO_CANONICAL maps the truncated WooCommerce slugs stored in the DB
// to their canonical labels so helpers work against real data.

export const VALID_ORDER_STATUSES = [
  "Pago confirmado automáticamente: pedido en proceso",
  "Pick-Up Listo para entrega – Pago efectivo",
  "Pick-Up Recibido – Pago en efectivo",
  "El pedido esta siendo procesado",
  "Pedido recibido – Por cobrar",
  "Recordartorio de calificación",
  "Tu pedido ha sido enviado",
  "Pedido listo para entrega/despacho",
  "Pago confirmado: pedido listo para procesar",
  "Pending payment",
  "Pedido recibido por POS – Pago por confirmar",
  "On hold",
  "ML – Pago por confirmar",
  "Pago por confirmar",
  "En fabricación",
  "Draft",
] as const;

export const EXCLUDED_FROM_REVENUE = [
  "Cancelled",
  "Refunded",
  "Failed",
  "ERROR EN PAGO: Pago pendiente por confirmar",
] as const;

export const QUICK_ACCESS_STATUSES = [
  "Pago confirmado automáticamente: pedido en proceso",
  "El pedido esta siendo procesado",
  "Tu pedido ha sido enviado",
  "Pago por confirmar",
  "Pedido recibido por POS – Pago por confirmar",
  "Pedido listo para entrega/despacho",
  "On hold",
] as const;

export type ValidOrderStatus = typeof VALID_ORDER_STATUSES[number];
export type ExcludedStatus = typeof EXCLUDED_FROM_REVENUE[number];
export type QuickAccessStatus = typeof QUICK_ACCESS_STATUSES[number];

// DB slug -> canonical label (confirmed mapping).
// "En fabricación" slug not yet confirmed in DB; add when known.
export const SLUG_TO_CANONICAL: Record<string, string> = {
  // Valid orders
  "processing": "Pago confirmado automáticamente: pedido en proceso",
  "pick-up-listo-par": "Pick-Up Listo para entrega – Pago efectivo",
  "pedido-pick-up-re": "Pick-Up Recibido – Pago en efectivo",
  "el-pedido-esta-si": "El pedido esta siendo procesado",
  "pedido-recibido-p": "Pedido recibido – Por cobrar",
  "recordartorio-de-": "Recordartorio de calificación",
  "tu-pedido-ha-sido": "Tu pedido ha sido enviado",
  "pedido-listo-para": "Pedido listo para entrega/despacho",
  "tu-pago-fue-confi": "Pago confirmado: pedido listo para procesar",
  "pending": "Pending payment",
  "completed": "Pedido recibido por POS – Pago por confirmar",
  "on-hold": "On hold",
  "ml-pago-por-confi": "ML – Pago por confirmar",
  "pedido-pending-pa": "Pago por confirmar",
  "draft": "Draft",
  // Excluded from revenue
  "cancelled": "Cancelled",
  "refunded": "Refunded",
  "failed": "Failed",
  "pago-pendiente-po": "ERROR EN PAGO: Pago pendiente por confirmar",
};

export const toCanonical = (raw: string): string =>
  SLUG_TO_CANONICAL[raw] ?? raw;

export const isValidOrder = (status: string): boolean =>
  VALID_ORDER_STATUSES.includes(toCanonical(status) as ValidOrderStatus);

export const isExcludedFromRevenue = (status: string): boolean =>
  EXCLUDED_FROM_REVENUE.includes(toCanonical(status) as ExcludedStatus);

export const isQuickAccess = (status: string): boolean =>
  QUICK_ACCESS_STATUSES.includes(toCanonical(status) as QuickAccessStatus);
