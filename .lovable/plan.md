# Bug: pedido VES contabilizado como USD

## Diagnóstico (confirmado por consulta)

Pedido `BA16926` (order_id 34006):
- `order_currency = 'VES'`
- `total_amount = 54276.4`
- `exchange_rate = 0`
- `total_amount_usd = NULL`

Cuando la tasa es 0 y el `total_amount_usd` no está calculado, la función `toUsd` cae a un fallback que **devuelve el importe VES tal cual como si fuera USD**, inflando totales.

Ya existe una guarda (`MAX_REASONABLE_USD = 4000` + exclusión VES-sin-tasa) pero **solo está aplicada en 2 de 6 lugares**. Los otros componentes suman el monto crudo.

### Estado actual por archivo

| Archivo | ¿Guarda aplicada? |
|---|---|
| `src/hooks/useDashboardData.ts` | Sí (excluye VES sin tasa > $100) |
| `src/components/pedidos/PedidosDashboard.tsx` | Sí (`safeRevenue` + MAX) |
| `src/components/pedidos/PedidosChannels.tsx` | Parcial (aplica MAX pero `toUsd` sigue devolviendo VES crudo) |
| `src/components/pedidos/PedidosPaymentMethods.tsx` | No (usa `orderTotalUsd` sin límite) |
| `src/components/crm/CustomerOrdersDialog.tsx` | **No** — es el que se ve en la captura |
| `src/pages/Pedidos.tsx` / `OrderExpandedDetails.tsx` | No — muestra en la fila del pedido |

## Solución

Centralizar la conversión segura en un helper único y usarlo en todas las analíticas.

### 1. Nuevo helper `src/lib/orderUsd.ts`

```ts
export const MAX_REASONABLE_USD = 4000;

export function orderUsd(o: {
  total_amount_usd?: number | null;
  total_amount?: number | null;
  order_currency?: string | null;
  exchange_rate?: number | null;
}): number {
  const usd = Number(o.total_amount_usd ?? 0);
  if (usd > 0) return usd;
  const amt = Number(o.total_amount ?? 0);
  const currency = (o.order_currency || "USD").toUpperCase();
  if (currency === "USD") return amt;
  const rate = Number(o.exchange_rate || 0);
  // VES/otras sin tasa válida → no se puede convertir con confianza
  if (rate <= 0) return 0;
  return amt / rate;
}

// Para agregados: descarta importes irrazonables (errores de conversión)
export function safeOrderUsd(o: Parameters<typeof orderUsd>[0]): number {
  const v = orderUsd(o);
  return v > MAX_REASONABLE_USD ? 0 : v;
}
```

Diferencia clave con el `toUsd` actual: cuando la moneda no es USD y no hay tasa, devuelve **0** en lugar del monto VES crudo. Esto elimina el sesgo en la raíz y hace que el `MAX_REASONABLE_USD` sea solo una segunda línea de defensa.

### 2. Reemplazos

- `PedidosDashboard.tsx`: reemplazar `toUsd`/`safeRevenue` locales por los del helper.
- `PedidosChannels.tsx`: idem.
- `PedidosPaymentMethods.tsx`: idem (usar `safeOrderUsd` en agregados).
- `CustomerOrdersDialog.tsx`: usar `safeOrderUsd` en el "Total gastado" y `orderUsd` en cada fila; cuando dé 0 por falta de tasa, mostrar el badge "VES sin tasa" en la fila para que el usuario sepa por qué no se contabiliza (no se pinta como $0 en la lista de pedidos, sí en el total).
- `Pedidos.tsx` + `OrderExpandedDetails.tsx`: usar `orderUsd` para display por pedido (no aplicar MAX aquí, el usuario debe ver el pedido individual; solo cambia que VES sin tasa mostrará `—` o "VES sin tasa" en vez de un USD inflado).
- `useDashboardData.ts`: reemplazar la exclusión ad-hoc por `safeOrderUsd` para uniformar.

### 3. Sin cambios de datos

- No se toca ningún registro. El pedido queda con `exchange_rate = 0`; solo cambia cómo se agrega en analíticas.
- No se ejecuta migración. Si en el futuro se completa la tasa real para ese pedido, entrará automáticamente en los totales.

## Alcance / no-alcance

- Solo capa de presentación y agregación (frontend).
- No toca sincronización WooCommerce, RPC, Partidas, ni el pedido en sí.
- No cambia la definición de `MAX_REASONABLE_USD` (se mantiene $4000).
