## Auditoría read-only (ya ejecutada)

OP-000008 → `f8254185-183c-4cd0-b961-6187545cf42a`

| Dato | Valor |
|---|---|
| Estado actual | `partially_completed` |
| Cantidad total / completada / pendiente | 9 / 1 / 8 |
| Líneas | 9 (una con `quantity_completed = 1`) |
| Unidades/QR | 9 (6 `printed`, 2 `in_production`, 1 `completed`) |
| Procesos de unidad | 23 (6 completados) |
| Escaneos | 9 |
| Entradas de trabajo | 6, todas `payroll_status = pending` |
| Vínculos a nómina cerrada/pagada | **0** (`core_payroll_work_entry_links` sin filas) |
| Unidades en inventario | 0 |
| Impresiones | 9 unidades con `print_count > 0` (se conservan) |

Conclusión: no hay nómina cerrada ni pagada, así que las 6 entradas de trabajo se pueden eliminar sin reversas lógicas.

## Backups (migración, sufijo `_backup_reset_op000008_20260731`)

Crear tablas nuevas con `CREATE TABLE ... AS SELECT` filtrando solo por OP-000008:

- `core_production_scan_events_backup_reset_op000008_20260731`
- `core_production_unit_processes_backup_reset_op000008_20260731`
- `core_production_work_entries_backup_reset_op000008_20260731`
- `core_production_units_backup_reset_op000008_20260731`
- `core_production_order_lines_backup_reset_op000008_20260731`
- `core_production_orders_backup_reset_op000008_20260731`

Sin RLS pública ni GRANTs a `anon`/`authenticated` (son tablas técnicas de respaldo; solo `service_role`).

## Limpieza (misma migración, una transacción)

A. Borrar `core_production_work_entries` de la OP (6 filas, ninguna ligada a nómina).

B. Borrar `core_production_scan_events` de la OP (9 filas).

C. Resetear `core_production_unit_processes` de unidades de la OP (23 filas):
`status = 'pending'`, `completed_at = null`, `completed_by_operator_id = null`, `scanned_by_user_id = null`, `notes = null`, `updated_at = now()`.

D. Resetear `core_production_units` (9 filas) conservando `unit_code`, `qr_token`, `qr_payload`, `print_count`, `printed_at`:
`status = 'printed'` si tienen impresión (todas la tienen), `entered_inventory_at/by = null`, `inventory_entry_source = null`.

E. Resetear líneas: `quantity_completed = 0`, `quantity_pending = quantity_ordered`, `status = 'pending'`.

F. Resetear cabecera: `completed_quantity = 0`, `pending_quantity = total_quantity` (9), `status = 'open'`. No se toca `total_quantity`.

G. Registrar una fila en `core_audit_logs` con la acción `reset_op_progress`.

## Fuera de alcance (no se toca)

Woo, Partidas de fabricación, Necesidades, saldos, inventario, otras OP, unidades/QR (no se borran), líneas (no se borran), la OP (no se borra).

## Validación posterior

Consultas read-only para confirmar: OP existe con `status = open` y avance 0/9; 9 líneas; 9 unidades con su `unit_code`/`qr_token` intactos; 0 procesos completados; 0 escaneos; 0 work entries. Más `tsgo` (no hay cambios de código frontend previstos, pero se verifica).
