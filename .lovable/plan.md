
# Bloque 4 — Estructuras de Costos

Construir el submódulo dentro de BASICO CORE → Catálogo. Solo estructuras de costos: sin Productos Core, sin órdenes, sin QR, sin nómina real.

## 1. Base de datos (migración Supabase)

**Tabla `core_cost_structures`**
- `id`, `name`, `description`, `product_type`, `base_currency` (USD/Bs/EUR)
- `estimated_sale_price` (numeric, nullable), `status` (`draft`/`active`/`inactive`), `notes`
- Totales calculados y persistidos: `total_raw_materials`, `total_labor`, `total_technical_processes`, `total_variable_costs`, `total_logistics`, `total_other_costs`, `total_unit_cost`, `estimated_gross_margin`, `estimated_gross_margin_percent`, `suggested_fabrication_fund`
- `created_at`, `updated_at`, `created_by`, `updated_by`

**Tabla `core_cost_structure_items`**
- `id`, `cost_structure_id` (FK), `section` (`raw_material`/`labor`/`technical_process`/`variable_cost`/`logistics`/`other`)
- `item_type`, `raw_material_id` (nullable, ref a `core_raw_materials`), `name`, `description`
- `unit_of_measure`, `unit_cost`, `quantity`, `subtotal`, `currency`
- `cost_snapshot` (jsonb: costo, fecha, código, nombre RM al momento de agregar)
- Específicos de labor: `process_name`, `process_order`, `adds_to_payroll`, `suggested_role`
- `supplier`, `notes`, `sort_order`, `created_at`, `updated_at`

**RLS:** patrón existente — admin/manager pueden todo (`has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')`).

**Triggers:** `set_updated_at` en ambas tablas.

**Índices:** sobre `cost_structure_id`, `section`, `raw_material_id`.

## 2. Navegación

`CoreLayout.tsx` ya tiene la entrada `/core/estructuras-costos`. Reemplazar el placeholder por la página real y agregar la ruta en `App.tsx`.

## 3. Páginas y componentes nuevos

```
src/pages/core/CoreCostStructures.tsx           — lista + filtros + búsqueda + acciones
src/pages/core/CoreCostStructureEditor.tsx      — editor con constructor por secciones + resumen
src/components/core/cost-structures/
  ├── CostStructureHeader.tsx                   — campos: nombre, tipo, moneda, precio, estado
  ├── CostSummaryPanel.tsx                      — resumen lateral con totales y margen
  ├── RawMaterialSection.tsx                    — selector de materia prima + cantidad + snapshot
  ├── LaborSection.tsx                          — procesos, tarifa, suma a nómina, orden
  ├── TechnicalProcessSection.tsx
  ├── VariableCostSection.tsx
  ├── LogisticsSection.tsx
  └── OtherCostSection.tsx
src/hooks/useCoreCostStructures.ts              — fetch/list/CRUD/duplicar
```

## 4. Pantalla principal (lista)

- Título, descripción y botón "Nueva estructura de costos".
- Tabla: Nombre, Tipo de producto, Costo total unitario, Moneda, Estado, Última actualización, Acciones.
- Filtros: estado, tipo de producto, moneda. Buscador por nombre.
- Acciones por fila: Ver, Editar, Duplicar, Activar/Desactivar, Eliminar (con confirmación).
- Botones (placeholder por ahora): Importar / Exportar / Descargar formato con toast "se conectará al sistema de Templates de Carga en el siguiente ajuste".

## 5. Editor (crear/editar)

Layout: cabecera + tabs o secciones acordeón para los 6 bloques + panel resumen lateral sticky.

**Header:** Nombre*, Descripción, Tipo de producto (Franela, Hoodie, Jogger, Cargo, Short, Gorra, Accesorio, Producto terminado, Otro + permitir texto libre), Moneda base*, Precio de venta estimado, Estado*, Observaciones.

**Sección Materia Prima:**
- Combobox con búsqueda sobre `core_raw_materials` (mostrar código + nombre).
- Al seleccionar: precarga unidad y `unit_cost` actual; guarda `cost_snapshot` con `{ unit_cost, currency, taken_at, code, name }`.
- Inputs: cantidad usada, notas. Subtotal = cantidad × unit_cost (en vivo).

**Sección Mano de Obra:**
- Inputs por línea: nombre del proceso, tipo (Corte, Costura, Estampado, Bordado, Empaque, Otro), tarifa por unidad, switch "Suma a nómina", orden, rol sugerido, notas.

**Secciones Procesos Técnicos / Variables / Logística / Otros:**
- Inputs por línea: nombre, (proveedor o categoría opcional según sección), costo unitario, cantidad, subtotal (calc), notas.

**Validaciones (zod):** nombre y moneda obligatorios; estado obligatorio; costos y cantidades ≥ 0; tarifa labor ≥ 0; precio venta ≥ 0 si presente.

## 6. Cálculos (cliente)

En vivo mientras edita:
- Total por sección = suma de subtotales.
- `total_unit_cost` = suma de todos los totales por sección.
- Si `estimated_sale_price > 0`: `gross_margin = sale_price - total_unit_cost`; `gross_margin_percent = gross_margin / sale_price × 100`.
- `suggested_fabrication_fund = total_unit_cost`.
- Persistir totales al guardar la estructura.

Panel resumen muestra: costo total unitario, precio venta, margen bruto, margen %, partida sugerida, totales por sección.

## 7. Acciones

- **Duplicar:** inserta nueva estructura con sufijo " (copia)", copia todos los items con snapshots intactos, estado `draft`.
- **Activar/desactivar:** toggle status entre `active`/`inactive`.
- **Eliminar:** confirmación. En esta etapa siempre permitido.

## 8. Auditoría

Usar `logCoreAudit` (`src/lib/coreAudit.ts`) para registrar en `core_audit_logs`:
- creación / edición / duplicación / activación-desactivación / eliminación de estructura
- cambios de precio de venta estimado
- creación / cambio / eliminación de líneas (materia prima, mano de obra, etc.)
- cambios de costo unitario o cantidad

Guardar `table_name`, `record_id`, `action`, `field_changed`, `old_value`, `new_value`.

## 9. Snapshot

El `cost_snapshot` jsonb en cada línea de materia prima preserva el costo al momento de agregarla. Cambios futuros en `core_raw_materials` NO modifican estructuras guardadas. (Acción "actualizar costos" queda fuera de este bloque.)

## 10. Limitaciones explícitas de este bloque

No se construye: Productos Core, órdenes, QR, escaneo, nómina real, inventario Woo, importación completa de estructuras.

## Detalles técnicos

- Stack ya existente: React + Vite + Tailwind + shadcn + Supabase client.
- Estado del editor con `useState` + `useMemo` para cálculos; guardar todo en una transacción (delete-then-insert de items o upsert por id).
- Tipos generados automáticamente vía `src/integrations/supabase/types.ts` después de la migración.
- Reutilizar componentes UI existentes (`Table`, `Dialog`, `Input`, `Select`, `Badge`, `Button`, `Tabs`, `Collapsible`).
- Tokens semánticos del design system (sin colores hardcoded).

## Orden de ejecución

1. Migración Supabase (tablas + RLS + triggers + índices) — pedir aprobación.
2. Hook `useCoreCostStructures` + tipos locales.
3. Página de lista `CoreCostStructures.tsx` + ruta.
4. Editor + componentes de sección + panel resumen.
5. Acciones (duplicar, toggle estado, eliminar) + auditoría.
6. Placeholders de import/export.
