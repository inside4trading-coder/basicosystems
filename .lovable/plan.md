## Estado verificado (solo lectura)

- `core_woo_product_map` woo_product_id **1101** → core_product_id `1bcb44a9…` (`mapped`): **el padre YA está conectado**.
- `core_woo_variant_map` woo_variation_id **1103** existe pero con **`core_variant_id = NULL`**: falta el vínculo de variante.
- El catálogo Core tiene la variante buscada: `JGM08 M` (id `81845d4b…`), además de S, L, XL.

Por eso `hasWooCoreMap()` en `src/lib/coreRevalidate.ts` devuelve `mapped: false` y muestra "Falta configurar el mapa Woo/Core".

## Qué construir (solo frontend)

### 1. `src/lib/coreRevalidate.ts`
- Nueva función `resolveVariantLinkByParent(row, coreProductId)`:
  - Lee la fila de `core_woo_variant_map` de la variación (talla/SKU Woo) y el SKU/talla del evento.
  - Normaliza con `normalizeSize` (ya existe en `coreNormalize.ts`) más una normalización de SKU: `JGM08-M` / `JGM08 M` / `Talla M` / `m` → tokens comparables.
  - Busca en `core_product_variants` del `core_product_id` del padre por, en orden: `variant_sku`/`woo_sku` normalizado, luego `size`/`normalized_size`.
  - Si hay **1 coincidencia** → `upsert` en `core_woo_variant_map` (`woo_variation_id`, `core_variant_id`, `core_product_id`, `mapping_status = 'mapped'`) y devuelve el `core_variant_id`.
  - Si hay **0** → `{ status: 'not_found' }`; si hay **varias** → `{ status: 'ambiguous' }`.
- `hasWooCoreMap()` pasa a llamar a esta resolución cuando el padre está mapeado y falta la variante.
- Nuevos resultados de revalidación:
  - resuelto: `reason: "variant_link_resolved_by_parent_and_sku"`, con `coreProductId` + `coreVariantId` ya listos para el flujo.
  - no encontrado: `"Producto conectado, falta vincular la talla {X}."`
  - ambiguo: `"Encontramos varias variantes posibles. Selecciona la correcta."`
- Mensaje genérico de mapa faltante cambia a: **"Falta vincular esta talla con el producto del catálogo."**

### 2. Trazabilidad
Al vincular, se registra en `core_product_strategy_decisions` (tabla de auditoría ya usada por el módulo) con `decision_type: 'variant_link_refresh'` y `new_values`: `resolved_by_refresh: true`, `resolved_reason`, `woo_product_id`, `woo_variation_id`, `core_product_id`, `core_variant_id`, `sku_matched`.

### 3. Continuidad del flujo
`continueOperationalFlow` (`src/lib/coreNeedsFromEvent.ts`) ya crea/actualiza `core_production_needs` cuando la ruta es `internal_factory`, vincula `sourceMovementId` y aplica 3 capas de idempotencia. Solo hay que pasarle el `coreVariantId` recién resuelto — no requiere cambios, salvo que el evento se cierre únicamente si el flujo devuelve `ok`.

### 4. `src/hooks/useReplenishmentPolicyEvents.ts`
Sin cambios de lógica: ya cierra el evento solo tras `continueOperationalFlow`. Se revisa que el nuevo `coreVariantId` se propague a `row` antes de continuar.

## Fuera de alcance
Sin cambios en Woo, OP, QR, inventario, movimientos financieros ni reproceso de ventas. Sin migraciones de base de datos.

## Validación
Pulsar Actualizar en la fila JGM08 M → vincula Woo 1103 → Core `81845d4b…`, crea la necesidad interna en Abiertas, la fila sale de Requieren atención, y una segunda pulsación no duplica. Typecheck al final.
