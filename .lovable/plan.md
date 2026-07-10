## Bloque 1 — Motor de Enrutamiento de Reposición (con correcciones aprobadas)

Motor único, idempotencia estricta por origen, dry-run 100% lectura.

### 1. Motor central (RPC SQL)

Crear `public.route_core_replenishment_candidate(...)` en una migración. Reutiliza `resolve_core_replenishment_action` internamente — es el **único** punto de decisión de enrutamiento.

Params: `p_source_type text, p_source_id uuid, p_core_product_id uuid, p_core_variant_id uuid, p_woo_product_id bigint, p_woo_variation_id bigint, p_quantity numeric, p_unit_cost numeric, p_amount numeric, p_cost_source text, p_dry_run boolean default false`.

Retorna JSONB: `route_action, severity, allow_internal_need, policy_id, replacement_product_id, replacement_woo_product_id, external_supplier_name, external_supplier_unit_cost_usd, message, warning, event_id, dedupe_key`.

Comportamiento:
- `allow_internal_factory` → `allow_internal_need=true`, sin evento.
- `external_supplier_review` / `manual_cost_review` / `suggest_replacement` / `block_no_restock` / `block_exit` / `block_ignored` → `allow_internal_need=false` + upsert idempotente en `core_replenishment_policy_events`.
- Sin política → `allow_internal_need=true` con warning legacy, sin evento.
- **Si `p_dry_run = true`**: solo calcular y devolver el resultado; **no** insertar/actualizar eventos, necesidades ni auditoría. `event_id` vuelve `null`.

### 2. Idempotencia estricta (corregida)

Migración añade a `core_replenishment_policy_events`:
- Columna `dedupe_key text`.
- Índice **UNIQUE permanente** (no parcial por status) sobre `dedupe_key`.

Formato: `source_type:source_id:coalesce(product_id,'-'):coalesce(variant_id,'-'):action`.

`INSERT ... ON CONFLICT (dedupe_key) DO UPDATE SET`:
- `quantity = EXCLUDED.quantity` (reemplaza, **no acumula**)
- `unit_cost = EXCLUDED.unit_cost`
- `amount = EXCLUDED.amount`
- refresca `external_supplier_name`, `external_supplier_unit_cost_usd`, `replacement_product_id`, `replacement_woo_product_id`, `replacement_behavior`, `cost_source`, `message`, `warning`, `policy_id`, `updated_at = now()`
- **NO** modifica `status`, `resolved_at`, `resolved_by`, `resolution_notes` (si el evento fue resuelto/ignorado, se conserva ese estado; no se reabre por reejecución del mismo origen).

Resultado: reejecutar el mismo `source_id` no crea nuevo evento ni acumula cantidades, y no revive eventos ya resueltos.

### 3. Centralización real en edge functions

Solo se sustituye el **punto de decisión existente**; el resto de cada función queda intacto.

**`core-process-fabrication-funds`**: reemplazar el bloque actual que consulta política + crea evento por una única llamada a `route_core_replenishment_candidate` (con `source_type='fabrication_fund_movement'`, `source_id=<movement_id>`). Usar `allow_internal_need` para decidir si registra movimiento interno; el evento lo crea el RPC. Eliminar la lógica de política paralela.

**`core-generate-production-needs`**: antes de insertar/actualizar cada `core_production_needs`, llamar al mismo RPC (`source_type='fabrication_fund_movement_group'`, `source_id=<primer movement del grupo>` o UUID determinista). Si `allow_internal_need=true` → flujo actual. Si `false` → skip, sumar a `by_skip_reason['policy_routed:<action>']`, sin insertar necesidad. Añadir modo `route_only: true` que ejecuta enrutador sobre movimientos pendientes sin tocar necesidades; combinado con `dry_run: true` no escribe nada (el RPC respeta `p_dry_run`).

`core-create-production-order` y `core-generate-production-units`: sin cambios en esta fase (ya bloquean vía `resolve_core_replenishment_action`; migrarán al motor central cuando sus eventos también se unifiquen).

### 4. Botón "Procesar políticas de reposición"

En `PolicyReviewPanel` (`/core/mapa-woo-core` → Revisión de reposición):
- Botón "Procesar políticas de reposición".
- Modal preview: invoca `core-generate-production-needs` con `{ route_only: true, dry_run: true }` → devuelve conteos por bucket (interna, externo, manual, no restock, salida, reemplazos, ignorados, errores) sin escribir nada.
- Confirmación → segunda llamada sin `dry_run` (crea necesidades internas y eventos según política).

### 5. Mensajes `policy_blocked`

Actualizar `POLICY_ACTION_MESSAGES` en `src/lib/policyBlocked.ts` con los textos exactos pedidos. `PolicyBlockedDialog` ya tiene botón "Abrir Revisión de reposición".

### Archivos afectados

- **Migración nueva**: RPC `route_core_replenishment_candidate` + columna `dedupe_key` + índice UNIQUE permanente + GRANT EXECUTE.
- **Editar**: `supabase/functions/core-process-fabrication-funds/index.ts` (sustituir punto de decisión).
- **Editar**: `supabase/functions/core-generate-production-needs/index.ts` (integración enrutador + modo `route_only`).
- **Editar**: `src/components/core/woocore/PolicyReviewPanel.tsx` (botón + modal preview).
- **Editar**: `src/lib/policyBlocked.ts` (textos).

### Fuera de scope

Sin órdenes de compra externas, sin reemplazos automáticos, sin OP automáticas, sin tocar Woo/stock/QR/escaneo/nómina/España/histórico. Sin tablas nuevas (1 columna + 1 índice).

### Pendiente para Bloque 2

Conversión de eventos `external_supplier_review` en órdenes de compra reales, aplicación confirmada de `suggest_replacement`, y migración de `core-create-production-order` / `core-generate-production-units` al motor central para unificar eventos.
