# Transferir trabajo de nómina entre operarios

Permitir corregir la adjudicación de un trabajo escaneado cuando quedó asignado al operario equivocado, moviendo solo el dinero/crédito laboral, sin tocar el avance de fabricación.

## Qué verá el usuario

En Core → Nómina, cada trabajo pendiente tendrá un botón **Transferir**:

- Pestaña "Trabajos pendientes" (tabla de trabajos).
- Pestaña "Por operario" → Detalle expandido de cada operario (lista de unidades/procesos).
- Pestaña "Sin tarifa" (misma tabla, mismos trabajos aún no incluidos en nómina).

Modal "Transferir trabajo":

- Operario actual (solo lectura)
- Unidad / código QR (solo lectura)
- Proceso (solo lectura)
- Monto actual (solo lectura)
- Nuevo operario (selector obligatorio, operarios activos)
- Motivo de transferencia (obligatorio)
- Botones: Cancelar / Confirmar transferencia

Si el trabajo ya fue incluido en una nómina generada/pagada, el botón queda deshabilitado y al intentar se muestra: "Este trabajo ya está en una nómina cerrada. Requiere ajuste manual."

Tras confirmar, se recargan solo los datos de nómina: el operario anterior baja en cantidad de trabajos y monto pendiente; el nuevo operario sube. La unidad y el proceso siguen igual de completados en producción.

## Regla de negocio

- Solo se transfieren trabajos con estado `pending` o `missing_rate` y sin vínculo a ninguna nómina.
- Se conserva el monto original del trabajo (tarifa ya capturada en el escaneo). No se recalcula con la tarifa del nuevo operario, para que el costo de la orden no cambie.
- No se modifica ni el escaneo, ni la unidad, ni el proceso, ni la orden de producción, ni el inventario.

## Detalles técnicos

Base de datos (migración):

- Nueva función `public.core_transfer_work_entry(p_work_entry_id uuid, p_new_operator_id uuid, p_reason text)`, `security definer`, restringida a roles admin/manager:
  1. Bloquea y lee la fila de `core_production_work_entries`.
  2. Rechaza si `payroll_status` no está en (`pending`, `missing_rate`) o si existe fila en `core_payroll_work_entry_links` para ese `work_entry_id` → devuelve el mensaje de nómina cerrada.
  3. Valida que el nuevo operario exista y esté activo, y que sea distinto del actual.
  4. Actualiza únicamente `operator_id`, `operator_name_snapshot` y agrega una línea de trazabilidad a `notes`. No toca `production_unit_id`, `production_unit_process_id`, `scan_event_id`, `production_order_id`, `payroll_status`, `payroll_amount` ni `rate_snapshot`.
  5. Inserta la auditoría en `core_audit_logs` (`table_name = 'core_production_work_entries'`, `record_id = work_entry_id`, `action = 'payroll_work_transfer'`) con JSON: `work_entry_id`, `unit_id`, `unit_code`, `process_id`, `process_name`, `previous_operator_id/name`, `new_operator_id/name`, `amount`, `reason`, `transferred_at`, `transferred_by`.
  6. Devuelve JSON de resultado para la UI.

Frontend:

- Nuevo componente `src/components/core/payroll/TransferWorkEntryDialog.tsx` con el formulario y la llamada al RPC (carga operarios activos desde `core_factory_operators`).
- `src/pages/core/CorePayroll.tsx`: columna de acciones con botón "Transferir" en `WorkEntryTable` y en el detalle por operario de `OperatorsPendingPanel`; al confirmar se llama al `loadAll()` existente (recarga solo datos de nómina, sin refrescar la app).

No se modifican archivos de OP, QR, escaneo, inventario, partidas, Woo ni costos.

## Validación

- Transferir de Operario A a B: A pierde trabajo y monto, B los gana, sin duplicados.
- Orden de producción, unidad, proceso completado y escaneo intactos.
- Trabajo ya vinculado a nómina: bloqueado con mensaje, sin cambios en datos.
- Registro de auditoría creado en cada transferencia.
- Typecheck con 0 errores.
