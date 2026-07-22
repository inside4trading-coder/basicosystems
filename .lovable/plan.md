## Parche mínimo — `public.core_apply_replacement_event`

Redefinir la RPC con `CREATE OR REPLACE FUNCTION` cambiando **solo tres bloques**, dejando intacta la firma, el `SECURITY DEFINER`, y el resto del cuerpo.

### Cambios exactos

**1. Bug A — CASE de bucket destino (líneas 255-259 del cuerpo actual)**

De:
```sql
v_dest_bucket := CASE v_line_action
  WHEN 'internal_factory' THEN 'internal_factory'
  WHEN 'external_supplier_review' THEN 'external_supplier'
  WHEN 'manual_cost_review' THEN 'pending_classification'
  ELSE 'pending_classification' END;
```
A:
```sql
v_dest_bucket := CASE v_line_action
  WHEN 'internal_factory'         THEN 'internal_factory'
  WHEN 'allow_internal_factory'   THEN 'internal_factory'
  WHEN 'external_supplier_review' THEN 'external_supplier'
  WHEN 'manual_cost_review'       THEN 'pending_classification'
  ELSE 'pending_classification' END;
```

**2. Bug B — guardia idempotente (líneas 346-348)**

De:
```sql
IF v_do_reconcile
   AND NOT (v_event.resolution_data IS NOT NULL
            AND v_event.resolution_data #>> '{financial_reconciliation,status}' = 'posted') THEN
```
A:
```sql
IF v_do_reconcile
   AND COALESCE(v_event.resolution_data #>> '{financial_reconciliation,status}', '') <> 'posted' THEN
```

**3. Bug C — creación de necesidad (línea 396)**

De:
```sql
IF v_line_action = 'internal_factory' THEN
```
A:
```sql
IF v_line_action IN ('internal_factory','allow_internal_factory') THEN
```

Ningún otro `IF v_line_action = 'internal_factory'` en el resto del cuerpo requiere cambio (verificado con grep).

### Convención financiera que se preserva

Con los buckets ya corregidos por Bug A, el flujo entra en la rama **"reclasificación proporcional"** (líneas 280-318), que ya implementa exactamente **Opción 2** del brief:

- `replacement_reclassification_out` = `-orig_amount` en bucket origen
- `replacement_reclassification_in`  = `+share` (proporcional al peso del bucket destino sobre el total destino, aplicado sobre `orig_amount`) en bucket destino
- `replacement_cost_adjustment`      = `dest_bucket_total − share` en bucket destino (solo si ≠ 0)

Para el caso testigo (Woo #16684 → Canserbero S, 6.5396 → 4.70, un único bucket destino):
- out `-6.5396` en `pending_classification`
- in `+6.5396` en `internal_factory` (share = round(4.7 / 4.7 × 6.5396, 4) = 6.5396)
- adjustment `-1.8396` en `internal_factory` (4.70 − 6.5396)

Efecto neto: `pending_classification −6.5396`, `internal_factory +4.70`. **Sin doble ajuste** (la diferencia se aplica una sola vez, sobre el bucket destino).

### Fuera de alcance del parche

- No se toca UI, hooks, ni frontend.
- No se toca WooCommerce, OP, ni inventario.
- **No se repara** el evento `c0ed5fc1-3bd5-4508-a3c4-27e45781dd3d` — queda para una operación posterior de reparación de datos.
- No se modifican tablas ni constraints.

### Validación post-migración

1. `tsgo` typecheck del proyecto (no debería reportar nada, no se toca TS).
2. Consulta a `pg_get_functiondef` para confirmar que las tres regiones cambiaron.
3. Dry-run (`p_dry_run := true`) contra un evento puente sintético con `route_action = 'allow_internal_factory'` y verificar:
   - `financial_preview.target_totals_by_bucket` tiene clave `internal_factory` (no `pending_classification`)
   - `financial_preview.projected_movements` contiene `replacement_reclassification_out` + `replacement_reclassification_in` (+ `replacement_cost_adjustment` si aplica)
   - `financial_preview.net_difference` coincide con el delta esperado

Si no hay evento nuevo disponible para el dry-run, la validación se limita a la inspección estática del `pg_get_functiondef` y se comunica al usuario para que ejecute el próximo reemplazo real como prueba en vivo.

### Entregable

Un solo `supabase--migration` con el `CREATE OR REPLACE FUNCTION public.core_apply_replacement_event(...)` completo (mismo cuerpo actual con los tres bloques reemplazados). Sin `DROP`, sin cambios de firma, sin tocar grants (los existentes se conservan al usar `CREATE OR REPLACE`).
