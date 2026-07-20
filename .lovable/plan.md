## Fix mínimo — reemplazar `resolution_data` por `cost_snapshot_data`

Confirmado en DB: la columna `resolution_data` no existe en `core_fabrication_fund_movements`. Sí existe `cost_snapshot_data` (jsonb). Hay 4 movimientos `pending_classification` / `posted`, 0 con resolución previa, 0 `closed`. El hook falla la query completa y devuelve 0 filas sintéticas.

Único archivo a modificar: `src/hooks/useReplenishmentPolicyEvents.ts`.

### 1. `pendingClassMovsQuery`

- `select(...)`: reemplazar `resolution_data` por `cost_snapshot_data`.
- Filtro client-side:
  ```ts
  const resolution = m.cost_snapshot_data?.pending_classification_resolution ?? null;
  if (resolution?.status === "closed") return false;
  return true;
  ```
- Sin filtros SQL sobre el jsonb. Mantiene `fund_bucket='pending_classification'` y `status='posted'`.

### 2. Mapeo de fila sintética `mv:<id>`

Leer resolution desde `m.cost_snapshot_data?.pending_classification_resolution`. Recalcular:

- `pendingClassificationResolution = resolution`
- `isCorrected = resolution?.status === "corrected"`
- `canClose = isCorrected`

Mantener `id`, `action`, `_kind`, `_synthetic`, `sourceMovementId`, `unit_cost_snapshot` iguales. El `resolution_data` visual expuesto en la fila (usado sólo para `product_name` / `woo_sku`) queda igual.

### 3. `readMovementResolution`

- `.select("cost_snapshot_data")`
- return `data?.cost_snapshot_data ?? {}`

### 4. `writeMovementResolution`

```ts
const current = await readMovementResolution(movementId);
const next = {
  ...(current ?? {}),
  pending_classification_resolution: {
    ...(current?.pending_classification_resolution ?? {}),
    ...mergedResolution,
  },
};
await supabase
  .from("core_fabrication_fund_movements" as any)
  .update({ cost_snapshot_data: next })
  .eq("id", movementId);
```

Preserva cualquier otra clave existente en `cost_snapshot_data`.

### 5. Helpers públicos

`resolvePendingClassificationNoRestock`, `markPendingClassificationReplaced`, `setPendingClassificationBridgeEventId`, `closePendingClassification` mantienen firma y lógica; sólo cambia el backend read/write.

### Fuera de alcance

Sin migraciones, sin RPC, sin edge functions. No se tocan `amount`, `fund_bucket`, `movement_type`, `status`, `quantity`, `unit_cost_snapshot`, saldos, ni filas `missing_cost` / `missing_map`.

### Validación tras el fix

- Total atención: 7. Sin costo: 3. Sin clasificar: 4.
- Las 4 filas aparecen sin badge de corregido.
- "No hacer restock" persiste bajo `cost_snapshot_data.pending_classification_resolution.status = "corrected"`.
- "Cerrar" cambia status a `"closed"` y la fila desaparece.
- Resto de `cost_snapshot_data` intacto.
- `tsgo --noEmit` limpio.
