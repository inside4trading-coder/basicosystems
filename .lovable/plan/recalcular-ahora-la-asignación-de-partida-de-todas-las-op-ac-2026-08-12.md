# Recalcular ahora la asignación de partida de todas las OP activas

## Objetivo

Hoy la partida muestra $955.56 porque ninguna orden de producción existente tiene movimiento de asignación: los disparadores se activaron después de que se crearan esas órdenes. Este cambio recalcula, una sola vez, la asignación de todas las órdenes activas para que el "Disponible real sin asignar" refleje el dinero ya comprometido en producción.

## Qué se hará

- Recalcular la asignación de las órdenes de producción con estado abierto, en producción o parcialmente completado (100 líneas en total).
- Cada orden generará su movimiento de "Asignado a OP" por el costo de sus líneas, y la partida general bajará en ese mismo monto.
- Las órdenes canceladas quedan en cero; las ya cerradas no se tocan.
- El proceso es idempotente: si se vuelve a ejecutar, ajusta al monto correcto en lugar de duplicar.

## Alcance

No se toca WooCommerce, QR/fichas viajeras, nómina, ni ningún flujo de inventario. Solo se escriben movimientos de partida y el saldo disponible del fondo general.

## Detalle técnico

- Ejecutar `SELECT public.core_sync_production_order_allocation(id) FROM public.core_production_orders WHERE status IN ('open','in_production','partially_completed')` como cambio de datos puntual.
- La función ya existe y usa `estimated_unit_cost` de la línea con respaldo en `resolve_core_variant_unit_cost(core_product_id, core_variant_id)`.
- Inserta un movimiento `production_allocated` negativo por orden (único por `production_order_id`) y descuenta el delta de `core_fabrication_funds.available_amount` del fondo general USD.
- Después de ejecutar, verificar en `/core/partidas-fabricacion`: la tarjeta "Asignado a OP" deja de ser $0 y "Disponible real sin asignar" baja en consecuencia; el filtro "Producción (OP)" lista los movimientos creados.

## Verificación

Consulta de control tras la ejecución: total de `production_allocated` posteado vs. suma de costos de líneas de las OP activas, y saldo del fondo general antes/después.
