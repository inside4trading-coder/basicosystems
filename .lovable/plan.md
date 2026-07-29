## Objetivo
Dejar Basico Core limpio para arrancar en real el 27/07/2026, conservando catálogo, costos, mapas, políticas, materia prima y todo lo de proveedor externo.

## Estado verificado hoy
- Órdenes de compra externas: 0 filas (y 0 líneas). Lo real externo es: fondo `external_supplier` = 3,40 USD, 1 movimiento externo (`sale_generated`), 1 evento `external_supplier_review` resuelto y 15 políticas con ruta `external_supplier`. Todo eso se conserva.
- A limpiar: 38 unidades, 105 procesos de unidad, 10 escaneos, 2 logs de impresión, 7 OP + 39 líneas + 10 procesos de OP + 33 vínculos, 298 orígenes de necesidad, necesidades, 5 pending items, 4 runs y los movimientos internos (46 internos/pendientes/no-restockable).
- Saldos actuales: general 288,7715 · pending −6 · non_restockable 21,80 · external_supplier 3,40 (intacto).
- Baseline actual: `2026-07-21` en `core-process-fabrication-funds/index.ts` (LATE_CONFIRMED_BASELINE), `CoreFabricationFunds.tsx` (BASELINE_DATE + label) y `coreReconciliation.ts` (RECON_BASELINE).

## Paso 0 — Auditoría read-only (bloqueante)
Antes de cualquier escritura, un bloque de solo lectura que reporte:
- Conteos exactos a borrar y a conservar por tabla.
- Saldos de los 4 fondos antes del reset.
- Lista de backups que se crearán.
- Detalle de los movimientos y eventos `external_supplier` que se conservarán.
- Verificación de existencia de tablas/columnas opcionales (referencias de nómina en entradas de trabajo, logs de impresión, procesos de unidad, procesos de OP, vínculos OP-necesidad, tablas QR/fichas). Lo que no exista se salta y se reporta, sin fallar.

Si algún conteo no coincide con el diagnóstico anterior, se detiene y se reporta sin limpiar nada.

## Paso 1 — Backups
Copias `<tabla>_backup_reset_20260727` (CREATE TABLE AS SELECT) de: movimientos, pending items, runs, eventos de política, necesidades, orígenes de necesidad, OP, líneas de OP, procesos de OP, vínculos OP-necesidad, unidades, procesos de unidad, escaneos, logs de impresión, entradas de trabajo. También backup read-only de órdenes externas y sus líneas (no se borran).

## Paso 2 — Limpieza en una sola transacción (BEGIN/COMMIT, ROLLBACK ante cualquier error)
1. Entradas de trabajo: borrar solo las 2 no vinculadas a nómina; en las 8 con nómina, poner a NULL la referencia a unidad/OP para conservar el histórico.
2. Logs de impresión, procesos de unidad, escaneos → unidades.
3. Vínculos OP-necesidad, procesos de OP, líneas de OP → OP.
4. Orígenes de necesidad → necesidades.
5. Eventos de política: borrar todos EXCEPTO `action = 'external_supplier_review'` y cualquiera con ruta/proveedor externo.
6. Pending items y runs: borrar todos.
7. Movimientos: borrar todos EXCEPTO `fund_bucket = 'external_supplier'` o ligados a órdenes externas.
8. Saldos: `available_amount = 0` en `general`, `pending`, `non_restockable`. `external_supplier` no se toca.

## Paso 3 — Baseline a 2026-07-27
- `core-process-fabrication-funds/index.ts`: `LATE_CONFIRMED_BASELINE = "2026-07-27"`.
- `CoreFabricationFunds.tsx`: `BASELINE_DATE = "2026-07-27"`, label `27/07/2026`.
- `coreReconciliation.ts`: `RECON_BASELINE = "2026-07-27"`.
- Sin tocar `CONFIRMED_STATUSES` ni `REVERTING_STATUSES`.

## Paso 4 — Validación final
Conteos por tabla, saldos (3 internos en 0, externo en 3,40), backups presentes, políticas y evento/movimiento externo conservados, y typecheck.

## Notas técnicas
La limpieza va como operación de datos en transacción; solo los `CREATE TABLE AS` de backup requieren migración de esquema. No se reprocesan ventas ni se tocan Woo, Sublime ni España. `external_supplier` solo se lee.
