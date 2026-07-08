
# Fase 2A — Costo fallback operativo desde `core_replenishment_policies`

Conectar el costo manual/proveedor de Mapa Woo/Core al resolver operativo usado por partidas, OP y unidades — sin bloquear rutas, sin crear reposición externa, sin tocar Woo, sin reprocesar histórico.

## 1. Nueva RPC principal

Crear `public.resolve_core_operational_unit_cost(p_core_product_id uuid, p_core_variant_id uuid default null, p_woo_product_id bigint default null, p_woo_variation_id bigint default null)` — `SECURITY DEFINER`, `STABLE`, `search_path = public`.

Devuelve tabla:
`unit_cost numeric, cost_source text, policy_id uuid, core_product_id uuid, core_variant_id uuid, woo_product_id bigint, woo_variation_id bigint, warning text`.

Resolución de identidad:
1. Si falta `core_product_id` y hay `woo_product_id` → buscar en `core_woo_product_map.core_product_id`, luego `core_products.woo_product_id`, luego `core_replenishment_policies` por `woo_product_id`.
2. Si falta `core_variant_id` y hay `woo_variation_id` → buscar en `core_woo_variant_map.core_variant_id`, luego `core_product_variants.woo_variation_id`.
3. Buscar política por prioridad: `core_product_id` primero, luego `woo_product_id`.

Orden final de costo (primero que aplique):
1. **variant_override** — variante con `cost_override_enabled` + estructura activa.
2. **product_base** — estructura base activa del producto (por `woo_product_id` o `core_product_id`).
3. **policy_manual_cost** — `core_replenishment_policies.manual_unit_cost_usd`.
4. **external_supplier_cost** — `core_replenishment_policies.external_supplier_unit_cost_usd` (solo referencia; `warning` = "proveedor externo, no genera OP interna en esta fase").
5. **core_product_manual_cost** — `core_products.manual_unit_cost_usd` (espejo compatibilidad).
6. **product_unit_cost** — `core_products.unit_cost`.
7. **zero_fallback** — `0` con `warning`.

Warnings adicionales:
- Si `replenishment_route ∈ {no_restock, none, ignored}`: agregar warning "Producto marcado como no_restock/ignored; costo usado solo como referencia." (no bloquear — Fase 2B).

`resolve_core_variant_unit_cost` y `_with_source` existentes se dejan intactos por compatibilidad.

## 2. Actualizar edge functions operativas

### `core-process-fabrication-funds`
Reemplazar el helper `resolveVariantUnitCost` (que llama `resolve_core_variant_unit_cost`) por llamada a `resolve_core_operational_unit_cost` pasando `core_product_id`, `core_variant_id`, `woo_product_id`, `woo_variation_id` cuando estén disponibles.

- Usar el `unit_cost` devuelto para monto de movimiento (`quantity * unit_cost`).
- Eliminar el skip por `unit_cost_missing` cuando exista fallback (`policy_manual_cost`, `external_supplier_cost`, `core_product_manual_cost`, `product_unit_cost`); mantener skip solo cuando `cost_source = zero_fallback`.
- Guardar en `cost_snapshot_data`: `cost_source`, `policy_id`, `resolved_core_product_id`, `resolved_core_variant_id`, `woo_product_id`, `woo_variation_id`, `warning`.
- Aplica en ambas rutas del archivo (procesamiento principal y actualización de productos ~línea 536).

### `core-create-production-order`
Reemplazar llamadas `resolve_core_variant_unit_cost` (líneas ~327 y ~510) por la nueva RPC.

- Guardar `estimated_unit_cost` y `cost_source` reales devueltos por la RPC (no derivar heurísticamente comparando con `unit_cost`).
- Si `cost_source ∈ {policy_manual_cost, external_supplier_cost, core_product_manual_cost}` y la ruta ≠ `internal_factory`: adjuntar `warning` en respuesta pero **no bloquear** creación.
- No modificar OPs históricas.

### `core-generate-production-units`
No cambia la lógica de procesos: si no hay estructura (base ni variante), **no** materializar procesos falsos desde costo manual. Solo si en algún punto se toma un costo referencial para snapshot, resolverlo con la nueva RPC. Confirmar que costos manuales no crean `core_production_unit_processes`.

## 3. UI `/core/mapa-woo-core`

En la celda de costo (`resolveDisplayCost` de `src/lib/coreReplenishment.ts` + `CoreWooCoreMap.tsx`):
- Cuando la fuente resulte `policy_manual_cost`, `external_supplier_cost` o `core_product_manual_cost`, mostrar badge **"Costo manual operativo"** con tooltip: "Este costo se usará para montos de partidas/necesidades cuando no exista estructura. No reemplaza una estructura de fabricación."
- Mantener el orden de tiers rojo/amarillo/verde ya existente; el badge es adicional.

Sin cambios en `/core/estructuras-costos` ni `/core/productos` en esta fase.

## 4. Fuera de scope (Fase 2B)
- Bloqueo real por `no_restock` / `ignored`.
- Reemplazos automáticos (`replacement_behavior`).
- OPs de reposición externa reales / órdenes de compra a proveedor.
- Creación automática de partidas o necesidades.
- Reprocesamiento de histórico.
- Escrituras a WooCommerce.

## 5. Validación
Antes de cerrar la fase, correr `supabase--read_query` sobre los 5 casos (A estructura, B policy_manual, C core_product_manual, D external_supplier, E zero) invocando la nueva RPC y verificar `cost_source` esperado. Verificar en `core_fabrication_fund_movements.cost_snapshot_data` y `core_production_order_lines.cost_source` que las corridas nuevas usan la fuente correcta.

## Detalles técnicos

**Archivos:**
- Nueva migración: función `public.resolve_core_operational_unit_cost(...)` + `GRANT EXECUTE ... TO authenticated, service_role`.
- `supabase/functions/core-process-fabrication-funds/index.ts` — helper reescrito, snapshots ampliados, ambas rutas.
- `supabase/functions/core-create-production-order/index.ts` — dos call-sites; guardar `cost_source` real y warning.
- `supabase/functions/core-generate-production-units/index.ts` — verificar que costos manuales no generen procesos falsos (probablemente sin cambios).
- `src/lib/coreReplenishment.ts` — badge "Costo manual operativo" en `CostResolution` labels.
- `src/pages/core/CoreWooCoreMap.tsx` — mostrar badge + tooltip.

**Backward-compat:** `resolve_core_variant_unit_cost` y `_with_source` permanecen; solo callers explícitos migran.
