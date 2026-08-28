# Consistencia entre "Requieren atención" y "Órdenes a proveedor"

## Diagnóstico (verificado en la base de datos)

`usePendingExternalEvents` (en `src/hooks/useExternalPurchaseOrders.ts`) arma la cola de reposición externa con un filtro rígido:

`fund_bucket = 'external_supplier'` **AND** `movement_type = 'sale_generated'` **AND** `status = 'posted'`.

Lo que muestran los datos:

- **#35208 / item 29693 (PIN0003)** y **#35176 / item 29667 (BEANIE001)**: movimientos `sale_generated` en partida `external_supplier`. Por eso sí aparecen. Correcto.
- **#34786 / item 29466 (GORRA0001)**: se resolvió desde "Requieren atención" con la acción *Confirmar como reposición externa*. Eso dejó el movimiento original en `internal_factory` marcado `unlinked_core_resolution.action = external_supplier` y creó el par out/in; el movimiento que quedó en la partida `external_supplier` es de tipo **`replacement_reclassification_in`**, no `sale_generated`. El filtro lo descarta → nunca llega a Órdenes a proveedor. **Esta es la causa principal (casos 7/8 de la lista).**
- **#34519 / item 29372** y **#34373 / item 29263** (misma gorra): se resolvieron antes como **`no_restock`**; su dinero está en la partida `non_restockable`, no en proveedores. Operativamente **no deben** entrar a la cola externa; hoy la UI no explica por qué, y la fila puede leerse como "Proveedor externo" porque la etiqueta se deriva de la política vigente del producto (que hoy es `external_supplier`), no de la resolución ya aplicada.

Resumen: no falta ningún evento; la cola externa depende de un `movement_type` demasiado estrecho y de eventos `external_supplier_review`, e ignora los movimientos externos generados por reclasificación.

## Cambios

### 1. Fuente única de pendientes externos — `src/hooks/useExternalPurchaseOrders.ts`

Reescribir `usePendingExternalEvents` como cola unificada:

- Leer movimientos `status = 'posted'` en `fund_bucket = 'external_supplier'` con `movement_type` en `('sale_generated', 'replacement_reclassification_in')`.
- Deduplicar por `source_order_id + source_order_item_id` (si un ítem tiene venta externa y además reclasificación, se cuenta una sola vez, priorizando el movimiento más reciente).
- Enlazar el evento `external_supplier_review` cuando exista (por `source_id` o `woo_order_item_id`); si no existe, la fila igual aparece (`event_id = null`), como hoy.
- Excluir solo si ya está en una línea de orden externa **activa**: se cruza por `policy_event_id` y también por `woo_product_id + woo_variation_id + source_order_item_id` contra `core_external_purchase_order_lines`, ignorando las líneas de órdenes `cancelled`. Las recibidas siguen excluyendo la fila (ya se compró).
- No filtrar por proveedor: sin proveedor la fila se muestra con el badge existente **Sin proveedor**.
- Devolver además `pending_source`: `venta_externa` | `reclasificada_externa`, para trazabilidad en la tabla.

### 2. Estado de sincronización en "Requieren atención"

En `src/hooks/useReplenishmentPolicyEvents.ts` y `src/components/core/woocore/PolicyEventsAttentionPanel.tsx`, para filas con ruta/resolución externa, calcular y mostrar un badge de sincronización:

- **En cola externa** — hay movimiento externo pendiente sin orden.
- **Ya en orden externa** — existe línea en una orden externa no cancelada (con el número de orden).
- **Sin proveedor** — está en cola pero la política no tiene proveedor.
- **Resuelto como no restock / reemplazo** — para los casos tipo #34519 y #34373, con el motivo y la fecha de la resolución, para que quede explícito por qué no está en Órdenes a proveedor.
- **Error: no aparece en cola externa** — cumple regla externa pero no hay movimiento en la partida proveedores.

### 3. Botón "Abrir Reposición externa"

En `PolicyEventsAttentionPanel.tsx`, el botón solo navega cuando la fila está realmente en la cola (o ya en una orden, en cuyo caso abre la pestaña Órdenes). Si el ítem cumple la regla externa pero no está en la cola, el botón pasa a **"Enviar a reposición externa"**, que ejecuta la resolución externa existente (`core_resolve_unlinked_core_movement`, acción `external_supplier`) y luego navega. Nunca se abre una pestaña donde el ítem no aparece.

### 4. Regla de inclusión (documentada en el hook)

Aparece en Órdenes a proveedor → Pendientes todo movimiento posteado en la partida proveedores (venta directa o reclasificación), que no esté cancelado, no esté recibido y no esté ya en una línea de orden externa activa — con o sin proveedor asignado, con costo manual o de política.

## No se toca

Woo write, inventario, QR, nómina, costos, OP internas, generación de producción ni movimientos financieros existentes (no se crean ni reescriben movimientos como parte del fix; solo la resolución manual del punto 3, que ya existe hoy).

## Validación

- #34786 / item 29466 aparece en Órdenes a proveedor → Pendientes, con "Sin proveedor" si la política no lo tiene.
- #35208 / 29693 y #35176 / 29667 siguen apareciendo, sin duplicados.
- #34519 y #34373 no entran a la cola y en Requieren atención muestran "Resuelto como no restock" con su motivo.
- Ítems ya incluidos en una orden externa no se duplican en Pendientes.
- Typecheck 0 errores.
