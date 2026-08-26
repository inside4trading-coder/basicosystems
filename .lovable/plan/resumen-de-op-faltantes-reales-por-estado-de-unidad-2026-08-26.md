# Resumen de OP: faltantes reales por estado de unidad

Solo cambio visual/cálculo en `src/pages/core/CoreProductionOrders.tsx`. Sin tocar backend, QR, escaneo, inventario, nómina ni Woo.

## Qué está mal hoy

La tabla y el drawer muestran `completed_quantity` / `pending_quantity` de `core_production_orders`. En OP-000010 esos campos valen 1 y 26, mientras las unidades reales son: 23 ingresadas, 1 lista sin ingresar, 2 en producción, 1 sin iniciar (27 en total). Es decir, los contadores de la orden no reflejan el avance real por unidad.

## Nueva lógica (derivada de `core_production_units`, ya cargadas en la página)

Por OP, sobre las unidades activas:

- `inventoried` = estado `entered_inventory` (y `sent_to_store` cuenta como ya salida de fábrica → inventariada)
- `ready_for_inventory` = estado `completed`
- `in_production` = estado `in_production`
- `not_started` = estado `printed` (o cualquier estado restante no cancelado)
- `cancelled` = `cancelled` / `discarded` (aparte, no suma a faltantes)
- `real_pending` = `in_production + not_started`
- `production_done` = `inventoried + ready_for_inventory`
- `total` = activas (fallback a `total_quantity` si aún no hay unidades generadas)

Estado visual de la OP:
- todo inventariado → **Completa**, `27/27 ingresadas`
- todo terminado pero falta ingresar → **Lista para inventario**, `0 en producción · X listas sin ingresar`
- resto → **Parcial**, `23 ingresadas · 1 lista para inventario · 2 en producción · 1 sin iniciar`

## Cambios de UI

1. **Fila de la tabla y card móvil**: la línea `Terminadas 1 · Faltantes 26` pasa a `Inventario 23/27 · Faltan 3 · 1 lista sin ingresar` (el tramo de listas solo si hay). "Faltan" en rojo cuando es > 0.
2. **Columnas de la tabla**: "Faltantes" pasa a mostrar `real_pending` y "Terminadas" pasa a `production_done` (renombrada a "Terminadas prod."), ambas desde las unidades.
3. **Drawer de detalle**: bloque de cards con Total unidades, Ingresadas a inventario, Listas para ingresar, En producción, Sin iniciar, Faltantes reales, Canceladas; más el badge de estado (Completa / Lista para inventario / Parcial) con su subtítulo.
4. Si una OP todavía no tiene unidades generadas, se sigue mostrando el desglose por línea (`quantity_ordered/pending`) como hoy, indicando "sin unidades generadas".

Las cards superiores globales (Inventario / custodia) se mantienen como están.

## Validación

- OP-000010 debe leer `Inventario 23/27 · Faltan 3 · 1 lista sin ingresar` y en detalle 23 / 1 / 2 / 1 / faltantes 3 / canceladas 0.
- Revisar una OP totalmente inventariada (Completa) y una con todo terminado sin ingresar (Lista para inventario).
- `bunx tsc --noEmit` en 0 errores.
