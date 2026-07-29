## Objetivo

Las filas con badge "Sin vínculo Core" (movimientos `sale_generated`, bucket `internal_factory`, `status='posted'`, sin `core_product_id`/`core_variant_id`) tendrán un botón principal **"Decidir reserva"** con tres salidas: vincular en Mapa Woo/Core, no restock, o reemplazar por otra prenda del Catálogo de Fabricación. `missing_sku` conserva su botón "Resolver".

## Estado verificado

- El hook ya genera estas filas como `_kind: 'internal_missing_core'` con `sourceMovementId` (`useReplenishmentPolicyEvents.ts`).
- `core_fabrication_fund_movements` no tiene trigger en UPDATE: solo `trg_replacement_fund_balance` en INSERT, que ajusta `core_fabrication_funds.available_amount` para `replacement_reclassification_out/in` y `replacement_cost_adjustment`.
- Por eso el dinero se mueve solo con el par de movimientos de reclasificación (mismo patrón que `core_apply_replacement_event`) y **nunca** tocando `available_amount` a mano.

## 1. Migración: RPC `core_resolve_unlinked_core_movement`

```
core_resolve_unlinked_core_movement(
  p_movement_id uuid,
  p_action text,
  p_replacement_event_id uuid default null,
  p_dry_run boolean default false
) returns jsonb
```
Security definer. `p_replacement_event_id` es obligatorio cuando `p_action='mark_replaced'`.

Validaciones: movimiento existe, `movement_type='sale_generated'`, `status='posted'`, `amount > 0`, `fund_bucket='internal_factory'`, y `core_product_id IS NULL OR core_variant_id IS NULL`.

Idempotencia: si `cost_snapshot_data->'unlinked_core_resolution'->>'status'` ∈ (`corrected`,`closed`) → devuelve `{already_resolved:true}` sin escribir. `p_dry_run=true` devuelve el plan sin escribir.

**`p_action='no_restock'`**
- El movimiento original **no** cambia de `fund_bucket` ni de tipo: queda `sale_generated` / `internal_factory` para trazabilidad histórica.
- Inserta `replacement_reclassification_out` con amount negativo en el fondo `internal_factory` y `replacement_reclassification_in` con amount positivo en el fondo `non_restockable`, ambos con `related_movement_id = p_movement_id`, `source='woocommerce'` (valor permitido por el check) y trazabilidad en `cost_snapshot_data`. El trigger ajusta cada saldo una sola vez.
- Marca el original: `cost_snapshot_data.unlinked_core_resolution = {status:'corrected', action:'no_restock', resolved_at:now(), reason:'Venta con Woo vinculado pero sin Core. Marcada como no restock.'}`.

**`p_action='mark_replaced'`**
- No mueve fondos, no inserta reclasificaciones, no cambia `fund_bucket`.
- Solo marca `cost_snapshot_data.unlinked_core_resolution = {status:'corrected', action:'replace', replacement_event_id:p_replacement_event_id, resolved_at:now()}`, porque `core_apply_replacement_event` ya hizo la conciliación financiera.

## 2. Nuevo modal `src/components/core/needs/UnlinkedCoreReserveDialog.tsx`

Título "Decidir reserva sin vínculo Core". Resumen: producto, SKU, pedido, item, Woo product/variation, cantidad, costo y monto reservado. Tres opciones:

- **Vincular en Mapa Woo/Core** — "Usa esta opción si esta venta corresponde a un producto fabricable existente." → navega a `/core/mapa-woo-core?woo_product_id=…&action=map`.
- **No restock** — "No se fabricará ni se reemplazará. El dinero pasa a Partida no restockable." → RPC `no_restock`, invalida caches, cierra con toast.
- **Reemplazar por otra prenda** — "Usar esta reserva para fabricar otra prenda del Catálogo de Fabricación." → selector del Catálogo de Fabricación (mismo patrón que `MissingSkuResolveDialog`), crea o reutiliza el event puente y abre `ReplacementApplicationDialog`.

Idempotencia del reemplazo: antes de crear busca event con `source_type='fabrication_fund_movement'`, `source_id=movement_id`, `action='suggest_replacement'`, `status IN ('open','reviewed','resolved')`. Open/reviewed → reutiliza; resolved → llama `mark_replaced` y avisa, sin crear otro. Al cerrar el diálogo hace SELECT fresco; si `status='resolved'` llama `mark_replaced` con el `event_id` y despacha `core-needs-refresh`.

Nunca se pide costo manual.

## 3. Hook `src/hooks/useReplenishmentPolicyEvents.ts`

- La query de `internal_missing_core` incluye `cost_snapshot_data`; expone `unlinkedCoreResolution` e `isCorrected`.
- Oculta filas con `status` `corrected` o `closed`.
- Nueva mutation `resolveUnlinkedCoreMovement({ movementId, action, replacementEventId })` que invalida `policy_events`, `fab_fund_movements`, `fab_fund_pending_items` y `core_production_needs`.

## 4. Panel `src/components/core/woocore/PolicyEventsAttentionPanel.tsx`

Para `_kind === 'internal_missing_core'`: botón principal "Decidir reserva" + los secundarios existentes "Abrir Mapa Woo/Core" y "Copiar Woo ID". El bloque de `missing_sku` (botón "Resolver") queda intacto.

## Validación esperada

- No restock (MF130 L, 8.30): original intacto como `sale_generated`/`internal_factory`; existe out −8.30 en internal_factory e in +8.30 en non_restockable; cada saldo se mueve una sola vez; la fila desaparece de "Sin vínculo Core"; sin OP ni necesidad nueva.
- Reemplazo (MF132 S): original intacto, conciliación por `core_apply_replacement_event`, `mark_replaced` solo marca corrected, sin duplicar fondos, eventos ni necesidades.

## Fuera de alcance

Sin cambios en Woo, órdenes de producción, inventario, catálogo, estructuras/plantillas de costos ni Sublime. No se borran movimientos ni eventos, no se crean productos Core ni mapeos automáticos.
