## Diagnóstico (confirmado por SQL)

Evento del caso: `25febda7-4d06-44aa-bf40-3e122a06f9cc`, `status = open`, `replacement_behavior = use_on_restock_with_confirmation`, `resolution_data.bridge_source = unlinked_core_reserve`, `resolution_data.forced_behavior = use_on_restock_with_confirmation`. El evento puente está correcto.

El bloqueo viene de `public.core_apply_replacement_event`:

```sql
v_behavior := COALESCE(v_policy.replacement_behavior, v_event.replacement_behavior, NULL);
IF v_behavior IS NULL OR v_behavior IN ('suggest_only') THEN
  RETURN jsonb_build_object('error','behavior_suggest_only', ...);
```

La política global (`suggest_only`) gana sobre el evento. Igual ocurre con `v_replacement_product_id` / `v_replacement_woo_product_id`.

## 1. Migración: `CREATE OR REPLACE FUNCTION public.core_apply_replacement_event`

Se regenera la función a partir de `pg_get_functiondef` actual (misma firma, `SECURITY DEFINER`, `SET search_path = public`, cuerpo íntegro: `allow_internal_factory` → `internal_factory`, guardia idempotente `COALESCE(...,'') <> 'posted'`, lógica financiera y de necesidades sin cambios). Tres ediciones puntuales:

1. Declaración nueva: `v_is_bridge boolean := false;`
2. Tras cargar `v_event` y `v_policy`:
```sql
v_is_bridge := v_event.source_type = 'fabrication_fund_movement'
  AND COALESCE(v_event.resolution_data->>'bridge_source','')
      IN ('unlinked_core_reserve','unlinked_core_manual_resolution');

IF v_is_bridge THEN
  v_behavior := COALESCE(v_event.resolution_data->>'forced_behavior',
                         v_event.replacement_behavior,
                         'use_on_restock_with_confirmation');
ELSE
  v_behavior := COALESCE(v_policy.replacement_behavior, v_event.replacement_behavior, NULL);
END IF;
```
3. Selección de producto de reemplazo:
```sql
IF v_is_bridge THEN
  v_replacement_product_id     := COALESCE(v_event.replacement_product_id, v_policy.replacement_product_id);
  v_replacement_woo_product_id := COALESCE(v_event.replacement_woo_product_id, v_policy.replacement_woo_product_id);
ELSE
  -- lógica actual (política primero)
END IF;
```

El resto de validaciones (`ignore`, `behavior_not_applicable`, ciclos, allocations, conciliación) permanece idéntico.

## 2. Frontend

`src/components/core/needs/UnlinkedCoreReserveDialog.tsx`: tras insertar o actualizar el evento puente, hacer un `SELECT * ... eq('id', ev.id)` fresco y pasar ese objeto a `ReplacementApplicationDialog`, en lugar del objeto en memoria. Sin crear eventos duplicados.

`ReplacementApplicationDialog.tsx` ya fuerza el behavior para eventos puente en la UI: sin cambios.

## No se toca
`core_replenishment_policies`, Mapa Woo/Core, Woo, OP, inventario, catálogo, Sublime, flujo No restock, ni eventos de reemplazo normales (siguen bloqueando con `suggest_only`).

## Validación
1. Sin vínculo Core → Decidir reserva → Reemplazar → talla → preview: sin `behavior_suggest_only`.
2. Confirmar: evento `resolved` y necesidad creada.
3. SQL: la política del producto origen sigue en `suggest_only`.
4. Typecheck con `tsgo`.
