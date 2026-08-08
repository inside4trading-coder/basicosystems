# Restock POS en Listado de fabricación ES

Cuando una venta POS descuenta inventario comercial, se crea una solicitud de **RESTOCK** en `/espana/listado-fabricacion` en estado **Pendiente de aprobación**, para que el usuario decida si repone la prenda.

No se fabrica automáticamente, no se consumen Blanks/DTF, no se toca WooCommerce, ni Core Venezuela, ni el inventario de materiales, y no se duplican solicitudes.

## Comportamiento

Al confirmar una venta POS, por cada línea vendida se crea un candidato con tipo `pos_restock` y estado `pending_approval`, guardando: venta, línea de venta, número `ES-POS-xxxxxx`, sede (id y nombre), producto, variante, SKU, talla/color, cantidad vendida y fecha.

Aplica a POS interno y POS público, solo en sedes físicas con stock propio o vinculado (Pop Up Ibiza, Arturo Soria, etc.). No aplica a Web / WooCommerce España ni a ventas WooCommerce.

## Listado de fabricación

Cada candidato POS se muestra con:
- Badge **RESTOCK** + Origen **POS**
- Canal/Sede: Pop Up Ibiza / Arturo Soria / la sede correspondiente
- Venta: `ES-POS-xxxxxx`
- Producto, SKU, talla, cantidad sugerida
- Estado: Pendiente de aprobación
- Acciones: **Aprobar restock** / **Rechazar**

Aprobar cambia el estado a Pendiente y entra al flujo normal (Fabricar → validar receta → consumir materiales → listo/enviado). Rechazar lo marca como rechazado, con motivo opcional, sin consumir materiales ni afectar la venta o el inventario.

## Métricas y filtros

- Chips sobre la tabla: **Todos · WooCommerce · POS · RESTOCK · Manual**.
- `pending_approval` aparece en Activos reales pero no cuenta como "pendiente de fabricar"; se muestra como KPI aparte **"Restock pendiente de aprobación"**.

## Detalle técnico

Migración:
- `esp_fabrication_requests`: nuevas columnas `pos_sale_id`, `pos_sale_item_id`, `pos_sale_number`, `pos_location_id`, `pos_location_name`.
- Índice único parcial sobre `pos_sale_item_id` cuando `source_type = 'pos_restock'` (idempotencia).
- `source_type` y `status` son texto libre en esta tabla, así que `pos_restock`, `pending_approval` y `rejected` no requieren cambios de constraint.

Trigger:
- `AFTER INSERT` en `esp_sale_items` → función `esp_create_pos_restock_candidate()` (SECURITY DEFINER): lee la venta padre, descarta ventas canceladas, líneas provenientes de WooCommerce y sedes que no sean `own_stock`/`linked_stock`; inserta el candidato usando los snapshots de la línea con `ON CONFLICT DO NOTHING`. Envuelto en manejo de excepciones para no romper nunca la venta POS. No toca stock ni materiales.

Frontend (`src/pages/espana/EspanaFabricacion.tsx`):
- Extender `FabRow` y el `select` con los campos POS.
- Nuevo estado y badges (RESTOCK / POS / sede / número de venta), acciones Aprobar y Rechazar.
- Chips de origen y KPI separado de restock pendiente.
- Sin botón Fabricar mientras esté en `pending_approval`.

Typecheck con `tsgo` al finalizar.
