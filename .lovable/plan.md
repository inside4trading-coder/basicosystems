# Consistencia entre "Requieren atención" y "Órdenes a proveedor"

## A. Auditoría de las resoluciones no_restock (#34373 y #34519)

Lo que existe realmente en la base de datos para la gorra `GORRA0001 T-U` (Woo 33910):

| Dato | #34373 / item 29263 | #34519 / item 29372 |
|---|---|---|
| Acción registrada | `unlinked_core_resolution.action = no_restock` | `no_restock` |
| Fecha | 2026-08-01 20:52:26 UTC | 2026-08-09 23:49:48 UTC |
| Motivo guardado | "Venta con Woo vinculado pero sin Core. Marcada como no restock." (texto genérico de la función, no comentario del usuario) | idéntico |
| Usuario | **no hay**: `created_by` nulo en los dos movimientos generados | **no hay** |
| Comentario del operador | ninguno (`notes` nulo) | ninguno |
| Movimiento financiero | out `5bc283bc…` (−5.34 en fabricación interna) + in `a1cbf17e…` (+5.34) | out `44ff8018…` + in `cc5ce43f…` (5.34) |
| Partida destino | `non_restockable` (fondo `5ec1f93a…`) | `non_restockable` |
| Registro en `core_audit_logs` | **0 registros** — la tabla no tiene ninguna entrada de `core_fabrication_fund_movements` ni de resoluciones de este tipo | **0 registros** |

Hallazgo adicional decisivo: el 2026-08-21 12:05 el sistema generó eventos `external_supplier_review` **abiertos** para esos mismos ítems (29263 y 29372), con el mensaje "Producto marcado como proveedor externo. No se fabrica internamente.". Es decir, la política vigente del producto es proveedor externo y hay eventos externos abiertos, pero el dinero sigue reservado en la partida "no reponible" por una resolución anterior sin autoría ni comentario.

**Conclusión: no hay evidencia de una decisión manual válida y atribuible.** Los dos casos se tratan como **posible inconsistencia**, no se excluyen en silencio, y se habilita reabrir/reclasificar. En cambio, #34786 sí tiene su evento `external_supplier_review` marcado `resolved` el 2026-08-28 y su dinero en la partida proveedores.

## B. Causa de que #34786 no aparezca en Órdenes a proveedor

`usePendingExternalEvents` (`src/hooks/useExternalPurchaseOrders.ts`) exige `fund_bucket = 'external_supplier'` **y** `movement_type = 'sale_generated'`. Cuando un ítem se resuelve como reposición externa, el movimiento que queda en la partida proveedores es `replacement_reclassification_in`, no `sale_generated`, así que el filtro lo descarta. #35208/29693 y #35176/29667 sí aparecen porque son ventas externas directas.

## C. Cambios

### 1. Fuente única de pendientes externos — `src/hooks/useExternalPurchaseOrders.ts`

- Aceptar `movement_type` en `('sale_generated','replacement_reclassification_in')` dentro de `fund_bucket = 'external_supplier'`, `status = 'posted'`.
- Deduplicar por `source_order_id + source_order_item_id`, priorizando el movimiento más reciente.
- Enlazar el evento `external_supplier_review` si existe; si no, la fila igual aparece.
- Excluir solo si ya hay línea en una orden externa no cancelada (cruce por `policy_event_id` y por `woo_product_id + woo_variation_id + source_order_item_id`).
- Nunca filtrar por proveedor: sin proveedor se mantiene el badge **Sin proveedor**.
- Añadir `pending_source`: `venta_externa` | `reclasificada_externa`.

### 2. Cola de inconsistencias externas

Incluir en la vista de reposición externa, en un bloque separado **"Posible inconsistencia"**, los ítems con evento `external_supplier_review` abierto cuyo dinero no está en la partida proveedores (caso #34373 y #34519). Cada fila muestra: partida actual, acción previa, fecha, usuario (o "sin autoría registrada") y motivo guardado.

### 3. Reabrir / reclasificar

Acción **"Reclasificar a proveedor externo"** en esas filas: usa la RPC existente `core_resolve_unlinked_core_movement` con acción `external_supplier`, que mueve el importe de la partida actual a proveedores con par out/in y sello de resolución. Se añade un campo de comentario obligatorio y, esta vez, se registra la operación en `core_audit_logs` con el usuario autenticado. También queda disponible **"Confirmar no restock"** para dejarlo como está, con comentario y autoría.

Nada se reclasifica automáticamente: cada caso requiere la acción explícita del usuario.

### 4. Estado de sincronización en "Requieren atención"

En `src/hooks/useReplenishmentPolicyEvents.ts` y `PolicyEventsAttentionPanel.tsx`, badge por fila externa: **En cola externa**, **Ya en orden externa** (con número), **Sin proveedor**, **Resuelto como no restock / reemplazo** (con fecha, autoría o "sin autoría registrada" y motivo) y **Posible inconsistencia: no aparece en cola externa**.

### 5. Botón "Abrir Reposición externa"

Navega solo si el ítem está en la cola o ya en una orden. Si cumple la regla externa pero no está en la cola, el botón pasa a **"Reclasificar a proveedor externo"** (mismo flujo con comentario del punto 3) y luego navega. Nunca abre una pestaña donde el ítem no aparece.

## No se toca

Woo write, inventario, QR, nómina, costos, OP internas, generación de producción. No se reescriben movimientos existentes ni se ejecuta ninguna reclasificación automática.

## Validación

- #34786 aparece en Órdenes a proveedor → Pendientes.
- #35208 y #35176 siguen apareciendo, sin duplicados.
- #34373 y #34519 aparecen como "Posible inconsistencia" con su auditoría visible y botón de reclasificar; nada cambia hasta que el usuario decida.
- Ítems ya en una orden externa no se duplican.
- Typecheck 0 errores.
