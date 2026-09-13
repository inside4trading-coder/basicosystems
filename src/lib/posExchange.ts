/**
 * Cambio en curso: una devolución ya registrada que espera su nueva venta.
 * Se guarda en el navegador solo como puente hacia el POS; la relación real
 * se persiste en el servidor al completar la venta.
 */
const KEY = "sublime_pending_exchange";

export interface PendingExchange {
  returnId: string;
  returnNumber: string;
  saleNumber: string;
  refundedRef: number;
}

export function setPendingExchange(p: PendingExchange) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* almacenamiento no disponible: el cambio se puede enlazar manualmente */
  }
}

export function getPendingExchange(): PendingExchange | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingExchange) : null;
  } catch {
    return null;
  }
}

export function clearPendingExchange() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada que limpiar */
  }
}
