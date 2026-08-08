# Restock POS en Listado de fabricación

Cuando una venta POS (sede física, ej. Pop Up Ibiza) descuenta inventario comercial, se crea un **candidato de restock** que aparece en `/espana/listado-fabricacion` claramente diferenciado de los pedidos WooCommerce, en estado **Pendiente de aprobación**, con acciones **Aprobar restock** / **Rechazar**.

No se fabrica nada automáticamente, no se consumen Blanks/DTF, no se toca WooCommerce ni Core Venezuela.

## Comportamiento

1. La venta POS sigue funcionando igual (descuenta stock comercial).
2. Por cada línea vendida se genera automáticamente una solicitud de tipo RESTOCK con:
   - Badge **RESTOCK** + Origen **POS**
   - Sede / canal: nombre de la sede (Pop Up Ibiza, Arturo Soria, etc.)
   - Venta: número `ES-POS-xxxxxx`
   - Producto, SKU, talla, cantidad sugerida (= unidades vendidas)
   - Estado: Pendiente de aprobación
3. En el listado el usuario decide:
   - **Aprobar restock** → pasa a Pendiente (flujo normal: Fabricar → consume materiales → Listo → Entregar).
   - **Rechazar** → queda descartado, sin consumir materiales.
4. Nunca se duplica: una misma línea de venta genera como máximo un candidato.

Aplica tanto a ventas del POS interno como del POS público. Solo para sedes con stock propio/vinculado (no Web/WooCommerce).

## Filtros

Chips de origen sobre la tabla: **Todos · WooCommerce · POS · RESTOCK · Manual**.
El nuevo estado "Pendiente de aprobación" se muestra dentro de la pestaña de activos reales.

## Detalle técnico

Base de datos (una migración):
- Añadir a `esp_fabrication_requests`: `pos_sale_id`, `pos_sale_item_id` (único), `pos_sale_number`, `pos_location_id`, `pos_location_name`, `restock_status` implícito vía `status`.
- Permitir `source_type = 'pos_restock'` y nuevo `status = 'pending_approval'` (y `rejected`), actualizando labels/constraints existentes.
- Índice único parcial sobre `pos_sale_item_id` para idempotencia.
- Trigger `AFTER INSERT` en `esp_sale_items` que inserta el candidato: resuelve producto/variante/SKU/talla desde los snapshots de la línea y sede desde `esp_sales.location_id`; se omite si la sede es la de WooCommerce o si ya existe candidato para esa línea. El trigger no toca stock ni materiales.
- GRANT/RLS: se reutilizan las políticas actuales de `esp_fabrication_requests`.

Frontend (`src/pages/espana/EspanaFabricacion.tsx`):
- Extender `FabRow` y el `select` con los campos POS.
- Nuevo badge morado/teal **RESTOCK** + chip **POS** y columna Sede/Venta reutilizando la columna "Pedido" (muestra `ES-POS-xxxxxx · Pop Up Ibiza`) y "Cliente / destinatario" (muestra la sede).
- Estado `pending_approval` con badge propio y acciones **Aprobar restock** (pasa a `pending`) y **Rechazar** (pasa a `rejected` con motivo opcional).
- Sustituir el selector "Origen" por chips: Todos / WooCommerce / POS / RESTOCK / Manual.
- Las filas en `pending_approval` no muestran el botón Fabricar.

Sin cambios en POS, WooCommerce, Core ni en la lógica de consumo de materiales.
