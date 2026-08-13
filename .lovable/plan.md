# Propagar cambio de precio de Materia Prima a Estructuras de Costos

## Situación actual (verificada)

- `core_cost_structure_items` guarda snapshot: `raw_material_id`, `unit_cost`, `quantity`, `subtotal`.
- `core_cost_structures` guarda totales agregados (`total_raw_materials`, `total_labor`, `total_technical_processes`, `total_variable_costs`, `total_logistics`, `total_packaging`, `total_other_costs`, `total_unit_cost`, margen, `suggested_fabrication_fund`).
- Los resolvers `resolve_core_variant_unit_cost` y `..._with_source` calculan **en vivo** desde `SUM(core_cost_structure_items.subtotal)`; respetan `cost_override_enabled` de la variante. Por eso, si se actualizan los items, producto y variantes reflejan el nuevo costo sin tocar nada más.
- Al editar materia prima (`CoreRawMaterials.tsx`) solo se hace `update` sobre `core_raw_materials` + auditoría por campo en `core_audit_logs`. No hay propagación.
- Movimientos de Partidas, OP, unidades, nómina y Woo usan snapshots propios y no leen estos items en tiempo de lectura histórica.

## Qué se hará

### 1. Base de datos (una migración)

Nueva función `public.core_propagate_raw_material_cost(p_material_id uuid)`:

- Actualiza `core_cost_structure_items` donde `raw_material_id = p_material_id` y la estructura padre tiene `status = 'active'`:
  - `unit_cost = nuevo costo`, `subtotal = quantity * nuevo costo`, `updated_at = now()`.
- Recalcula, para cada estructura afectada, todos los totales por sección a partir de los items y `total_unit_cost = suma de secciones`; recalcula margen estimado y `suggested_fabrication_fund` con la misma fórmula que ya usa el editor.
- Devuelve `(structures_updated int, items_updated int)`.

Trigger `AFTER UPDATE OF unit_cost ON core_raw_materials` (solo si el valor cambió) que llama a la función. Así el recálculo ocurra la edición desde UI, importación o SQL.

Auditoría: la función inserta una fila en `core_audit_logs` por estructura afectada (`table_name='core_cost_structures'`, `action='raw_material_cost_propagated'`, valor viejo/nuevo del `total_unit_cost`, material y usuario).

No se tocan: estructuras `draft`/`archived`, snapshots de OP, `core_fabrication_fund_movements`, unidades, nómina, QR, inventario ni Woo.

### 2. Overrides

- Variante con `cost_override_enabled = true` apunta a su propia `cost_structure_id`; si esa estructura usa el material y está activa, también se recalcula (es su costo real). No se sobrescribe ningún costo manual: `core_products.manual_unit_cost_usd` y `core_product_variants.variant_unit_cost_usd` quedan intactos.
- `core_products.unit_cost` (fallback legado) no se modifica; los resolvers ya prefieren la estructura.

### 3. UI (`src/pages/core/CoreRawMaterials.tsx`)

- Antes de guardar, detectar si `unit_cost` cambió.
- Tras el update exitoso, consultar cuántas estructuras activas y productos/variantes quedaron vinculados al material y mostrar:
  "Costo actualizado. Se recalcularon X estructuras y Y productos vinculados."
- Si el costo no cambió, se mantiene el mensaje actual.
- En la ficha de detalle de la materia prima se añade una línea con el conteo de estructuras activas que la usan.

## Validación

Caso Jersey Negro $3.00 → $4.00: los items de las estructuras activas que lo usan pasan a `unit_cost = 4.00`, sus `subtotal` y totales se recalculan, y producto/variantes sin override muestran el nuevo costo al refrescar. Variantes con costo manual y todo lo histórico quedan igual. Typecheck al final.
