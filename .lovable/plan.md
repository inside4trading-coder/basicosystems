# Actualizar debe revalidar el producto original en "Reemplazo sugerido"

## Estado verificado (solo lectura)

Evento `fd6ee828…` (pedido 34387, item 29284):
- `action = suggest_replacement`, `status = reviewed`, `quantity = 1`
- `core_product_id` y `core_variant_id` del evento están **vacíos**
- `replacement_product_id = 1bcb44a9…` = **el mismo producto Core** al que apunta Woo 1101 → el reemplazo sugerido es **auto-referencial (no-op)**

Producto original:
- `core_woo_product_map` 1101 → `1bcb44a9…` (`mapped`)
- `core_woo_variant_map` 1103 existe con `core_variant_id = NULL` (falta el vínculo de talla)
- Core sí tiene la variante `JGM08 M` (`d97f3bb4…`), además de S, L, XL
- Costo resuelto: **6.9588 USD** (`product_base`)
- Ruta resuelta: **internal_factory**, `lifecycle = active`, `restock_enabled = true`

Causa del mensaje "No se pudo validar automáticamente": en `src/lib/coreRevalidate.ts` la revalidación solo cubre `MAP_ACTIONS` (`missing_map`) y `COST_ACTIONS`. `suggest_replacement` cae al final y devuelve `not_validatable`.

## Qué construir (solo frontend)

### 1. `src/lib/coreRevalidate.ts`
- Añadir `REPLACEMENT_ACTIONS = new Set(["suggest_replacement"])` y una rama nueva **antes** del `return NOT_VALIDATABLE`.
- Nueva función `revalidateOriginalProduct(row)` que reutiliza lo que ya existe:
  1. `hasWooCoreMap(row)` — ya resuelve el padre y, si falta la variante, la vincula por SKU/talla vía `resolveVariantLinkByParent` (upsert en `core_woo_variant_map` + auditoría en `core_product_strategy_decisions`).
  2. `resolveUnitCost` con los IDs Core resueltos → exige `> 0`.
  3. `resolveRouteInfo` con los IDs resueltos → exige `internal_factory`, `restock_enabled != false` y ciclo de vida no terminal.
- Detección de no-op: si `replacement_product_id === coreProductId` resuelto (o `replacement_woo_product_id === woo_product_id` sin variante distinta), marcar `selfReplacement = true` en el resultado.

Resultados posibles de la rama:
- Original listo → `resolved: true`, `reason: "original_product_now_fabricable"`, `route: "internal_factory"`, `coreProductId`, `coreVariantId`, `unitCost`, mensaje `"Producto original listo para fabricar."`
- Falta vínculo de talla/producto → `resolved: false`, `reason: "original_not_ready_link"`, mensaje **"Falta vincular esta talla con el producto del catálogo."**
- Falta costo → `resolved: false`, `reason: "original_not_ready_cost"`, mensaje **"Todavía falta vincular producto/talla o costo para fabricar."**
- No-op y original no listo → mensaje **"El reemplazo sugerido apunta al mismo producto. Revisa la política."**
- Ruta no interna → se cierra sin necesidad (lo maneja el flujo existente).

### 2. `src/hooks/useReplenishmentPolicyEvents.ts`
`refreshRow` ya llama `continueOperationalFlow` antes de cerrar el evento y ya escribe `resolution_data`. Solo se amplía el `stamp` para incluir `core_product_id`, `core_variant_id` y `unit_cost` del resultado, además de los campos ya existentes (`resolved_by_refresh`, `resolved_reason`, `route`, `created_need_id`). Sin cambios en el orden: la necesidad se crea primero, el evento se cierra después.

### 3. `src/components/core/woocore/PolicyEventsAttentionPanel.tsx`
Solo presentación: en filas `suggest_replacement` cuyo último refresh detectó original listo o auto-reemplazo, "Actualizar" pasa a ser la acción primaria y "Aplicar reemplazo" queda como secundaria. Sin cambios de lógica de negocio.

## Idempotencia
`continueOperationalFlow` (`src/lib/coreNeedsFromEvent.ts`) ya aplica tres capas y no requiere cambios:
1. `resolution_data.created_need_id` del evento,
2. `core_production_need_sources` por `sourceMovementId`,
3. clave lógica `refresh:{order}:{item}:{variant}` guardada en `notes` de la necesidad.
Pulsar Actualizar varias veces no suma cantidad ni duplica; devuelve la necesidad existente y cierra el evento apuntando a ella.

## Fuera de alcance
Sin cambios en Woo, OP, QR, inventario, saldos, movimientos financieros ni reproceso de ventas. Sin migraciones ni cambios de backend. No se aplica ningún reemplazo.

## Validación
Actualizar en JGM08 M → vincula Woo 1103 → Core `d97f3bb4…`, costo 6.96 USD, ruta interna → crea la necesidad en Abiertas, la fila sale de Requieren atención sin aplicar reemplazo. Segunda pulsación: sin duplicados. Typecheck al final.
