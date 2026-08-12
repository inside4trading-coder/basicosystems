# Partidas: disponible real descontando OP asignadas

Base confirmada en el diagnóstico: hoy solo suben movimientos por venta; crear OP o ingresar inventario no genera ningún movimiento financiero. Este cambio agrega el descuento por OP hacia adelante, sin backfill.

## 1. Migración (base de datos)

- Ampliar el CHECK de `core_fabrication_fund_movements.movement_type` con: `production_allocated`, `production_released`, `production_executed`.
- Ampliar el CHECK de `source` con `production_order`.
- Nuevas columnas en `core_fabrication_fund_movements`: `production_order_id uuid` (FK a `core_production_orders`, ON DELETE SET NULL) y `metadata jsonb`.
- Índice único parcial: un solo `production_allocated` por `production_order_id` (idempotencia dura a nivel base de datos).

## 2. Dónde se inserta `production_allocated`

Se hace en la base de datos, no en el frontend, para cubrir todas las vías de creación (función `core-create-production-order`, órdenes manuales y órdenes por lote) sin tocar ninguna de ellas.

Función `public.core_sync_production_order_allocation(p_order_id uuid)`:
- Calcula el monto = suma de `quantity_ordered * COALESCE(estimated_unit_cost, 0)` de `core_production_order_lines`. Si una línea no tiene costo estimado, resuelve con `resolve_core_variant_unit_cost` (misma fuente de costos que ya usa Core).
- Si la OP está en estado `cancelled`: deja el asignado en 0 y registra la diferencia como `production_released` (positivo).
- Si la OP está activa (`open`, `in_production`, `partially_completed`): mantiene un único movimiento `production_allocated` con `amount` negativo, `fund_bucket = internal_factory`, `status = posted`, `source = production_order`, `production_order_id`, y `metadata` con `order_code`, `quantity`, `total_cost` y las necesidades origen (`core_production_order_need_links`).
- Ajusta `core_fabrication_funds.available_amount` del fondo general por la diferencia exacta aplicada (nunca por el total), así refrescar o reeditar líneas no duplica.

Disparadores:
- `AFTER INSERT OR UPDATE OR DELETE` en `core_production_order_lines` → recalcula la asignación de esa OP.
- `AFTER UPDATE OF status` en `core_production_orders` → al pasar a `cancelled` libera; al pasar a `closed`/`completed` convierte el asignado en `production_executed` (registro informativo, sin volver a mover saldo).

## 3. Cómo evita duplicados

Tres capas: el índice único parcial por `production_order_id`, la función que actualiza el movimiento existente en vez de insertar otro, y el ajuste de saldo por diferencia (delta) en lugar de por monto total. Refrescar la pantalla no ejecuta nada: los movimientos los crea la base de datos, no la UI.

## 4. Resumen de Partidas (UI)

En `src/pages/core/CoreFabricationFunds.tsx`, las cards pasan a:
- **Partida generada**: histórico por ventas (sin cambios).
- **Asignado a OP**: suma de `production_allocated` de OP activas (valor absoluto).
- **Ejecutado**: OP completadas/cerradas (`production_executed`).
- **Disponible real sin asignar**: general de fabricación − asignado a OP activas.

Se mantienen separadas y sin tocar: Liberado por no restock, Proveedores externos, Pendiente por resolver. Se agrega en Movimientos el filtro "Producción" y etiquetas para los tres tipos nuevos.

## 5. Alcance

Sin backfill: las OP existentes no generan movimientos; solo aplica hacia adelante. No se tocan Woo, QR, nómina, procesos, inventario, ventas históricas, reemplazos, proveedor externo ni no restock.

## Validación

OP nueva por $50 → Partida generada igual, Asignado a OP +$50, Disponible real −$50; refrescar no duplica; cancelar la OP libera los $50. Typecheck 0 errores.
