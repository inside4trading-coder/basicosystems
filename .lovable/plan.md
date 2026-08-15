# Nómina semanal sin solapes + fusión de NM-000002 y NM-000004

## Causa del duplicado (verificada)

- NM-000002: 01/08 → 07/08, estado "pagada", 102 trabajos, USD 53,44
- NM-000004: 07/08 → 13/08, estado "en revisión", 113 trabajos, USD 66,75

El rango se guarda con `period_end` **inclusivo** y las fechas se eligen a mano en el modal. La única validación existente busca una nómina con exactamente el mismo `period_start` + `period_end`; como las fechas no coinciden, no detecta el solape (ambas incluyen el 07/08) y crea una segunda nómina del mismo período operativo.

Dato confirmado: no hay trabajos repetidos entre las dos (existe una restricción única por trabajo), así que la fusión no puede duplicar montos.

## A. Generación semanal corregida

- Semana operativa: **viernes → jueves**, pago el viernes siguiente. Internamente `period_start` = viernes y `period_end` = jueves (fin inclusivo, como hoy), con el calendario calculado siempre a partir del viernes.
- El modal deja de aceptar fechas libres: se elige la **semana** (semana actual, anterior o siguiente) y las fechas se derivan del calendario, sin solapes posibles.
- Antes de crear, se valida **solape real** contra cualquier nómina no cancelada/no fusionada: si el rango se cruza con una existente, no se crea; se avisa y se abre la existente.
- Solo entran trabajos con estado apto (`pending`), dentro del período, con operario y monto > 0, y sin vínculo previo a ninguna nómina.
- Los trabajos ya vinculados quedan excluidos por la restricción única existente, así que reintentar no duplica.

### Preview obligatorio antes de generar

```text
Se generará la nómina del período: 08/08/2026 → 14/08/2026
Pago: 15/08/2026
Trabajos incluidos: X
Operarios: X
Total: USD X
```

Si detecta solape o ya existe la semana, el botón Confirmar queda bloqueado con el motivo.

## B. Fusión de nóminas

Nueva acción "Fusionar" en la pestaña Nóminas.

Flujo: elegir destino → elegir origen → preview obligatorio → motivo → confirmar.

Preview muestra: códigos, períodos actuales, período consolidado, operarios, trabajos totales, total destino, total origen, total consolidado y advertencia si hubiera trabajos repetidos.

Modal de confirmación con el texto pedido y campo "Motivo de fusión" obligatorio.

Caso a ejecutar: **destino NM-000004, origen NM-000002**. Como NM-000002 figura como "pagada" pero no se pagó realmente, la fusión exige dos condiciones: que no tenga comprobantes de pago registrados y que el usuario marque la casilla "Confirmo que esta nómina no fue pagada realmente y puede fusionarse." Esa confirmación queda guardada en la auditoría. Resultado: una sola nómina activa NM-000004, período consolidado 01/08/2026 → 13/08/2026, 215 trabajos, USD 120,19, fecha de pago conservada la del destino.

## C. Después de fusionar

- NM-000004 queda visible con el total consolidado y la leyenda "Período fusionado: 01/08/2026 → 13/08/2026", diferenciada de una semana operativa normal.
- NM-000002 aparece como "Fusionada → NM-000004", con enlace al destino y su historial intacto.
- La nómina origen conserva su información original guardada (total, trabajos, operarios y período previos a la fusión), visible al abrirla, aunque sus contadores activos queden en 0.
- Las nóminas fusionadas se excluyen de los indicadores de pendientes/aprobadas/pagadas y de los totales, para no contar dos veces.
- Nada se borra.


## Detalles técnicos

Migración:

- `core_payroll_runs`: permitir `status = 'merged'` en el check existente y agregar `merged_into_payroll_id uuid` (FK a la misma tabla), `merged_at timestamptz`, `merged_reason text`.
- Nueva RPC `public.core_merge_payrolls(p_target_payroll_id uuid, p_source_payroll_id uuid, p_reason text)`, `security definer`, restringida a admin/manager:
  1. Bloquea ambas filas; valida existencia, que sean distintas y que ninguna esté ya fusionada o cancelada.
  2. Bloquea si el destino está pagado; si el origen está pagado exige que no tenga comprobantes de pago registrados (`core_payroll_payment_proofs`).
  3. Reasigna `core_payroll_operator_lines` del origen al destino; si el operario ya tiene línea en el destino, fusiona las dos líneas (suma procesos, subtotales y ajustes) y reapunta sus `core_payroll_work_entry_links`; si no, mueve la línea completa.
  4. Reapunta los `core_payroll_work_entry_links` del origen al destino y a la línea correspondiente. La restricción única por `work_entry_id` garantiza que ningún trabajo quede duplicado; los `core_payroll_adjustments` siguen a su línea.
  5. Recalcula el destino desde los vínculos reales: `work_entries_count`, `operators_count`, `total_amount`, `adjustments_total`.
  6. Ajusta el período del destino: `period_start` = menor de ambos, `period_end` = mayor de ambos; `payment_date` se conserva del destino.
  7. Marca el origen: `status='merged'`, `merged_into_payroll_id`, `merged_at`, `merged_reason`, contadores y total en 0 para que no sume en reportes (los vínculos ya se movieron).
  8. Inserta auditoría en `core_audit_logs` (`action = 'payroll_merged'`) con origen, destino, motivo, usuario, total anterior del destino, total del origen y total nuevo.
  9. Devuelve JSON para la UI.

Frontend:

- `src/components/core/payroll/MergePayrollsDialog.tsx` (nuevo): selectores destino/origen, preview calculado desde los vínculos reales, motivo obligatorio, llamada a la RPC.
- `src/components/core/payroll/GeneratePayrollDialog.tsx` (nuevo): selector de semana, cálculo viernes→jueves, detección de solape y preview del período/pago/trabajos/total.
- `src/pages/core/CorePayroll.tsx`: usar ambos diálogos, badge "Fusionada → NM-xxxxx" en la tabla, excluir `merged` de KPIs y de la búsqueda de nómina de la semana actual.

No se tocan Woo, órdenes de producción, QR, escaneos, inventario, Partidas ni los trabajos históricos.

## Validación

- Generar la semana actual dos veces: la segunda queda bloqueada por solape, sin duplicar.
- Fusionar NM-000002 en NM-000004: queda una sola nómina activa con 215 trabajos y USD 120,19, sin repetidos.
- NM-000002 con estado "Fusionada → NM-000004" y sin sumar en cards ni reportes.
- Auditoría registrada.
- Typecheck con 0 errores.
