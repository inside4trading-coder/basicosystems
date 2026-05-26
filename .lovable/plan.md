# Plan — Pendientes como Centro de Resolución (Partidas de Fabricación)

## Alcance
Convertir la pestaña Pendientes en un sistema resolutivo, separar pendientes globales vs del último run vs del rango, agregar acciones individuales y en lote, reprocesamiento idempotente y auditoría completa. No tocar QR/Ficha Viajera.

## 1. Migración DB

Tabla `core_fabrication_fund_pending_items`:
- Agregar columnas: `ignored_reason text`, `ignored_at timestamptz`, `ignored_by uuid`, `linked_core_product_id uuid`, `linked_core_variant_id uuid`, `marked_non_restockable boolean default false`, `last_action_at timestamptz`, `last_action_by uuid`.
- Ampliar valores válidos de `status` documentados: `pending | resolved | ignored | linked | non_restockable | processed`.
- Ampliar `reason` para incluir: `missing_sku`, `product_not_in_core`, `variation_not_mapped`, `unit_cost_missing`, `non_restockable_not_classified`, `product_deleted_or_unavailable`, `sync_error`.
- Índice por `status`, `reason`, `woo_sku`, `linked_core_product_id`.

(El resto de tablas ya cubren el flujo; no se crean tablas nuevas.)

## 2. Edge function `core-process-fabrication-funds`

- Detectar mejor el motivo: distinguir `variation_not_mapped` (variation_id existe en order pero no en Core) vs `product_not_in_core`. Renombrar `missing_cost` → `unit_cost_missing`.
- Aceptar un nuevo modo `mode: "reprocess_pending"` con `pending_ids?: string[]`. En ese modo:
  - Recorre solo los pendientes seleccionados (o todos los `resolved`/`linked`/`non_restockable` aún sin movimiento).
  - Para cada uno: si tiene `linked_core_product_id` con costo > 0, genera movimiento en Partida General; si `marked_non_restockable`, genera en Partida No Restockeable.
  - Idempotencia por `(source_order_id, source_order_item_id, movement_type)` y por unique index existente.
  - Marca el pendiente con `status='processed'`, `resolved_at`, `resolved_by`.
- Reusar batching y `fabrication_fund_run_id` ya implementados.
- Resumen enriquecido: `orders_checked`, `items_checked`, `movements_created`, `pending_items_created`, `pending_items_resolved`, `reversals_created`, `by_reason`.

## 3. UI — `CoreFabricationFunds.tsx`

### 3.1 Resumen (tab Resumen)
Reemplazar la tarjeta única "Pendiente por resolver" con cuatro métricas:
- Pendientes históricos (todos status=pending)
- Último procesamiento (de `runs[0].pending_items_created`)
- Pendientes del rango Desde/Hasta (por `created_at` o por order date)
- Revenue pendiente del rango (suma de `revenue`)

### 3.2 Pestaña Pendientes
Nueva tabla rica con columnas:
Fecha venta · Order ID · Line item · Woo Product ID · Variation ID · SKU · Producto · Cantidad · Revenue · Motivo (badge) · Estado (badge) · Core asociado · Acciones.

Toolbar con filtros: motivo, estado, fecha (rango), Woo Product ID, SKU, asociado/no asociado, restockeable/no, búsqueda libre.

Selección múltiple con checkbox.

### 3.3 Acciones por fila (menú "Resolver")
A. **Asociar a Producto Core** → Dialog con buscador (por SKU/nombre/ID) que consulta `core_products` y `core_product_variants`. Al confirmar: setea `linked_core_product_id` (+ variant si aplica), `status='linked'`. Audit.
B. **Crear Producto Core** → Sheet con nombre, SKU (prefill), unit_cost, restockable. Crea fila en `core_products` y enlaza. Audit.
C. **Marcar No Restockeable** → Dialog con motivo obligatorio. Inserta en `core_restock_control` (reference por woo_product_id/variation_id/sku, status=active) y setea `marked_non_restockable=true`, `status='non_restockable'`. Audit.
D. **Ignorar** → Dialog con motivo obligatorio. `status='ignored'`, `ignored_reason`, `ignored_at`, `ignored_by`. Audit.
E. **Completar costo** (si reason=`unit_cost_missing`) → Dialog para actualizar `unit_cost` del Producto Core ya asociado. Audit.

### 3.4 Acciones en lote
Barra contextual cuando hay selección:
- Asociar todos a un Core
- Marcar todos como no restockeables (motivo único)
- Ignorar todos (motivo único)
- Crear Producto Core por cada uno (solo si tienen SKU y nombre)

### 3.5 Botón "Reprocesar pendientes resueltos"
Junto a "Procesar ventas confirmadas". Invoca la edge function con `mode='reprocess_pending'`. Si hay selección, manda `pending_ids`; si no, procesa todos los pendientes con `status in ('linked','non_restockable','resolved')` y sin movimiento.

### 3.6 Toast mejorado
- 0 movs + N pendientes: "Procesamiento completado: X ventas revisadas. 0 movimientos generados porque N ítems requieren asociación o costo. Revisa la pestaña Pendientes."
- Con movimientos: "Procesamiento completado: M movimientos, P pendientes, R reversos."
- Reprocesamiento: "Reprocesados: M movimientos generados, P pendientes resueltos."

## 4. Auditoría
Cada acción llama `logCoreAudit` con table=`core_fabrication_fund_pending_items`, action y before/after en JSON. La edge function loguea reprocesamiento con table=`core_fabrication_fund_runs`.

## 5. Detalles técnicos

```text
Frontend (CoreFabricationFunds.tsx)
├── new state: filters{reason,status,from,to,wooProductId,sku,linked,restockable,search}
├── new state: selectedPendingIds: Set<string>
├── PendingResolveDialog (asociar / crear / no restock / ignorar / completar costo)
├── BulkActionsBar
└── reprocessPending() → supabase.functions.invoke(..., {mode:'reprocess_pending'})

Edge function
├── if (body.mode === 'reprocess_pending') runReprocess(...)
└── helpers: detectReason(it, product, variant) → typed reason string
```

Idempotencia: índice único `(source_order_id, source_order_item_id, movement_type)` ya existe.

Performance: paginar lista de pendientes (cap 1000 actual rompe vista) — fetch en páginas de 500 con count exacto y filtros server-side.

## 6. Validaciones
- Motivo obligatorio para Ignorar y para No Restockeable (zod en cliente).
- No permitir asociar si el Core no tiene costo y advertir que quedará en `unit_cost_missing`.
- Asociación masiva solo si todos los seleccionados son del mismo Woo Product ID (para evitar errores).

## 7. Entrega
1. Migración (paso 1).
2. Edge function (paso 2) + deploy.
3. Refactor UI (pasos 3.1–3.6).
4. Probar: ejecutar procesamiento del rango 24–25/05 → resolver 9 pendientes (asociar/crear/no restock/ignorar) → reprocesar → verificar movimientos en Partida General / No Restockeable.
