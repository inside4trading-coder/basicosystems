

## Diagnóstico real

Comprobé la BD:
- `orders` tiene **11.067 pedidos** y **5.007 emails únicos**.
- `customers_cache` tiene **4.384 clientes** que SÍ coinciden (case-insensitive) con esos emails.
- Pero solo **126 muestran `orders_count = 1`**, **13 con 2-5**, **0 con 6+**.
- El cliente `gtovar12@hotmail.com` tiene **20 pedidos** en `orders` y aparece como `0` en `customers_cache`.

Conclusión: **la RPC `refresh_customers_order_stats()` nunca terminó de ejecutarse después del sync histórico**.

## Por qué falló

En `woo-sync/index.ts` línea 374:
```ts
if (reachedEnd && !sourceError) {
  await supabase.rpc("refresh_customers_order_stats");
}
```

La RPC solo se dispara cuando un chunk concreto devuelve `reached_end = true`. Si:
- el loop del CRM se detuvo antes (timeout, cierre de tab, error intermedio), o
- el último batch devolvió `has_more` por error de paginación,

…la recalculación nunca corre. Y el botón "🧮 Recalcular" puede haber tirado timeout también porque la RPC procesa 8.500+ filas dos veces (reset + GREATEST update).

## Plan de fix

### 1. Disparar la recalculación AHORA (one-shot)
Ejecutar `SELECT public.refresh_customers_order_stats();` vía migración. Esto arregla los segmentos inmediatamente con los 11.067 pedidos ya sincronizados. Resultado esperado:
- "Primera compra (1)" → ~3.000+ clientes
- "Recurrentes (2-5)" → ~1.000+
- "Fieles (6-15)" → ~200+
- "VIP (16+)" → ~10+

### 2. Hacer la RPC más rápida y robusta
Reescribir `refresh_customers_order_stats()` para:
- usar un único `UPDATE ... FROM` en vez de 2 pasadas
- match **case-insensitive** por email (`LOWER(email) = LOWER(customer_email)`) para no perder clientes con casing distinto
- ignorar pedidos cancelados/refunded para que el conteo refleje compras válidas (status `completed`, `processing`, `on-hold`)

### 3. Disparar recalc en CADA chunk del histórico (no solo al final)
Cambiar `woo-sync/index.ts`: ejecutar la RPC también cuando `status = "has_more"`. Es idempotente y barata tras el fix #2. Así, aunque el loop se interrumpa, el cache siempre refleja lo sincronizado hasta ese punto.

### 4. Botón "Recalcular" con feedback real
En `src/pages/CRM.tsx`, tras llamar la RPC, mostrar el resultado (`SELECT COUNT(*) WHERE orders_count > 0`) en el toast: `"4.382 clientes con compras actualizados"`. Así el usuario ve evidencia inmediata.

## Archivos a tocar

- **Migración SQL**: redefinir `refresh_customers_order_stats()` (case-insensitive + status filter + single UPDATE) y ejecutarla.
- `supabase/functions/woo-sync/index.ts`: quitar la condición `reachedEnd` para llamar la RPC también en `has_more`.
- `src/pages/CRM.tsx`: enriquecer el toast del botón Recalcular con el conteo real.

## Validación

Tras aplicar:
1. Ir a CRM → filtro "Primera compra" debe mostrar miles, no 126.
2. Filtro "VIP" debe poblarse con `gtovar12@hotmail.com`, `gabo.stonks@gmail.com`, etc.
3. SegmentBuilder en Campaigns mostrará audiencias realistas por nº de compras.

## Fuera de alcance

- Re-sync de pedidos (ya están todos en BD, solo falta recalcular).
- Cambios en Brevo o segmentos guardados.

