# Fix cards OP + claridad de faltantes por orden

Los cards se calculan en el `useMemo` de `kpis`, con la misma lista `orders` que alimenta la tabla, pero los valores están asignados a etiquetas equivocadas: mezclan conteo de OP con suma de unidades.

## Qué está mal hoy

- "Abiertas" = OP del bucket `open` (0 porque no hay OP abiertas).
- "Unid. pendientes" = suma de `pending_quantity` **solo del bucket open** → 0.
- "En producción" = suma de `pending_quantity` del bucket prod (119 unidades) mostrada como si fueran OP.
- "Completadas prod." = suma de `completed_quantity` del bucket done (0), cuando lo esperado es lo completado de las OP en producción.

## Cambios (solo `src/pages/core/CoreProductionOrders.tsx`)

Sin tocar consultas, `bucketOf` ni backend. Se amplía `kpis`:

- `open_orders` = `open.length`
- `prod_orders` = `prod.length` → 7
- `prod_pending_units` = suma de `pending_quantity` del bucket prod → 119
- `prod_completed_units` = suma de `completed_quantity` del bucket prod → 32
- `closed` / `cancelled` = igual que hoy
- Sin ingresar / Ingresadas: se mantiene la fuente actual (`allUnits` por estado de unidad) → 15 y 66

Cards y labels finales:

1. OP abiertas → `open_orders`
2. OP en producción → `prod_orders`
3. Unid. pendientes prod. → `prod_pending_units`
4. Unid. completadas prod. → `prod_completed_units`
5. Sin ingresar (Unid.) → `pendingInventoryUnits`
6. Ingresadas (Unid.) → `enteredInventoryUnits`
7. Cerradas / Canc. (OP) → `closed` / `cancelled`

## Claridad Terminadas / Faltantes

- Tabla: la columna "Pend." pasa a llamarse "Faltantes" y "Compl." a "Terminadas", y bajo el código de OP se añade una línea secundaria "Terminadas X · Faltantes Y" con los mismos valores de la fila.
- Drawer de detalle: los bloques "Pendientes prod." / "Completadas prod." se renombran a "Faltantes" / "Terminadas", con un resumen en línea "Terminadas X · Faltantes Y" junto al total de la orden.

Todo derivado de `completed_quantity` / `pending_quantity` reales de cada orden; ningún valor hardcodeado.

## No se toca

Backend, WooCommerce, inventario, nómina, procesos, QR ni OP existentes.

## Validación

En pantalla: OP en producción 7, Unid. pendientes prod. 119, Unid. completadas prod. 32, Sin ingresar 15, Ingresadas 66; y typecheck.
