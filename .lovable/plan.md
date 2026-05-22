# Métodos de pago: sumar monto real por método

Hoy la pestaña **Métodos de pago** suma el **total del pedido** completo a cada método que aparece en él. Si un pedido de $100 USD se pagó con $60 Zelle + $40 Efectivo, hoy Zelle suma $100 y Efectivo $100 — los totales y la torta no reflejan la realidad de cuánto dinero entró por cada vía.

Vamos a usar la tabla `payments` (que ya guarda `payment_amount` + `payment_currency` + `payment_method` por slot) para sumar el monto real cobrado por cada método.

## Cambios

### 1. Fuente de datos
- En `PedidosPaymentMethods.tsx`, además de `orders`, traer los registros de `payments` para los `order_id` del período.
- Conversión a USD por pago: si `payment_currency = USD` usar `payment_amount` tal cual; si es VES (u otra), dividir por el `exchange_rate` del pedido (mismo criterio que ya usa `toUsd`).

### 2. Agregación por método
Para cada método permitido (lista actual: Pago Móvil, Cashea, Punto de venta, Efectivo USD, Zelle, Binance, PayPal):

- **Monto USD del método** = suma de `payment_amount` en USD de todos los pagos de ese método (excluyendo pedidos refunded / failed / cancelled).
- **Pedidos del método** = pedidos donde aparece ese método (al menos un slot).
- **% del método** = `monto_usd_metodo / sum(monto_usd_todos_los_metodos)` — porcentaje real de dinero, no de apariciones.

### 3. UI
- Header de cada acordeón: nombre, **N pedidos · X% del cobrado**, monto USD real del método a la derecha.
- Tarjetas de resumen arriba: cambiar "Apariciones de pago" por **"Total cobrado (USD)"** = suma de todos los `payment_amount` convertidos.
- Tabla dentro del acordeón: misma estructura, pero agregar una columna **"Pagado con este método"** mostrando el monto específico de ese pago dentro del pedido (no el total del pedido). Mantener la columna "Total" del pedido como referencia.
- Torta: `dataKey` cambia de `appearances` a `totalUsd` (monto real). Tooltip muestra `USD · N pedidos · X%`.

### 4. Edge cases
- Si un pedido no tiene filas en `payments` (sync viejo), caer a `pago_metodo_N` con monto 0 — aparece en el conteo de pedidos pero no suma USD. Mostrarlo en la tabla con "—" en la columna de monto pagado.
- Mantener el filtro `MAX_REASONABLE_USD` aplicado a `payment_amount_usd` por pago para descartar outliers.

## Archivos afectados

- `src/components/pedidos/PedidosPaymentMethods.tsx` — refactor de fetch + agregación + UI.

No se tocan otras pestañas ni la lógica de canales.
