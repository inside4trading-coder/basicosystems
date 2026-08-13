# Fix: error uuid/text al guardar Materia Prima

## Causa exacta (verificada)

En `public.core_propagate_raw_material_cost(p_material_id uuid)` la auditoría inserta:

```sql
INSERT INTO public.core_audit_logs (table_name, record_id, action, ...)
VALUES ('core_cost_structures', r.id::text, ...)
```

`core_audit_logs.record_id` es `uuid`, y Postgres no castea `text` a `uuid` implícitamente en un INSERT, así que el trigger `AFTER UPDATE OF unit_cost ON core_raw_materials` aborta el UPDATE completo con
`column "record_id" is of type uuid but expression is of type text`.

La tabla real tiene solo estas columnas: `table_name, record_id (uuid), action, field_changed, old_value (text), new_value (text), performed_by (text), created_at`. No existe `old_values/new_values/metadata` jsonb.

El insert de auditoría del frontend (`CoreRawMaterials.tsx` → `logAudit`) ya envía el `id` UUID del registro; no requiere cambios.

## Qué se hará

Una sola migración que hace `CREATE OR REPLACE` de `core_propagate_raw_material_cost` con un único cambio en el INSERT de auditoría:

- `record_id = r.id` (UUID de la estructura de costos), sin `::text`.
- Se conserva el resto igual: `table_name = 'core_cost_structures'`, `action = 'raw_material_cost_propagated'`, `field_changed = 'total_unit_cost'`, `old_value`/`new_value` con los totales.
- El código/nombre del material se sigue guardando como texto descriptivo en `performed_by` (usuario · material=...), ya que no hay columna jsonb de metadata; no se agregan columnas nuevas.

No se toca la lógica de propagación: sigue actualizando `unit_cost`/`subtotal` de los items de estructuras `active`, recalculando totales por sección, `total_unit_cost`, margen y `suggested_fabrication_fund`, y respetando overrides e histórico.

No se modifica: Woo, OP, Partidas/movimientos, nómina, QR, inventario ni unidades. Sin cambios de frontend.

## Validación

Editar la materia prima código 100 / Jersey negro, cambiar el costo unitario y guardar: debe guardar sin error, propagar a las estructuras activas vinculadas y registrar auditoría con `record_id` UUID. Typecheck al final.
