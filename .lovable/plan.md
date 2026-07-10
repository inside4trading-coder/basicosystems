## Alcance

Frontend only. Todo el trabajo en `src/components/core/woocore/ReplacementApplicationDialog.tsx` (más un pequeño helper para cargar la política efectiva). Sin backend, sin migraciones, sin RPC nuevas, sin cambios financieros.

## 1. Política actual como fuente de verdad

Añadir dentro del diálogo una query `effectivePolicy`:

- Key: `["effective-policy", event.policy_id ?? event.woo_product_id ?? event.core_product_id]`.
- Lookup:
  1. Si `event.policy_id` → `core_replenishment_policies` por `id`.
  2. Fallback → por `core_product_id`, luego `woo_product_id`.
- Los campos efectivos usados por el diálogo (`replacement_behavior`, `replacement_product_id`, `replacement_woo_product_id`, `replenishment_route`) se leen SIEMPRE de `effectivePolicy`, no del `event`. El evento queda solo como snapshot / fallback si la política no existe.
- `behaviorBlocked` se recalcula con `effectivePolicy.replacement_behavior`.

Al guardar `NoRestockConfigDialog`:

- Invalidar `["replenishment-policies"]` y `["effective-policy", ...]`.
- Refetch de `effectivePolicy`.
- Refetch de `replacementProduct` y `replacementVariants` (dependen del nuevo `replacement_product_id` / `replacement_woo_product_id`).
- Si el nuevo behavior permite aplicar, el diálogo permanece abierto y muestra automáticamente la sección de asignación.
- No depender de que el `event` cambie.

## 2. Warning + botones

Cuando `behaviorBlocked`:

- Copy: "Este reemplazo está configurado como Solo sugerir. Para seleccionar tallas y generar la necesidad del producto sustituto, cambia el comportamiento a Usar en reposición con confirmación."
- Footer: **Editar política** (abre `NoRestockConfigDialog` con ctx reconstruido: `map` desde `core_woo_product_map` por `event.woo_product_id`, `policy = effectivePolicy`, `core` desde `core_products` por `effectivePolicy.core_product_id`) + **Cerrar**.

El mismo botón "Editar política" se ofrece también dentro del flujo abierto para cambiar el producto reemplazo (no se abre `ReplacementPickerDialog` desde aquí).

## 3. Selector de variantes — producto simple vs variable

Determinar si el reemplazo espera variantes usando información existente sin backend nuevo:

- Query `replacementWooMap` a `core_woo_product_map` por `woo_product_id = replacementProduct.woo_product_id ?? effectivePolicy.replacement_woo_product_id`. Traer `woo_product_type`, `woo_variations_count`, `variants_sync_status`.
- `expectsVariants = woo_product_type === "variable" || (woo_variations_count ?? 0) > 0`.

Comportamiento:

- **Simple** (`!expectsVariants`): una única fila sin selector, cantidad editable, `allocations = [{ core_variant_id: null, woo_variation_id: null, quantity }]`.
- **Variable con variantes Core disponibles** (`replacementVariants.length > 0`): render de una fila por variante con `talla · color · SKU` + input cantidad (default 0). Se mapea internamente a `allocations` filtrando cantidad > 0. No se prellena la talla del original.
- **Variable sin variantes Core**: bloque de estado con "No se encontraron variantes fabricables para el producto reemplazo." y acciones: Sincronizar variantes, Abrir producto (`/core/productos/:id`), Editar política.

## 4. Sincronizar variantes con identidad Woo correcta

- `Sincronizar variantes` usa `SyncVariantsDialog` existente pasándole el Woo parent product ID:
  - Preferencia: `replacementProduct.woo_product_id`.
  - Fallback: `effectivePolicy.replacement_woo_product_id`.
- Si ninguno existe: deshabilitar el botón con mensaje "Este producto no tiene un producto Woo vinculado. Revisa su conexión en Mapa Woo/Core."
- No se crean variantes desde el frontend.

## 5. Preview con costos del backend

- Fuente principal: respuesta del `dry_run` de `core_apply_replacement_event` (`unit_cost`, `cost_source`, `subtotal`, `estimated_total`, `warnings`, `route_summary`).
- Costo reservado original: query pequeña a `core_fabrication_fund_movements` cuando `event.source_type === "fabrication_fund_movement"` y `event.source_id` → `amount`. Fallback: ocultar la línea.
- Bloque de preview muestra:
  - Original: nombre + `woo_product_id/variation_id` + costo reservado (`amount`).
  - Reemplazo: por asignación → talla / color / SKU / cantidad / unit_cost del backend / subtotal del backend.
  - Total destino = `estimated_total`.
  - Diferencia estimada = `estimated_total − amount` (solo informativa).
  - Warnings del backend si vienen.
- No se calculan costos con `unit_cost_override` u otros campos locales.

## 6. Invalidación del preview

Cualquier cambio en política efectiva, producto reemplazo, lista de variantes, asignaciones, `confirmedQty` o `reason` → `setPreview(null)` + `Confirmar reemplazo` deshabilitado hasta un nuevo `Generar preview` exitoso.

## 7. Confirmación

Sin cambios: `core_apply_replacement_event` con `p_dry_run: false` y el mismo payload actual.

## Archivos a tocar

- `src/components/core/woocore/ReplacementApplicationDialog.tsx` — reescritura parcial.
- Ninguno más. Sin backend. Sin migraciones. Sin RPC. Sin cambios financieros. Sin Woo writes.
