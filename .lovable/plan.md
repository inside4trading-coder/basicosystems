# Unificar cálculos del listado de Órdenes de Producción

Solo `src/pages/core/CoreProductionOrders.tsx`. Sin backend, sin QR/escaneo, sin inventario real, sin nómina, Woo ni costos.

## Qué está inconsistente hoy

- La tabla ya usa `computeInvStats` (por unidad): Total, Faltantes reales, Terminadas prod.
- Las cards de **Producción activa** NO: `prod_pending_units` y `prod_completed_units` suman `pending_quantity` / `completed_quantity` de `core_production_orders`, los mismos campos desalineados que causaron el error de OP-000010 (1 y 26 contra 24 y 3 reales).
- Las cards de **Inventario / custodia** filtran estados crudos: `status === "completed"` y `status === "entered_inventory"`, ignorando `sent_to_store` (que sí cuenta como ingresada en `computeInvStats`) y sin excluir unidades de OP canceladas.
- `productionDoneByOrder` (usado por `bucketOf` para las tabs) repite su propio criterio por estado en vez de usar las estadísticas ya calculadas.

Resultado: tres definiciones distintas en la misma pantalla.

## Fuente única de cálculo

Se mantiene `computeInvStats(units, fallbackTotal)` como la única función y se renombran/exponen los campos con los nombres operativos oficiales:

```text
total_units, inventoried_units, ready_for_inventory_units,
in_production_units, not_started_units, cancelled_units,
finished_production_units = inventoried + ready
real_pending_units        = in_production + not_started
```

(Se conservan los alias actuales para no romper el drawer ya corregido.)

`invByOrder` sigue siendo el mapa por OP y pasa a alimentar **todo**: tabla, drawer, cards superiores, cards de custodia y tabs.

## Cambios

1. **Cards de Producción activa** — sobre las OP del bucket `prod`:
   - "Unid. faltantes prod." = Σ `real_pending_units`
   - "Unid. terminadas prod." = Σ `finished_production_units`
2. **Cards de Inventario / custodia** (global de OP cargadas, excluyendo OP canceladas):
   - "Listas sin ingresar" = Σ `ready_for_inventory_units`
   - "Ingresadas a inventario" = Σ `inventoried_units`
3. **Tabla**: sin cambio de valores (ya correctos); el badge de Inventario pasa a formato compacto uniforme:
   - todo ingresado → `Completo 27/27`
   - parcial → `23/27 · 1 pend.` (rojo si hay listas sin ingresar)
   - nada producido → `Sin producir`
4. **Tabs**:
   - `productionDoneByOrder` se deriva de `invByOrder`: una OP está fuera de "En producción" solo si `real_pending_units = 0` **y** `ready_for_inventory_units = 0`.
   - "Completadas": `real_pending = 0`, `ready = 0`, `inventoried = total`.
   - "Cerradas"/"Canceladas": sin cambios (estado de la orden).
   - Efecto: una OP sin producción pendiente pero con listas sin ingresar sigue en "En producción" (requiere acción).

## Validación

- OP-000010: Total 27 · Faltantes reales 3 · Terminadas prod. 24 · Inventario `23/27 · 1 pend.`
- Suma de cards superiores coherente con la suma de las filas visibles del bucket.
- `bunx tsgo --noEmit -p tsconfig.app.json` en 0 errores y build OK.
