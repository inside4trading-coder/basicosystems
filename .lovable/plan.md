# Fix estado OP: no marcar "Completada" si faltan prendas por ingresar a inventario

## Causa verificada

`OP-000014` tiene `core_production_orders.status = 'completed'` y sus 6 unidades están en estado `completed` (listas, 0 ingresadas). En `src/pages/core/CoreProductionOrders.tsx`:

- `bucketOf()` devuelve `"done"` en cuanto el estado guardado de la OP está en `DONE_STATUSES = ["completed"]`, **sin mirar las unidades**. Por eso cae en la pestaña Completadas.
- El badge de estado de la fila usa `STATUS_LABEL[o.status]` (texto "Completada", verde), también sin mirar las unidades.
- El detalle (drawer) ya calcula bien "Completa / Lista para inventario / Parcial" desde `invByOrder`, de ahí la inconsistencia entre listado y detalle.

## Cambios (solo `src/pages/core/CoreProductionOrders.tsx`)

### 1. Estado operativo derivado (fuente única)

Añadir un helper `operationalOrderState(order, inv)` que use `computeInvStats` ya existente y devuelva:

- `cancelled` — OP cancelada
- `closed` — OP cerrada/cierre manual
- `completed` — `has_units && pending === 0 && pending_inventory === 0 && entered === total`
- `ready_for_inventory` — `pending === 0 && pending_inventory > 0`
- `in_production` — `pending > 0`
- si no hay unidades generadas: se mantiene el estado guardado (Borrador/Abierta)

### 2. Badge de estado en la tabla

El badge deja de leer solo `o.status`: si hay unidades, muestra el estado operativo.

- `Completada` (verde) solo cuando todas las unidades están ingresadas.
- `Lista para inventario` (ámbar/naranja) cuando la producción terminó pero quedan listas sin ingresar, con subtítulo `Inventario 0/6 · 6 pendientes`.
- `Parcial / En producción` cuando hay faltantes reales, con detalle `X en producción · Y sin iniciar · Z listas para ingresar`.
- Cerrada / Cancelada mantienen prioridad sobre el cálculo por unidades.

### 3. Tabs / buckets

`bucketOf()` pasa a decidir por el estado operativo, no por `DONE_STATUSES`:

- Cancelada → `cancelled`; Cerrada/Cierre manual → `closed` (sin cambios).
- Cualquier OP con `pending_inventory > 0` o `pending > 0` → `prod` ("En producción"), aunque su estado guardado sea `completed`.
- `done` ("Completadas") solo con inventario completo.
- OP sin unidades generadas conservan el comportamiento actual.

### 4. Cards superiores

- "OP completadas" cuenta solo el bucket `done` con la regla nueva (OP-000014 sale de ahí y entra a producción).
- "Unid. terminadas prod." sigue sumando ingresadas + listas (la producción sí terminó).
- Las cards de custodia (Listas sin ingresar / Ingresadas) no cambian.

### 5. Detalle (drawer)

Cuando `pending_inventory > 0`, añadir alerta naranja/roja:

"6 prendas listas sin ingresar a inventario. Riesgo operativo: existen físicamente pero aún no están registradas como stock."

El botón de Inventario por unidad se mantiene igual.

## No se toca

QR, escaneo, inventario real, Woo write, nómina, costos, movimientos financieros, generación de unidades y procesos. No hay cambios de base de datos: el estado guardado de la OP no se reescribe, solo cambia su presentación y clasificación visual.

## Validación

OP-000014 → badge "Lista para inventario", `Inventario 0/6 · 6 pendientes`, aparece en "En producción" y no en "Completadas". OP con 6/6 ingresadas → "Completada". OP con faltantes reales → "Parcial / En producción". Typecheck 0 errores.
