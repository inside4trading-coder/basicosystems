# Corrección del generador + reversión quirúrgica del run 182c7ea6

Incidente auditado: `generation_run_id = 182c7ea6-490f-491e-9dc0-e5616f7d8785` (6 sep 2026, 22:03–22:05 UTC).
Causa raíz confirmada: la consulta que comprueba "qué partidas ya se convirtieron antes" se envía con cientos de identificadores en una sola petición; al superar el límite falla, el código descarta el error y continúa como si **ninguna** partida se hubiera procesado, regenerando todo el histórico.

## Fase 1 — Preflight obligatorio (solo lectura)

Recalcular en base de datos justo antes de escribir:

1. Filas con ese `generation_run_id`.
2. Cuáles tienen vínculo en `core_production_need_sources` y cuáles no.
3. Suma real de cantidades de las partidas vinculadas, por necesidad.
4. Estado actual de `ec8e4675-bece-4e03-9158-3fcf9332b6d7`.

Umbral de continuidad: ~192 tocadas, ~170 sin vínculo, ~22 con vínculo. Si no cuadra de forma consistente, **abortar y reportar** sin escribir nada.

## Fase 2 — Corrección permanente del generador

Archivo: `supabase/functions/core-generate-production-needs/index.ts`.

1. **Nunca ignorar errores.** Las lecturas de vínculos, anulaciones, control de reposición, variantes y productos capturan `error`. Ante cualquier error: no se inserta nada, el run se registra como `failed` y el usuario ve "No se pudo validar el historial de partidas. No se generó ninguna necesidad."
2. **Consultas por lotes.** Helper reutilizable que trocea los identificadores en bloques de 150 y une resultados. Se aplica a partidas ya vinculadas y a anulaciones. Si falla cualquier lote, se aborta la generación completa (nunca resultado parcial).
3. **Idempotencia real en base de datos.** Nueva RPC `core_create_need_from_movements` que, en una sola transacción: bloquea las partidas indicadas, descarta las que ya tengan vínculo, y solo si queda alguna partida nueva crea o actualiza la necesidad y inserta sus vínculos. Si no queda ninguna partida nueva, no crea nada ni incrementa cantidades. La función de servidor deja de insertar necesidad y vínculo por separado.
4. **Cantidad = solo partidas nuevas.** `quantity_needed` se calcula exclusivamente con la suma de las partidas contabilizadas, no anuladas, no bloqueadas y sin vínculo previo. Nunca se re-agrega histórico.
5. **Simulación y sanity check.** La simulación devuelve: partidas revisadas, ya procesadas, nuevas, bloqueadas, anuladas, necesidades a crear, a actualizar y unidades nuevas reales. Si existen vínculos históricos en la base y "ya procesadas" da 0, se bloquea la ejecución con el mensaje "Resultado anómalo detectado. La generación ha sido cancelada para evitar duplicados." La pantalla `CoreProductionNeeds.tsx` muestra ese desglose y el bloqueo.

## Fase 3 — Reversión quirúrgica (una sola RPC transaccional)

Nueva RPC `core_revert_needs_run(p_run_id uuid)`, acotada exclusivamente a ese run. No actúa por fecha, producto ni estado general.

1. **170 duplicadas** (mismo run, sin vínculo): pasan a `ignored` con la nota "Anulada automáticamente por corrección del incidente 182c7ea6: generación duplicó demanda histórica ya procesada." No se borra nada físicamente, no se crean ni borran vínculos, no se tocan partidas. Un evento de auditoría por fila.
2. **22 legítimas** (mismo run, con vínculo): se conservan. `quantity_needed` se recalcula como la suma real de las cantidades de sus vínculos actuales (no se asume 1). Se mantienen producto, variante, talla, prioridad, origen, vínculos, aprobaciones y conversiones.
3. **Cantidades derivadas**: `quantity_pending = quantity_needed − quantity_converted_to_order`, con suelo 0; `quantity_approved` no se toca salvo que exceda lo necesario, en cuyo caso se limita. No se resetea ningún estado.
4. **`ec8e4675-…` (preexistente)**: se lee la auditoría del run para obtener el valor previo y se resta exactamente el delta que introdujo esta ejecución. Se conservan `approved`, la unidad ya convertida, sus vínculos y su historial.
5. **Los 24 vínculos nuevos se conservan**: corresponden a partidas realmente nuevas.
6. **3 eventos de política del run**: se revisan uno a uno; se anulan por el mecanismo de auditoría existente solo los que provienen de una necesidad que queda anulada, y se conservan los asociados a demanda legítima.
7. **No se tocan** partidas, órdenes de producción, inventario, reservas, fondos, movimientos ni WooCommerce.

**Validaciones antes de confirmar (si falla una, rollback completo):** 0 partidas modificadas, 0 órdenes, 0 inventario, 0 fondos, ningún vínculo histórico eliminado, 170 anuladas, legítimas con sus vínculos intactos, `ec8e4675…` conserva aprobación y conversión, sin cantidades negativas, `pending ≤ needed`, `converted` no disminuye, `approved` legítimo intacto.

## Fase 4 — Verificación

- Simulación de "Generar desde partidas": el histórico ya procesado no reaparece; se reporta el desglose completo.
- Comprobación conceptual de idempotencia con la simulación (no se ejecuta generación real de prueba para no introducir demanda ficticia).
- Informe final con archivos modificados, tamaño de lote, manejo de errores, mecanismo de atomicidad, cifras de la reversión y las cinco confirmaciones de "0 modificados".

## Detalle técnico

- Migraciones nuevas: `core_create_need_from_movements(...)` y `core_revert_needs_run(uuid)`, ambas `security definer`, `search_path = public`, restringidas a admin/manager vía `has_role`.
- Cambios de código: `supabase/functions/core-generate-production-needs/index.ts` (helper `chunkedIn`, propagación de errores, run `failed`, uso de la RPC atómica, respuesta de simulación ampliada) y `src/pages/core/CoreProductionNeeds.tsx` (desglose de simulación, bloqueo por anomalía, mensaje de aborto).
- No se modifica ninguna tabla existente ni sus datos fuera del alcance descrito.
