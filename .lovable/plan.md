# Bloque 2 — Reposición Externa / Órdenes a Proveedor (corregido)

Convertir eventos `external_supplier_review` en órdenes reales a proveedor, con ciclo `draft → approved → ordered → (partially_)received → cancelled`. Sin tocar Woo, fábrica interna, QR, nómina, ni inventario automático. Todos los totales se recalculan en backend; sin UPDATE directo desde el cliente sobre montos.

## 1. Migración: 2 tablas + secuencia + RPCs

No existe `core_suppliers`. Se usa `supplier_name_snapshot` desde `core_replenishment_policies.external_supplier_name`; `supplier_id uuid nullable` queda reservado para el futuro catálogo.

**`core_external_purchase_orders`** — campos exactos pedidos (`order_number` unique `EXT-000001` via sequence + trigger, `supplier_id`, `supplier_name_snapshot`, `status`, `payment_status`, `currency`, `subtotal`, `shipping_cost`, `other_cost`, `total`, `amount_paid`, `balance_due`, `supplier_order_reference`, `estimated_delivery_date`, `notes`, `cancellation_reason`, timestamps y usuarios de aprobación / pedido / recepción / cancelación, `created_by`/`updated_by`, `created_at`/`updated_at`). CHECKs sobre `status` y `payment_status`. Trigger `updated_at`.

**`core_external_purchase_order_lines`** — campos exactos pedidos (`order_id` FK cascade, `policy_event_id` FK a eventos, producto/variante Core y Woo, snapshots, `quantity_ordered`, `quantity_received` default 0, `unit_cost`, `line_subtotal`, `cost_source`, `policy_id`, `status` con valor extra `cancelled`, `notes`). CHECKs: `quantity_ordered > 0`, `quantity_received >= 0`, `quantity_received <= quantity_ordered`, `unit_cost >= 0`. **UNIQUE INDEX parcial** `(policy_event_id) WHERE policy_event_id IS NOT NULL` → idempotencia estricta por evento.

**GRANT + RLS**: `GRANT SELECT, INSERT, UPDATE ... TO authenticated; GRANT ALL ... TO service_role;`. RLS activo. SELECT para authenticated. Mutaciones sensibles solo a través de RPCs SECURITY DEFINER. Sin DELETE.

## 2. RPCs (SECURITY DEFINER, validan admin/manager con `has_role`)

Todas las transiciones toman `FOR UPDATE` sobre orden y líneas.

1. **`core_create_external_purchase_orders_from_events(p_event_ids uuid[], p_overrides jsonb default '{}'::jsonb, p_dry_run boolean default true)`**
   - Carga eventos, valida `action='external_supplier_review'` y que no tengan línea externa.
   - Resuelve proveedor+costo desde política; aplica overrides por evento (`quantity_ordered`, `unit_cost`, `notes`) y por proveedor (`supplier_name`, `shipping_cost`, `other_cost`, `currency`, `notes`).
   - **Agrupación con clave normalizada**: `lower(unaccent(regexp_replace(trim(supplier_name), '\s+', ' ', 'g')))`. Un solo bucket para "Proveedor X"/" proveedor x "/"PROVEEDOR X". Se conserva `supplier_name_snapshot` legible (primera ocurrencia trimmed).
   - Backend recalcula `line_subtotal`, `subtotal`, `total`, `balance_due`. Nunca confía en cálculo del cliente.
   - `p_dry_run=true` → devuelve JSON preview idéntico al que se guardaría, sin escribir.
   - `p_dry_run=false` → crea una orden `draft` por proveedor normalizado, inserta líneas, marca eventos `reviewed` con nota "Convertido en orden externa EXT-XXXXXX". No pasa eventos a `resolved`.
   - **Preview y confirmación reciben el mismo payload** (`p_event_ids` + `p_overrides`).

2. **`core_update_external_purchase_order_draft(p_order_id uuid, p_header jsonb, p_lines jsonb)`** — única vía de edición.
   - Solo si `status='draft'`; `SELECT ... FOR UPDATE` sobre orden y líneas.
   - `p_header`: `supplier_name`, `currency`, `shipping_cost`, `other_cost`, `notes`, `estimated_delivery_date`, `supplier_order_reference`.
   - `p_lines`: array de `{line_id, quantity_ordered, unit_cost, notes, status}`. `status='cancelled'` retira la línea (no DELETE) y exige `cancellation_notes`.
   - Valida `quantity_ordered > 0` en líneas activas y `unit_cost >= 0`.
   - Recalcula `line_subtotal`, `subtotal` (solo líneas no canceladas), `total = subtotal + shipping_cost + other_cost`, `balance_due = total - amount_paid`, refresca `payment_status`, `updated_at`, `updated_by`.
   - Agregar línea manual nueva: también vía este RPC (item sin `line_id`).

3. **`core_approve_external_purchase_order(p_order_id uuid)`**
   - Solo desde `draft`. Valida proveedor, ≥1 línea activa, cantidades>0, costos>0, `total>0`.
   - `status='approved'` + timestamps; eventos vinculados → `resolved` con nota.

4. **`core_mark_external_purchase_order_ordered(p_order_id uuid, p_reference text, p_eta date, p_notes text)`**
   - Solo desde `approved`. `status='ordered'`, líneas activas → `ordered`.

5. **`core_receive_external_purchase_order(p_order_id uuid, p_lines jsonb)`**
   - Solo desde `ordered` o `partially_received`. Al menos un `qty_now > 0`. Nunca supera `quantity_ordered - quantity_received`.
   - Suma recepción, actualiza estado línea (`ordered`/`partially_received`/`received`) y estado orden. Al completar todas → `received_at`/`received_by`.
   - **No** crea inventario, **no** crea `core_production_units`, **no** crea QR/ficha viajera, **no** escribe Woo.

6. **`core_cancel_external_purchase_order(p_order_id uuid, p_reason text)`**
   - Requiere motivo. Bloquea cancelación si `SUM(quantity_received) > 0` (ni siquiera parcial en esta fase).
   - `status='cancelled'`. Conserva líneas y auditoría.

7. **`core_reopen_external_purchase_order(p_order_id uuid)`**
   - Solo desde `cancelled` y `SUM(quantity_received)=0`. Vuelve a `draft` reutilizando líneas y eventos vinculados. No crea otra orden.

8. **`core_update_external_purchase_order_payment(p_order_id uuid, p_amount_paid numeric)`**
   - `p_amount_paid >= 0` y `<= total`. Recalcula `balance_due`, `payment_status`.

Toda mutación registra en `core_audit_logs`: `external_order_created/approved/ordered/partially_received/received/cancelled/reopened/payment_updated` con `order_id`, `order_number`, `previous_values`, `new_values`, usuario, fecha.

## 3. UI en `/core/mapa-woo-core`

Renombrar la pestaña **Proveedor externo** → **Reposición externa** con 3 sub-tabs:

- **Pendientes**: eventos `action='external_supplier_review'`, `status IN ('open','reviewed')`, sin línea externa. Selección múltiple → **Crear orden externa** abre `ExternalOrderPreviewDialog`.
- **Órdenes**: tabla (Nº, proveedor, estado, productos, unidades, subtotal, envío, total, pagado, pendiente, fecha, ETA, acciones) con filtros por status y acciones Ver/Editar borrador/Aprobar/Marcar pedida/Registrar recepción/Cancelar/Reabrir.
- **Recibidas**: shortcut a `received` con botón visual **Registrar entrada en inventario** deshabilitado (tooltip "Próxima fase").

`ExternalOrderPreviewDialog`: llama la RPC con `p_dry_run=true` + `p_overrides`. Muestra grupos por proveedor normalizado. Permite editar cantidad, costo unitario, notas por línea; proveedor, envío, otros, notas por grupo. Cada cambio actualiza el payload local y re-invoca dry-run (debounce) para que el backend recalcule totales. Confirmar → mismo payload con `p_dry_run=false`. Si un producto no tiene proveedor en política: banner "Este producto está marcado como proveedor externo, pero no tiene proveedor configurado" + botón **Configurar proveedor** (abre política).

`ExternalOrderDetailDrawer`: edición de borrador SOLO vía `core_update_external_purchase_order_draft`. Aprobar / marcar pedida / cancelar / reabrir / pagos vía sus RPCs. `ExternalOrderReceiveDialog` usa RPC de recepción.

Componentes nuevos en `src/components/core/woocore/external/`:
- `ExternalReplenishmentPanel.tsx`
- `ExternalPendingEventsList.tsx`
- `ExternalOrderPreviewDialog.tsx`
- `ExternalOrdersList.tsx`
- `ExternalOrderDetailDrawer.tsx`
- `ExternalOrderReceiveDialog.tsx`

Hook `src/hooks/useExternalPurchaseOrders.ts` con queries + wrappers de RPCs.

## 4. Archivos afectados

- Migración nueva: 2 tablas, sequence, triggers, RLS, GRANT, 8 RPCs.
- Editar `src/pages/core/CoreWooCoreMap.tsx` (renombrar tab + montar panel).
- Nuevos: 6 componentes + 1 hook.

## Fuera de scope

Sin escritura Woo, sin stock automático al recibir, sin creación de `core_production_units` para recepciones externas, sin OP interna, sin QR/ficha viajera, sin procesos de producción, sin nómina, sin escaneo, sin BASICO ESPAÑA, sin dashboard nuevo, sin módulo financiero completo, sin catálogo de proveedores nuevo, sin reemplazos automáticos, sin reprocesar histórico, sin DELETE (retiro = `status='cancelled'`).

## Pendiente para Bloque 3

Entrada auditable a inventario para recepciones externas mediante **movimientos de inventario o módulo separado de recepción externa** (nunca vía `core_production_units` ni QR interno), catálogo unificado de proveedores + `supplier_id`, integración con `core_fabrication_funds` para egresos de pagos, escritura de stock Woo cuando aplique, aplicación confirmada de `suggest_replacement`, y migración de `core-create-production-order`/`core-generate-production-units` al motor central.
