## Objetivo

Resolver filas `missing_sku` desde `/core/necesidades` con flujo **costo → No restock | Reemplazar**. Basado en el schema verificado.

## Schema verificado (real)

**`core_fabrication_fund_pending_items`** — tiene: `id`, `source_order_id`, `source_order_item_id`, `woo_product_id`, `woo_variation_id`, `woo_sku`, `product_name`, `quantity`, `revenue`, `reason`, `suggested_action`, **`status`** (único valor actual: `'pending'`), **`resolved_at`**, `resolved_by`, **`notes`**, `linked_core_product_id`, `linked_core_variant_id`, `marked_non_restockable`, `last_action_at`, `last_action_by`, `ignored_*`. → Se puede usar `status='resolved'`, `resolved_at=now()`, `resolved_by=auth.uid()`, `last_action_at/by`, y opcionalmente escribir metadata en `notes` (texto). No hay campo jsonb.

**`core_fabrication_fund_movements`** — tiene: `fund_id`, `fund_bucket`, `movement_type`, `source_order_id/item_id`, `woo_product_id/variation_id`, `core_product_id/variant_id`, `sku`, `product_name`, `quantity`, `unit_cost_snapshot`, `cost_snapshot_data` (jsonb), `amount`, `currency`, `reason`, `notes`, `status`, `created_by`, `related_movement_id`. Valores actuales de `fund_bucket`: `internal_factory`, `external_supplier`. Extenderemos a `non_restockable` y `pending_classification` (texto libre, sin CHECK visible).

**`core_fabrication_funds`** — filas existentes: `general` / `external_supplier` / `non_restockable` / `pending`. Mapeo bucket→fund_type: `non_restockable→non_restockable`, `pending_classification→pending`, `internal_factory→general`, `external_supplier→external_supplier`.

**Trigger `trg_replacement_fund_balance`** — solo actualiza saldo para `movement_type IN ('replacement_reclassification_out','replacement_reclassification_in','replacement_cost_adjustment')`. **NO** dispara para `sale_generated`. → La RPC debe actualizar `core_fabrication_funds.available_amount` **manualmente una sola vez**.

## 1. Migración — `supabase/migrations/<ts>_core_resolve_missing_sku.sql`

### `core_resolve_missing_sku_pending_item(p_pending_item_id uuid, p_unit_cost numeric, p_action text, p_dry_run boolean default false) returns jsonb`

`SECURITY DEFINER`, `search_path=public`, grants a `authenticated` y `service_role`.

Pasos:
1. `SELECT ... FOR UPDATE` del pending por id.
2. Validar: `reason IN ('missing_sku','product_not_mapped','variation_not_mapped')`, `p_unit_cost > 0`, `p_action IN ('no_restock','replacement_prepare')`.
3. Si `status = 'resolved'` → retornar `{already_resolved: true}`.
4. `qty := coalesce(pending.quantity, 1)`; `amount := p_unit_cost * qty`; `currency := 'USD'`.
5. **Idempotencia**: buscar movimiento previo con mismo `source_order_id`, `source_order_item_id` y `cost_snapshot_data->>'manual_missing_sku_resolution' = 'true'`. Si existe → retornar `{already: true, movement_id, bucket, action}` sin insertar ni tocar fondo.
6. Determinar bucket y fund_type:
   - `no_restock` → bucket `non_restockable`, fund_type `non_restockable`.
   - `replacement_prepare` → bucket `pending_classification`, fund_type `pending`.
7. `SELECT id FROM core_fabrication_funds WHERE fund_type = <mapped> LIMIT 1` → `fund_id` (error explícito si no existe).
8. Si `p_dry_run=true` → retornar preview.
9. `INSERT INTO core_fabrication_fund_movements` con: `fund_id`, `fund_bucket`, `movement_type='sale_generated'`, `source_order_id/item_id/woo_*` del pending, `product_name`, `quantity=qty`, `unit_cost_snapshot=p_unit_cost`, `amount`, `currency`, `reason=pending.reason`, `status='posted'`, `created_by=auth.uid()`, `cost_snapshot_data = jsonb_build_object('manual_missing_sku_resolution', true, 'resolution_action', p_action, 'pending_item_id', p_pending_item_id, 'reason', pending.reason, 'unit_cost', p_unit_cost)`.
10. **Actualizar saldo manualmente**: `UPDATE core_fabrication_funds SET available_amount = available_amount + amount, updated_at = now(), updated_by = auth.uid() WHERE id = fund_id`. (El trigger no aplica a `sale_generated`, verificado.)
11. Si `p_action='no_restock'`: `UPDATE core_fabrication_fund_pending_items SET status='resolved', resolved_at=now(), resolved_by=auth.uid(), last_action_at=now(), last_action_by=auth.uid(), notes = coalesce(notes,'') || E'\n[missing_sku:no_restock movement=' || movement_id || ']' WHERE id = p_pending_item_id`.
12. Si `p_action='replacement_prepare'`: solo `UPDATE ... SET last_action_at=now(), last_action_by=auth.uid()` (pending sigue abierto).
13. Retornar `{ok:true, movement_id, pending_item_id, amount, unit_cost, quantity, bucket, fund_id, action}`.

### `core_close_missing_sku_pending_item(p_pending_item_id uuid, p_replacement_event_id uuid) returns jsonb`

- `SELECT FOR UPDATE`; si `status='resolved'` → `{already_resolved:true}`.
- `UPDATE ... SET status='resolved', resolved_at=now(), resolved_by=auth.uid(), last_action_at=now(), last_action_by=auth.uid(), notes = coalesce(notes,'') || E'\n[missing_sku:replacement_event=' || p_replacement_event_id || ']'`.
- Grants iguales.

## 2. Hook

`src/hooks/useReplenishmentPolicyEvents.ts`:
- Poblar `row.sourcePendingItemId = pending.id` (uuid limpio) en filas sintéticas de pending. Mantener `row.id='pi:<uuid>'` solo como key React.
- Mutaciones: `resolveMissingSkuPendingItem({pendingItemId, unitCost, action})` y `closeMissingSkuPendingItem({pendingItemId, replacementEventId})`.
- Invalidar: `replenishment_policy_events`, `fab_fund_movements`, `fabrication_fund_pending_items`, `core_production_needs`, y queries de fondos usadas por `/core/partidas-fabricacion`.

## 3. Diálogo — `src/components/core/needs/MissingSkuResolveDialog.tsx`

**Paso 1 — Costo**: input, botón deshabilitado hasta `>0`, mensaje bloqueante.

**Paso 2 — Acción**:
- **No restock**: llama RPC `no_restock` con `sourcePendingItemId` real → toast → cierra. No abre `ReplacementApplicationDialog`. No crea policy_event.
- **Reemplazar**: pasa a **Paso 3**.

**Paso 3 — Selector de catálogo** (solo si Reemplazar): reutiliza el patrón/UI de `PendingClassificationResolveDialog`/`ReplacementPickerDialog` (candidatos `core_products` con `replenishment_route='internal_factory'` y no bloqueados). Al confirmar producto:
1. RPC `replacement_prepare` → `movement_id`.
2. `INSERT` en `core_replenishment_policy_events`: `action='suggest_replacement'`, `status='open'`, `severity='warning'`, `source_type='fabrication_fund_movement'`, `source_id=movement_id`, `quantity`, `unit_cost`, `amount`, `replacement_product_id`, `replacement_woo_product_id`, `replacement_behavior='use_on_restock_with_confirmation'`, ids de contexto del pending. Nunca sin `replacement_product_id`.
3. Abrir `ReplacementApplicationDialog` con ese event (selección de variante/cantidad como hoy).
4. `onSuccess` → `closeMissingSkuPendingItem({pendingItemId, replacementEventId})`.

## 4. Panel

`src/components/core/woocore/PolicyEventsAttentionPanel.tsx`: para filas `_kind='pending_item'` con `reason='missing_sku'` (o `action='missing_map'` de origen pending) → botón principal **Resolver** abre `MissingSkuResolveDialog`. Secundario: "Abrir Mapa Woo/Core".

## Fuera de alcance

Woo, OP, inventario, catálogo, estructuras, QR, nómina, Sublime. No refactor global. No modifica `core_apply_replacement_event` ni el trigger existente.

## Validaciones post-implementación

**no_restock**: 1 movimiento; `fund_bucket='non_restockable'`; pending `status='resolved'`; `funds(non_restockable).available_amount` sube exactamente `amount`; segundo click devuelve `already:true` sin duplicar.

**replacement_prepare**: 1 movimiento; `fund_bucket='pending_classification'`; pending sigue `pending`; `funds(pending).available_amount` sube exactamente `amount`; después `ReplacementApplicationDialog` hace la conciliación (movimientos reclass ya cubiertos por trigger existente); al terminar, pending → `resolved`.

**Sin costo**: bloqueado en UI.

Typecheck con `tsgo`.

## Archivos

Nuevos: migración SQL, `MissingSkuResolveDialog.tsx`.
Modificados: `useReplenishmentPolicyEvents.ts`, `PolicyEventsAttentionPanel.tsx`.
