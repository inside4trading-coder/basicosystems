# Mapa Woo / Core + Política de Reposición — BASICO CORE

Módulo estratégico de decisión entre WooCommerce y Core. Mesa de mapeo y decisión, no una extensión de `core_products`. Solo lectura de Woo + capa de política/costo fallback/reemplazo + auditoría.

## Condiciones aprobadas (incorporadas)

1. **Seguridad edge functions**: cada función exige `Authorization: Bearer <token>`, valida el usuario con `supabase.auth.getUser(token)`, verifica rol `admin` o `manager` contra `user_roles`, y rechaza cualquier llamada anónima con `401/403`. Se mantiene `verify_jwt = false` (default Lovable Cloud + sistema signing-keys) porque la validación en código es igual o más estricta, ya está probada en `core-woo-import-variants`, y garantiza el mismo requisito.
2. **Fuente de verdad**: `core_replenishment_policies` es la única fuente principal de política, ruta de reposición, costo fallback, proveedor externo y reemplazo. Los campos `manual_unit_cost_usd`, `manual_cost_reason`, `replenishment_policy_id` en `core_products` son **solo espejo de compatibilidad**; el resolver siempre lee primero la política.
3. **Costo fallback**: estratégico/visual/auditable en esta fase. **No** se conecta al resolver operativo de partidas/necesidades/OP. Fase 2 hará esa conexión.
4. **Fuera de scope confirmado**: no escribe Woo, no crea producción, no crea partidas, no crea necesidades, no toca inventario, QR, nómina, España, ni reprocesa histórico.

---

## 1. Ruta y navegación

- `/core/mapa-woo-core` → `CoreWooCoreMap.tsx` (dentro de `<Route path="/core">` en `App.tsx`).
- Item en sidebar `CoreLayout.tsx`, grupo **Catálogo**, label **"Mapa Woo / Core"**, icono `Network`.

## 2. Migración (ya aplicada)

- `core_woo_product_map` — snapshot Woo + vínculo opcional Core, `mapping_status`, `variants_sync_status`.
- `core_woo_variant_map` — snapshot de variaciones + vínculo opcional a `core_product_variants`.
- `core_replenishment_policies` — fuente principal (rol, lifecycle, ruta, costo manual, proveedor externo, reemplazo, `replacement_behavior`).
- `core_product_strategy_decisions` — auditoría.
- `core_products` +3 columnas espejo (`manual_unit_cost_usd`, `manual_cost_reason`, `replenishment_policy_id`).
- RLS: lectura autenticada; escritura solo `admin|manager` vía `has_role`; delete solo `admin`.

## 3. Edge functions (todas con auth Bearer + validación rol en código)

- `core-woo-map-import` — trae productos Woo (`/products?per_page=100&page=N`), `upsert` en `core_woo_product_map`. Paginado con salvaguarda 50 páginas por corrida. No borra.
- `core-woo-map-import-variants` — trae `/products/{id}/variations`, `upsert` en `core_woo_variant_map`. Si el producto está mapeado, también hace `upsert` en `core_product_variants` matcheando por `woo_variation_id`, luego `size+color`. Actualiza `variants_sync_status`. Nunca borra.
- `core-woo-map-lookup` — GET manual de un `woo_product_id`, devuelve payload para el modal "Vincular Woo ID" sin escribir.

## 4. Frontend

`src/pages/core/CoreWooCoreMap.tsx` con 5 tabs:

1. **Mapa Woo / Core** — tabla maestra + filtros (`mapping_status`, `lifecycle_status`, `replenishment_route`, `brand_role`, texto). Columnas: Woo ID, Producto, SKU, Tipo, Variantes, Estado Woo, Core, SKU Core, Variantes sync, Estructura, Costo fallback, Costo usado, Rol, Estado comercial, Ruta, Restock, Proveedor, Reemplazo, Acciones. Filas expandibles → variantes.
2. **Faltan estructura / costo** — sin estructura activa Y sin `manual_unit_cost_usd`.
3. **Proveedor externo** — `replenishment_route = external_supplier`.
4. **No restock / Reemplazos** — `lifecycle_status ∈ {no_restock, exit}` + reemplazo asignado.
5. **Auditoría** — `core_product_strategy_decisions` con filtros.

## 5. Componentes en `src/components/core/woocore/`

`WooCoreMapTable`, `WooCoreVariantsRow`, `LinkWooIdDialog`, `LinkToCoreDialog`, `CreateCoreFromWooDialog`, `SyncVariantsDialog`, `ManualCostDialog`, `ReplenishmentRouteDialog`, `LifecycleStatusDialog`, `ReplacementPickerDialog`, `BrandRoleDialog`, `StrategyAuditPanel`.

Toda mutación registra fila en `core_product_strategy_decisions` (helper `logStrategyDecision`).

## 6. Utilidades

- `src/lib/coreReplenishment.ts` — `resolveCostForPolicy(policy, product, variant)`: variante override → estructura base → política.manual → core_products.manual (espejo) → `unit_cost` → `0 con warning`. **Solo visual**.
- `src/hooks/useWooCoreMap.ts` — queries con React Query.

## 7. Métricas laterales

Ventas 60d / inventario / OP activa / necesidades: se muestran si hay consulta local sencilla, si no "sin datos". Sin score avanzado.

## 8. Fuera de alcance (fase 2)

Score "Core sugeridos" avanzado, conexión del fallback al resolver operativo, generación automática de partidas/necesidades/OP desde reemplazo, bloqueo real de `block_and_suggest`, reposición externa real, sincronización inversa a Woo.

## 9. Archivos

**Nuevos:** 3 edge functions, `CoreWooCoreMap.tsx`, 12 componentes, `coreReplenishment.ts`, `useWooCoreMap.ts`.
**Editados:** `App.tsx`, `CoreLayout.tsx`, `types.ts` (auto).
