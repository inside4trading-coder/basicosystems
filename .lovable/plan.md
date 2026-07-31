## Problema

`refreshRow` (en `src/hooks/useReplenishmentPolicyEvents.ts`) sólo revalida (`src/lib/coreRevalidate.ts`) y, si está resuelto, marca el evento/pending/movimiento como `resolved`/`closed`. No continúa la ruta operativa, así que la fila desaparece sin generar la necesidad de producción.

## Cambios

### 1. `src/lib/coreRevalidate.ts`
- Ampliar `RevalidationResult` con: `route`, `lifecycleStatus`, `restockEnabled`, `coreProductId`, `coreVariantId`, además de `unitCost`.
- Nuevo helper `resolveRouteInfo(row)` que llama al RPC existente `resolve_core_replenishment_action` (solo lectura) y devuelve `replenishment_route`, `lifecycle_status`, `restock_enabled`, `core_product_id`, `core_variant_id`.
- Tras confirmar costo válido o mapa/catálogo configurado, adjuntar esa info al resultado.

### 2. Nuevo `src/lib/coreNeedsFromEvent.ts` — `continueOperationalFlow(row, revalidation)`
Reglas por ruta:
- `internal_factory` (y `restock_enabled` no falso, lifecycle no `no_restock`/`exit`/`replaced`) → crear o actualizar la necesidad.
- `external_supplier` → sin necesidad interna, mensaje "Proveedor externo, sin necesidad interna".
- `no_restock` / `exit` / `replaced` → sin necesidad, cierre limpio.
- Sin `core_product_id`/`core_variant_id` resueltos → devuelve `ok: false` con "Falta vínculo Core" (la fila queda pendiente).

Creación de la necesidad (mismos campos que el Edge Function `core-generate-production-needs`):
- Buscar necesidad abierta (`pending`/`review`/`approved`/`partially_converted`) con `need_type = 'sale_generated'` y mismo `core_variant_id`; si existe, sumar cantidad y recalcular `quantity_pending`; si no, insertar (`status: 'pending'`, `priority: 'media'`, `source: 'attention_refresh'`, nombres/talla resueltos desde `core_products` y `core_product_variants`).
- Si el row tiene `sourceMovementId`, vincular en `core_production_need_sources` con `source_order_id` / `source_order_item_id`.

### 3. Idempotencia (tres capas)
1. `resolution_data.created_need_id` (o su equivalente en `cost_snapshot_data`) ya presente → no crea nada.
2. `sourceMovementId` ya vinculado en `core_production_need_sources` → no crea ni suma.
3. Eventos sin movimiento: clave lógica `woo_order_id + woo_order_item_id + core_variant_id` guardada en `notes`/`resolution_data`; si ya existe una necesidad con esa clave, no se vuelve a sumar.

### 4. `refreshRow` en `src/hooks/useReplenishmentPolicyEvents.ts`
Orden nuevo:
1. Revalidar; si no resuelto → mantener pendiente con motivo.
2. Si resuelto → `continueOperationalFlow`.
3. Si el flujo falla (error al crear la necesidad o falta vínculo Core) → **no** cerrar el evento, devolver el error.
4. Sólo tras el éxito: cerrar evento/pending/movimiento guardando `resolved_by_refresh: true`, `resolved_reason`, `resolved_unit_cost`, `created_need_id`, `route`.
5. Invalidar queries (incluida `core_production_needs`) y emitir `core-needs-refresh` para que Fabricación interna → Abiertas se actualice al instante.

### 5. `src/components/core/woocore/PolicyEventsAttentionPanel.tsx`
El mensaje de la fila resuelta refleja el desenlace: "Solucionado · Necesidad creada (N uds)" o "Solucionado · Proveedor externo, sin necesidad interna". El botón global "Actualizar pendientes" recorre las filas secuencialmente con el mismo flujo.

## Fuera de alcance
Sin órdenes de producción, sin escrituras a WooCommerce, sin unidades/QR, sin inventario, sin movimientos financieros, sin reprocesar ventas.

## Validación
- Caso "Sin costo" corregido → Requieren atención en 0 y 1 necesidad en Fabricación interna → Abiertas.
- Segundo clic en Actualizar → sin duplicados.
- `resolved_by_refresh = true` en historial.
- Typecheck (`tsgo`) en 0 errores.
