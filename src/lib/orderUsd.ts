// Conversión segura de importes de pedidos a USD.
//
// Regla clave: si un pedido está en moneda distinta de USD y NO tiene tasa
// válida (`exchange_rate <= 0`) ni `total_amount_usd` precalculado, no se
// puede convertir con confianza, así que devolvemos 0 en vez del monto crudo.
// Esto evita que un pedido VES sin tasa se sume como si fuera USD e infle
// las analíticas.

export const MAX_REASONABLE_USD = 4000;

export interface OrderUsdInput {
  total_amount_usd?: number | null;
  total_amount?: number | null;
  order_currency?: string | null;
  exchange_rate?: number | null;
}

export function orderUsd(o: OrderUsdInput): number {
  const usd = Number(o.total_amount_usd ?? 0);
  if (usd > 0) return usd;
  const amt = Number(o.total_amount ?? 0);
  const currency = (o.order_currency || "USD").toUpperCase();
  if (currency === "USD") return amt;
  const rate = Number(o.exchange_rate || 0);
  if (rate <= 0) return 0; // sin tasa válida → no contabilizar
  return amt / rate;
}

// Para agregados: además de `orderUsd`, descarta importes irrazonables
// (probables errores de conversión moneda) por encima del umbral.
export function safeOrderUsd(o: OrderUsdInput): number {
  const v = orderUsd(o);
  return v > MAX_REASONABLE_USD ? 0 : v;
}

// True si el pedido no se puede convertir a USD con confianza
// (moneda no-USD y sin tasa válida ni USD precalculado).
export function isUnconvertibleOrder(o: OrderUsdInput): boolean {
  if (Number(o.total_amount_usd ?? 0) > 0) return false;
  const currency = (o.order_currency || "USD").toUpperCase();
  if (currency === "USD") return false;
  return Number(o.exchange_rate || 0) <= 0;
}
