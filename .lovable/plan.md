# Fix cards superiores en Órdenes de Producción

Los cards se calculan en `kpis` (mismo array `orders` + `bucketOf` que alimenta las pestañas), pero los valores están asignados a las etiquetas equivocadas: mezclan conteo de OP con suma de unidades.

## Qué está mal hoy

- "Abiertas" = OP del bucket `open` (correcto), pero da 0 porque no hay OP abiertas.
- "Unid. pendientes" = suma de `pending_quantity` **solo del bucket open** → 0.
- "En producción" = suma de `pending_quantity` del bucket prod → 119 unidades mostradas como si fueran OP.
- "Completadas prod." = suma de `completed_quantity` del bucket done, etiquetada como si fueran OP.

## Cambios (solo `src/pages/core/CoreProductionOrders.tsx`)

Ampliar el `useMemo` de `kpis` sin cambiar `bucketOf` ni las consultas:

- `open_orders` = `open.length`
- `open_units` = suma de `pending_quantity` de open + prod (unidades pendientes reales de OP no cerradas). Con la data visible: 119.
- `prod_orders` = `prod.length` → 7
- `done_orders` = `done.length`
- `done_units` = suma de `completed_quantity` del bucket done (se conserva como subtexto)
- `closed` / `cancelled` = igual que hoy

Cards resultantes, con label explícito OP vs Unid.:

1. "OP abiertas" → `open_orders`
2. "Unid. pendientes" → `open_units` (subtexto: en OP abiertas y en producción)
3. "OP en producción" → `prod_orders`
4. "OP completadas prod." → `done_orders` (subtexto: `done_units` unid.)
5. "Sin ingresar" (Unid.) → `pendingInventoryUnits`, fuente actual sin cambios
6. "Ingresadas" (Unid.) → `enteredInventoryUnits`, fuente actual sin cambios
7. "Cerradas / Canc." (OP) → sin cambios

Sin valores hardcodeados: todo derivado del mismo `orders` + `unitsByOrder` que usa la tabla.

## No se toca

Backend, WooCommerce, inventario, nómina, QR, procesos ni OP existentes.

## Validación

Contrastar en pantalla: OP en producción 7, Unid. pendientes 119, Sin ingresar 15, Ingresadas 66, y typecheck.
