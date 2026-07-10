## Bugfix: candidatos de reemplazo filtrados por política efectiva real

Sólo frontend, un archivo: `src/components/core/woocore/NoRestockConfigDialog.tsx`. Reutiliza `LifecycleStatusDialog` y `ReplenishmentRouteDialog` existentes.

### 1. Resolución de política efectiva (determinista, null-safe)

En `useFabricableReplacementCandidates`, reemplazar el `.or(...)` combinado por dos queries independientes:

- Sólo ejecutar `in('core_product_id', coreIds)` si `coreIds.length > 0`.
- Sólo ejecutar `in('woo_product_id', wooIds)` si `wooIds.length > 0`.
- Traer también `restock_enabled`, `updated_at`. Ordenar `.order('updated_at', { ascending: false })` y al hacer `Map.set` sólo escribir si la key aún no existe → nos quedamos con la más reciente por identidad.
- Construir `policyByCore` y `policyByWoo`.
- Resolución por candidato con prioridad: (1) `policyByCore[r.id]`, (2) `policyByWoo[r.woo_product_id]`, (3) sin política.

### 2. Criterio de bloqueo (final)

Bloquear si cumple **cualquiera**:

- `lifecycle_status ∈ {no_restock, exit, ignored, replaced}`
- `replenishment_route === 'external_supplier'`
- `restock_enabled === false` (aunque `lifecycle_status='active'`)
- Producto Core no fabricable real: variable con `variants_count === 0`.

Motivo por prioridad (primer match gana): `Reemplazado`, `No restock`, `En salida`, `Ignorado`, `Proveedor externo`, `Restock deshabilitado`, `Variable sin variantes`, `Producto Core no activo`.

Ningún candidato con `blocked_reason` puede mostrar el badge "Fabricable".

### 3. Sin política → permitido si Core es fabricable

`core_products.commercial_status='active'` + `is_restockable=true` + (simple o variable con variantes) → mostrar badge `Fabricable · Sin política explícita`. Mantiene compatibilidad histórica.

### 4. Visibilidad en el selector

- Ocultar bloqueados en resultados normales.
- Si el término coincide **exactamente** con `core_sku`, `woo_product_sku` o `String(woo_product_id)`, mostrar el bloqueado deshabilitado con badge `No disponible` + motivo.
- Exclusión null-safe del producto original por `core_id` y `woo_product_id`.

### 5. Acción "Abrir política de {sku}" — reutilizar diálogos existentes

`NoRestockConfigDialog` sólo gestiona `no_restock/exit/replaced` y siempre guarda `restock_enabled=false`, así que NO sirve para reactivar CAN0001. En su lugar:

- Cuando el candidato seleccionado esté bloqueado, mostrar dos botones:
  - `Cambiar estado` → abre `LifecycleStatusDialog` con `ctx` del candidato (permite fijar `lifecycle_status='active'` + `restock_enabled=true`).
  - `Cambiar ruta` → abre `ReplenishmentRouteDialog` (permite fijar `replenishment_route='internal_factory'`).
- Construir el `ctx` a partir del candidato: `{ map: coreWooMap por woo_product_id (o placeholder mínimo si no hay Woo), core: {id: core_id, core_sku, name}, policy: policyEfectiva }`.
- Deshabilitar el toast/guardado del reemplazo mientras esté bloqueado; el mensaje del toast al intentar guardar queda:  
  `"{core_sku} no puede usarse como reemplazo porque su política actual es {motivo}. Cambia su política a Activo + Fabricación interna con restock habilitado, o selecciona otro producto."`

### 6. Invalidación tras corregir la política del candidato

Al cerrar `LifecycleStatusDialog` o `ReplenishmentRouteDialog` con éxito (`onDone`):

- `queryClient.invalidateQueries` para: `["fabricable-replacement-candidates"]`, `["replenishment-policies"]`, `["woo-product-map"]`, `["core-products"]` (y variantes con prefijo si existen).
- `refetch()` del selector para que el candidato pase de `No disponible · Reemplazado` a `Fabricable` sin recargar ni cerrar el flujo de reemplazo.

### 7. Validación

- Typecheck.
- CAN0001 `lifecycle_status='replaced'` → oculto por defecto; visible deshabilitado sólo con búsqueda exacta; motivo `Reemplazado`.
- Tras usar `LifecycleStatusDialog` para dejar CAN0001 `active + restock_enabled=true` y `ReplenishmentRouteDialog` para `internal_factory`, el candidato aparece como `Fabricable` sin recargar y permite guardar SHM019 → CAN0001.

### Fuera de alcance

Sin backend, sin migraciones, sin RPC, sin Woo writes, sin tocar reservas ni reemplazos existentes.
