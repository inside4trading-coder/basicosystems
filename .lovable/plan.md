## Estado verificado (lecturas hechas en base de datos)

- `core_fabrication_fund_movements` con `fund_bucket = 'external_supplier'`: 1 `sale_generated` **posted** ($5.34, Gorra Vintage Washed Azul Marino, pedido Woo 34411 / item 29305), 1 `sale_generated` **reversed** ($3.40, Pack de anillos) y su `reversal` (-$3.40, razón "Reverso por estado cancelled", pedido 34281 = `cancelled`). Neto del pack = $0.
- `core_external_purchase_order_lines` está **vacía**: ninguna prenda tiene línea de compra externa todavía.
- El evento de la Gorra existe (`a25ff41f…`, `action = external_supplier_review`, qty 1, costo 5.34) pero con `status = 'resolved'` (resuelto por el flujo de revalidación), por eso el filtro `open/reviewed` de `usePendingExternalEvents()` lo excluye.
- El RPC `core_create_external_purchase_orders_from_events` **no valida el status del evento**: solo exige `action = 'external_supplier_review'` y que no exista línea previa. Por tanto un evento `resolved` puede convertirse en orden sin tocar backend.

## Cambios

### 1. `src/hooks/useExternalPurchaseOrders.ts` — nueva fuente de `usePendingExternalEvents()`

Fuente principal: `core_fabrication_fund_movements` con `fund_bucket = 'external_supplier'`, `movement_type = 'sale_generated'`, `status = 'posted'` (esto ya excluye reversados y reversos).

Para cada movimiento:
- Buscar evento en `core_replenishment_policy_events` con `action = 'external_supplier_review'`, **sin filtrar por status**, por `source_id = movement.id`, con fallback por `woo_order_item_id = movement.source_order_item_id`.
- Excluir el movimiento si su evento ya tiene línea en `core_external_purchase_order_lines`.

Fila devuelta (tipo `PendingExternalRow`, reemplaza/extiende `PendingExternalEvent`):
`movement_id`, `event_id | null`, `product_name`, `sku`, `variant_label`, `quantity`, `unit_cost`, `source_order_id`, `source_order_item_id`, `supplier_name` (evento → política), `core_product_id`, `core_variant_id`, `status` derivado ("Pendiente de compra").

Enriquecimiento de nombre/variante desde el movimiento primero (`product_name`, `sku`), y `core_products` / `core_product_variants` solo como respaldo.

### 2. `src/components/core/woocore/external/ExternalPendingEventsList.tsx`

- Columnas: Checkbox · Producto · Variante/talla · Proveedor · Cantidad · Costo unit. · Pedido / order_item · Estado.
- Nombre y SKU tomados del movimiento (se acaban los UUID en pantalla).
- Filas **con** `event_id`: seleccionables; "Crear orden externa" sigue usando `ExternalOrderPreviewDialog` + RPC actual, pasando los `event_id`.
- Filas **sin** `event_id`: badge "Sin evento", checkbox deshabilitado y tooltip "No se puede crear orden externa porque falta evento external_supplier_review."
- Se mantiene el aviso de "sin proveedor configurado".

## Reglas respetadas
- Sin migraciones, sin tablas nuevas, sin edge functions, sin tocar Woo, OP, QR, inventario ni saldos.
- El reverso del pack de anillos queda como está (es correcto) y no aparece en pendientes.

## Validación
- `/core/mapa-woo-core → Reposición externa → Órdenes a proveedor → Pendientes` muestra exactamente la Gorra Vintage ($5.34), seleccionable.
- Coincide con `/core/necesidades → Proveedor externo` y con el dinero de `external_supplier` en Partidas.
- Typecheck 0 errores.
