# Corrección de variante para inventario (escaneo admin)

Permitir que admin/partner marquen que una prenda salió físicamente en otra variante y elijan cuál debe entrar realmente al inventario, sin tocar QR, procesos, nómina ni la variante original.

## Estado verificado

- Unidad `OP-000013-CORE000003-M-001`: producto Jogger, variante actual `M / Gris` (woo_variation_id 33026), estado `in_production` (no ingresada a inventario).
- El producto tiene 24 variantes activas, incluida `M / Beige Claro` (woo_variation_id 33025).
- Hoy la entrada a inventario (frontend `UnitInventorySection` y función `core-woo-stock-write`) resuelve siempre la variante desde `core_production_units.core_variant_id`.

## Comportamiento

En la ficha de unidad del escaneo admin, sobre el bloque Inventario, aparece "Corrección de variante para inventario":

- Switch "La variante física de esta prenda es diferente" (visible solo para admin/partner).
- Al activarlo: selector con las variantes activas del mismo producto (label + SKU Woo), campo Motivo obligatorio y botón Guardar corrección.
- Guardado: badge "Variante corregida", "Variante original: M / Gris", "Variante para inventario: M / Beige Claro", motivo, usuario y fecha.
- Botón Quitar corrección mientras la unidad no haya ingresado a inventario.
- Bloqueado si la unidad ya ingresó a inventario, está cancelada/perdida o su OP está cancelada; en ese caso se muestra: "Esta unidad ya ingresó a inventario. Debe corregirse mediante ajuste de inventario."
- Usuarios sin rol admin/partner solo ven el aviso de variante vigente/corregida, sin switch ni edición.

Guardar la corrección no escribe nada en WooCommerce; solo cambia qué variante se usará al preparar y confirmar la entrada.

## Detalles técnicos

**Migración** — columnas aditivas en `core_production_units` (todas nullable, override enabled default false):
`inventory_variant_override_enabled`, `inventory_override_variant_id` (FK a `core_product_variants`), `inventory_override_variant_sku`, `inventory_override_color`, `inventory_override_size`, `inventory_override_woo_variation_id`, `inventory_override_reason`, `inventory_override_by`, `inventory_override_at`. No se modifica `core_variant_id`.

**Variante efectiva** — helper nuevo en `src/lib/coreVariantResolve.ts`: `effectiveInventoryVariantId(unit)` devuelve el override si está activo, si no la variante original; se usa en `resolveUnitVariant`.

**Frontend**:
- Nuevo `src/components/core/UnitInventoryVariantOverride.tsx` (switch, selector, motivo, guardar/quitar, panel de estado).
- `src/pages/core/CoreScanning.tsx`: añade las columnas de override al select de la unidad y monta el bloque antes de `UnitInventorySection`; el permiso sale de `useAuth().role` (`admin` | `partner`).
- `src/components/core/UnitInventorySection.tsx`: resuelve la variante Woo por variante efectiva y muestra la variante que entrará a stock.

**Backend** (`supabase/functions/core-woo-stock-write/index.ts`): al construir preview y al confirmar, si `inventory_variant_override_enabled`, usar `inventory_override_variant_id` / sku / `woo_variation_id` como variante objetivo (log, escritura Woo y sync de `woo_stock_quantity`). Sin override, comportamiento idéntico al actual.

**Historial** — insertar en `core_production_scan_events` con `event_type` `inventory_variant_override_set` / `_updated` / `_removed`, `source = 'admin'`, sin proceso asociado, guardando en notes/JSON la variante original, la corregida, el motivo, usuario y fecha. Además registro en `core_audit_logs` vía `logCoreAudit`.

**No se toca**: QR, `unit_code`, OP, procesos completados y sus timestamps, work entries, nómina, unidades ya ingresadas a inventario.

## Verificación

- Aplicar la corrección a `OP-000013-CORE000003-M-001` → `M / Beige Claro`; reescanear y confirmar original vs. inventario, badge, motivo, usuario y fecha.
- Consultar en base que procesos, work entries y nómina de esa unidad quedan idénticos.
- Preparar entrada a inventario y comprobar en el log que apunta a woo_variation_id 33025 (Beige Claro) y no 33026; no confirmar escritura Woo salvo que lo pidas.
- Comprobar que sin rol admin/partner el bloque no permite edición.
- Typecheck.
