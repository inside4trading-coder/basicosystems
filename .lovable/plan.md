## BLOQUE 3 — Aplicación Confirmada de Reemplazos (v2, con correcciones)

Modo ahorro: 0 tablas, 1 columna, 1 RPC, 1 diálogo, 2 parches mínimos en edge functions.

### 1. Migración

**1.1 Columna única nueva**
```sql
ALTER TABLE public.core_replenishment_policy_events
  ADD COLUMN IF NOT EXISTS resolution_data jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Guarda: `original_event_id`, `original_product_id`, `original_variant_id`, `replacement_product_id`, `replacement_woo_product_id`, `allocations` (con identidad canónica resuelta), `confirmed_quantity`, `original_suggested_quantity`, `adjustment_reason`, `final_route_action` (o `'mixed'`), `route_summary`, `created_need_ids`, `created_policy_event_ids`, `estimated_total`, `applied_at`, `applied_by`, `already_applied`.

**1.2 RPC `core_apply_replacement_event`** (SECURITY DEFINER, search_path=public)

```sql
core_apply_replacement_event(
  p_event_id uuid,
  p_allocations jsonb,
  p_confirmed_quantity numeric default null,
  p_adjustment_reason text default null,
  p_dry_run boolean default true
) RETURNS jsonb
```

Flujo atómico:

1. `auth.uid()` requerido; exigir `has_role(uid,'admin') OR has_role(uid,'manager')`.
2. `SELECT ... FROM core_replenishment_policy_events WHERE id=p_event_id FOR UPDATE`.
3. **Orden idempotencia**: si `status='resolved'` y `resolution_data ? 'applied_at'` → devolver `{already_applied:true, ...resolution_data}` sin más validaciones ni escrituras.
4. Recién ahora validar `action='suggest_replacement'` y `status IN ('open','reviewed')`.
5. Leer `replacement_behavior` desde la política:
   - `use_on_restock_with_confirmation` / `block_and_suggest` → permitido.
   - `suggest_only` / NULL → `behavior_suggest_only`.
   - `ignore` → `behavior_ignore`.
6. Resolver producto reemplazo por prioridad `replacement_product_id` → `core_woo_product_map(replacement_woo_product_id)` → `core_products.woo_product_id`. `core_product_id` puede quedar NULL si el destino no lo exige (ver §8).
7. **Ciclos vía recursive CTE (máx 20 niveles)** partiendo del producto reemplazo, siguiendo `replacement_product_id` en `core_replenishment_policies`. Bloquear con `replacement_cycle` si reaparece el producto original o cualquier producto ya visitado. La RPC solo aplica el reemplazo directo — nunca sigue la cadena.
8. Cantidad confirmada:
   - `v_suggested := events.quantity`.
   - `v_confirmed := coalesce(p_confirmed_quantity, v_suggested)`; `>0`.
   - Si difiere y `p_adjustment_reason` vacío → `adjustment_reason_required`.
9. **Canonicalización de variantes** por cada allocation antes de deduplicar:
   - Resolver `resolved_core_variant_id` y `resolved_woo_variation_id` cruzando `core_product_variants` y `core_woo_variant_map`.
   - Validar que la variante pertenece al producto reemplazo; rechazar variantes del original.
   - Clave canónica: `core:<uuid>` | `woo:<id>` | `product:no_variant`.
   - Detectar duplicados por esa clave.
   - `SUM(quantity) = v_confirmed` exacto; `quantity>0`; rechazar decimales si el destino exige enteros.
10. Por cada allocation, invocar el motor central en **preview**:
    ```
    route_core_replenishment_candidate(..., p_dry_run := true)
    ```
    con `source_type='replacement_policy_event'`, `source_id=p_event_id`, producto/variante = reemplazo, cantidad = allocation, costo via `resolve_core_operational_unit_cost`.
11. Reglas por destino (aplican también a §9 sobre exigencia de `core_variant_id`):
    - **A. `internal_factory`**: exige `core_product_id` del reemplazo; si el producto tiene variantes, cada allocation debe resolver a `core_variant_id`. Si falta → `replacement_not_mapped` con mensaje "El reemplazo debe estar conectado a Core para entrar a fabricación interna."
    - **B. `external_supplier_review`**: acepta identidad Woo (`replacement_woo_product_id` + variation) sin exigir `core_product_id`.
    - **C. `manual_cost_review`**: acepta identidad Woo si la política resuelve costo.
12. Si alguna allocation devuelve `block_no_restock | block_exit | block_ignored | suggest_replacement` → abortar transacción con `replacement_blocked` (mensaje con action exacta). No resolver evento original, no crear necesidades, no crear eventos downstream.
13. **Si `p_dry_run=true`**: devolver JSON completo (original, reemplazo, allocations con canonical IDs, costos, cost_source, subtotales, route_action por allocation, route_summary, totales, warnings). Cero escrituras.
14. **Si `p_dry_run=false`**, por allocation:
    - **internal_factory** → upsert directo en `core_production_needs` reutilizando exactamente la lógica de `core-generate-production-needs` (misma clave, snapshots, idempotencia). Metadata con `source_type='replacement_policy_event'`, `replacement_event_id`, `original_product_id`, `replacement_product_id`, `replacement_variant_id`, `route_action`, `policy_id`. **No** crea evento de política.
    - **external_supplier_review** y **manual_cost_review** → volver a invocar `route_core_replenishment_candidate(..., p_dry_run := false)`. El motor central se encarga del insert/upsert del evento downstream (dedupe_key, snapshots, idempotencia, política efectiva). La RPC nunca inserta/upsert manualmente en `core_replenishment_policy_events` para downstream.
15. **Resultado mixto**: si distintas allocations producen distintos destinos permitidos, completar la transacción. `final_route_action = 'mixed'` con `route_summary` desglosado por acción en `resolution_data`. El evento original solo queda resolved cuando todas las allocations terminan correctamente.
16. Marcar evento original: `status='resolved'`, `resolved_at=now()`, `resolved_by=uid`, `resolution_notes` según destino/mixto, `resolution_data` completo con IDs.
17. `core_audit_logs`: una entrada `replacement_applied` (solo si no dry_run).
18. Devolver JSON con `already_applied=false`, IDs creados, totales, allocations, warnings.

**1.3 Parche mínimo en 2 edge functions**

En `supabase/functions/core-create-production-order/index.ts` y `supabase/functions/core-generate-production-units/index.ts`, reemplazar la llamada directa a `resolve_core_replenishment_action` por:
```
route_core_replenishment_candidate(..., p_dry_run := true)
```
Sin `route_only` (parámetro inexistente en el motor). Mantener 409 `policy_blocked`, mensajes y validaciones actuales. Cero escrituras porque `p_dry_run=true`. No tocar histórico. No inventar `source_id`.

### 2. Frontend

**2.1 `src/components/core/woocore/ReplacementApplicationDialog.tsx`** (único componente nuevo).

Secciones: Original / Reemplazo (estado + política + ruta) / Asignación (selector de variantes del reemplazo con cantidades, total asignado, cantidad confirmada, razón de ajuste condicional) / Preview / Botonera.

Botones: Cancelar · Editar política · Generar preview · Confirmar reemplazo.

**Invalidación de preview**: cualquier cambio en variante, cantidad, cantidad confirmada o razón de ajuste invalida el preview vigente y deshabilita "Confirmar reemplazo" hasta regenerarlo. La confirmación envía exactamente el payload validado por el último preview (backend revalida igual).

Casos:
- `suggest_only` / NULL: modo informativo, botón Aplicar deshabilitado, CTA "Editar política".
- `ignore`: bloqueo con mensaje.
- Evento `resolved`: resumen desde `resolution_data` + enlaces (necesidad interna / Reposición externa / evento de revisión). Sin botón aplicar.
- Reemplazo bloqueado: mostrar action exacta.

**2.2 `src/components/core/woocore/PolicyReviewPanel.tsx`** (editar). Añadir botón "Aplicar reemplazo" para filas `action='suggest_replacement'`; para `resolved` mostrar "Ver resumen". Sin nueva página. Hook mínimo opcional dentro del propio diálogo.

### 3. Notas de correctez
- No se usa `lifecycle_status='archived'` ni valores no existentes; el bloqueo por lifecycle lo determina `resolve_core_replenishment_action` (no_restock/exit/ignored/replaced).
- La RPC no duplica lógica de eventos downstream: siempre pasa por `route_core_replenishment_candidate`.

### 4. Fuera de scope (para bloques futuros)
Entrada auditable a inventario en recepciones externas, catálogo unificado de proveedores, integración con `core_fabrication_funds`, escritura de stock Woo, migración total de `core-create-production-order`/`core-generate-production-units` al motor central, reprocesamiento histórico.

### 5. NO se hará
Sin Woo, sin OP/QR/ficha viajera/procesos/nómina automáticos, sin BASICO ESPAÑA, sin `core_production_units` para externos, sin catálogo de proveedores, sin dashboard nuevo, sin tablas nuevas, sin cadenas automáticas de reemplazo, sin copia automática de variantes.

### Archivos afectados
- Nueva migración: 1 columna + 1 RPC.
- Editado: `supabase/functions/core-create-production-order/index.ts` (1 punto).
- Editado: `supabase/functions/core-generate-production-units/index.ts` (1 punto).
- Nuevo: `src/components/core/woocore/ReplacementApplicationDialog.tsx`.
- Editado: `src/components/core/woocore/PolicyReviewPanel.tsx`.
- Regen automático: `src/integrations/supabase/types.ts`.
