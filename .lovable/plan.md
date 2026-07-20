# Resolver "Partida sin clasificar" desde Necesidades (final)

Ruta barata: sin migración, sin RPC nuevo, sin edge function. Reutiliza `core_apply_replacement_event` y `ReplacementApplicationDialog`.

## Archivos a modificar

1. `src/hooks/useReplenishmentPolicyEvents.ts` — ampliar query + helpers.
2. `src/components/core/woocore/PolicyEventsAttentionPanel.tsx` — swap del `Link` por botón, badge/botón Cerrar.
3. `src/components/core/needs/PendingClassificationResolveDialog.tsx` (**nuevo**).

## 1) Hook `useReplenishmentPolicyEvents.ts`

**Query `pendingClassMovsQuery`**: incluir `resolution_data` en el `select`. Filtrar en cliente (JSONB anidado):
- incluir si `resolution_data.pending_classification_resolution` es null/undefined.
- incluir si `status === "corrected"`.
- excluir si `status === "closed"`.

**Fila sintética (`mv:<id>`)**: además de campos actuales, exponer:
- `sourceMovementId = m.id`
- `unit_cost_snapshot` original (además del `unit_cost` ya derivado)
- `pendingClassificationResolution`
- `isCorrected = resolution?.status === "corrected"`
- `canClose = isCorrected`

**Helpers** (UPDATE sólo sobre `resolution_data`, merge con JSON actual leído en el mismo helper):
- `resolvePendingClassificationNoRestock(movementId)` — corta si ya `corrected|closed`. Escribe `status: corrected`, `action: no_restock`, `resolved_at`, `resolved_by`, `note: "No hacer restock"`.
- `markPendingClassificationReplaced(movementId, eventId)` — corta si ya `corrected|closed`. Escribe `status: corrected`, `action: replace`, `replacement_event_id`, `resolved_at`, `resolved_by`, `note: "Reemplazado por otra prenda"`.
- `closePendingClassification(movementId)` — sólo si `corrected`. Escribe `status: closed`, `closed_at`, `closed_by`.

Todos invalidan `["fab_fund_movements","pending_classification"]` y `["replenishment_policy_events"]`.

`resolved_by`/`closed_by` desde `supabase.auth.getUser()`.

Ampliar tipo `PolicyEvent` con los campos nuevos.

## 2) `PolicyEventsAttentionPanel.tsx`

Para `r.action === "unclassified_fund"`:
- Si `!r.isCorrected` → `<Button onClick={() => setResolveRow(r)}>Definir política</Button>` (reemplaza el `Link` actual).
- Si `r.isCorrected` → en columna Estado, `Badge` verde `Corregido`; en Acción, botón `Cerrar` que llama `closePendingClassification(r.sourceMovementId)`. La fila desaparece porque el hook filtra `closed`.

Estado local: `const [resolveRow, setResolveRow] = useState<PolicyEvent | null>(null)`.

Al final del componente renderizar `<PendingClassificationResolveDialog row={resolveRow} open={!!resolveRow} onOpenChange={(v) => !v && setResolveRow(null)} />`.

## 3) `PendingClassificationResolveDialog.tsx` (nuevo)

Props: `{ row: PolicyEvent | null; open; onOpenChange }`.
Estados: `mode: "menu" | "picker" | "apply"`, `pickedCore`, `bridgeEvent`.

Cabecera + resumen (producto, SKU, pedido, cantidad, unit_cost, amount, woo_product_id, woo_variation_id).

### Menú
- **"No hacer restock"** → `resolvePendingClassificationNoRestock(row.sourceMovementId)` → invalidar → cerrar.
- **"Reemplazar por otra prenda"** → `mode = "picker"`.

### Picker
Lista de candidatos del Catálogo de Fabricación con `useCoreProducts()` (mismo que `ReplacementPickerDialog`), filtrando por `commercial_status='active'`, `is_restockable=true`, `replenishment_route='internal_factory'`, excluyendo el propio `core_product_id` y el mismo `woo_product_id`. Sólo UI de búsqueda + selección; **no** se llama al `save()` del picker existente (ese guarda política y no queremos eso).

### Cálculo de cantidad/costo/monto (regla del ajuste)
```
quantity  = row.quantity ?? row.qty ?? 1
unit_cost = row.unit_cost_snapshot ?? row.unit_cost ?? row.cost ?? null
amount    = row.amount ?? (unit_cost != null ? quantity * unit_cost : null)
```
Si `unit_cost == null` **o** `amount == null`: bloquear la opción Reemplazar y mostrar toast/alert:
> "No se puede reemplazar porque el movimiento no tiene costo reservado válido."

### Idempotencia del bridge event (regla del ajuste)
Si `row.pendingClassificationResolution?.replacement_event_id` existe:
- `SELECT * FROM core_replenishment_policy_events WHERE id = eventId`.
- `status ∈ ('open','reviewed')` → **reutilizar**, guardar en `bridgeEvent`, ir a `mode="apply"`.
- `status = 'resolved'` → no crear otro; llamar `markPendingClassificationReplaced(row.sourceMovementId, eventId)` si aún no está `corrected`; cerrar modal.
- `status = 'ignored'` (o cualquier otro) → crear un nuevo event puente (sobrescribiendo `replacement_event_id` en `resolution_data` al finalizar).

Si no hay `replacement_event_id` o corresponde crear uno nuevo, `INSERT INTO core_replenishment_policy_events`:
- `action: 'suggest_replacement'`
- `status: 'open'`
- `severity: 'warning'`
- `source_type: 'fabrication_fund_movement'` (valor ya soportado por `ReplacementApplicationDialog`; confirmado en `useReplenishmentPolicyEvents.ts` y en `ReplacementApplicationDialog.tsx` línea 205)
- `source_id: row.sourceMovementId`
- `quantity`, `unit_cost`, `amount` según regla anterior
- `core_product_id`, `woo_product_id`, `woo_variation_id`, `woo_order_id`, `woo_order_item_id` de la fila
- `replacement_product_id: pickedCore.id`
- `replacement_woo_product_id: pickedCore.woo_product_id`
- `replacement_behavior: 'use_on_restock_with_confirmation'`
- `resolution_data`: `{ product_name, sku, bridge_source: 'pending_classification', origin_movement_id: row.sourceMovementId }`

Guardar en `bridgeEvent` y `mode = "apply"`.

### Apply
Renderizar embebido `<ReplacementApplicationDialog event={bridgeEvent} open onOpenChange={handleApplyClose} />`.

`handleApplyClose(v)` (regla del ajuste):
1. `SELECT status FROM core_replenishment_policy_events WHERE id = bridgeEvent.id` (refetch fresco, no memoria).
2. Si `status = 'resolved'` → `markPendingClassificationReplaced(row.sourceMovementId, bridgeEvent.id)` → invalidar queries → cerrar todo el modal exterior.
3. Si sigue `open|reviewed` → no marcar corregido; simplemente cerrar el sub-dialog (el bridge event queda reutilizable, la próxima apertura entra por la rama de reutilización).
4. Si hubo error en el RPC del ApplicationDialog → mismo comportamiento que (3), bridge queda reutilizable.

## Idempotencia (resumen)

- **No restock**: cortocircuita si `status ∈ {corrected, closed}`.
- **Replace**: revisa `replacement_event_id`; reutiliza en `open|reviewed`; cierra ciclo en `resolved`; regenera en `ignored`.
- **Cerrar**: sólo sobre `corrected`.

## Lo que NO se hace

Cero migraciones, cero RPC, cero edge function. No se toca `amount`, `fund_bucket`, `movement_type` ni `status` del movimiento (sólo `resolution_data`). Nada de cálculo financiero manual; diferencia de costo la aplica `core_apply_replacement_event` ya invocado por `ReplacementApplicationDialog`.

## Validación

- `tsgo --noEmit`.
- Casos A/B/C manuales:
  - A: No restock (MSW61 L / #34144) → sin movimientos nuevos, fila `Corregido` → `Cerrar` → oculta.
  - B: Reemplazo end-to-end vía `ReplacementApplicationDialog` → verificar SELECT fresco y transición a `Corregido`.
  - C: Doble apertura del mismo movimiento → no crea dos policy_events; reutiliza el existente.
- Caso extra: movimiento sin `unit_cost_snapshot` → botón "Reemplazar" bloqueado con mensaje.
