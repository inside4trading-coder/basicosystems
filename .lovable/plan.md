# Fix: unidades bloqueadas por "Falta Woo Variation ID"

## Causa real (verificada en base de datos)

La unidad `OP-000009-WOO-4077-M-001` sí tiene `core_variant_id` guardado (`671f7e71-…`), pero **esa variante ya no existe** en `core_product_variants`. El producto WOO-4077 hoy tiene 12 variantes con sus Woo IDs correctos (`MF60 M` → 4079, `MF64 M` → 7581, etc.), todas con IDs nuevos.

Origen: al guardar un producto, `src/pages/core/CoreProductEditor.tsx` (línea ~463) hace `delete` de **todas** las variantes del producto y luego las vuelve a insertar. Cada guardado genera UUIDs nuevos y deja huérfanas las unidades y líneas de OP que apuntaban a los IDs viejos.

Alcance medido: de 77 unidades activas con variante, **24 apuntan a variantes inexistentes** (Canserbero, WOO-4077, Cargo Basico Club, Jogger I Wonder, Surf Wave). Ninguna variante existente tiene `woo_variation_id` nulo, así que el problema no es el modo de costo: es la pérdida del vínculo por reinserción.

## Cambios

### 1. Guardado de variantes sin perder IDs (`CoreProductEditor.tsx`)
Reemplazar el `delete` masivo + `insert` por un guardado conservador:
- variantes existentes (match por `id`, o por `variant_sku`, o por `size`+`color`) → `update`
- variantes nuevas → `insert`
- variantes eliminadas en la UI → `delete` solo de esas

Así los `core_variant_id` dejan de rotar en cada guardado y no vuelve a ocurrir el problema.

### 2. Resolución tolerante de Woo Variation ID
Nuevo helper `src/lib/coreVariantResolve.ts` con una función que, dada una unidad (`core_product_id`, `core_variant_id`, `variant_sku`, `size`, `variant_label`), resuelve la variante viva:
1. por `core_variant_id` si existe
2. si no, por `variant_sku` dentro del producto
3. si no, por `core_product_id` + talla (+ color si viene en `variant_label`)
4. coincidencia única → devuelve variante y `woo_variation_id`; varias → `ambiguo`; ninguna → `no resuelto`

Se usa en:
- `src/components/core/UnitInventorySection.tsx` (ficha viajera / escaneo): antes de bloquear, intenta resolver. Si resuelve, muestra "Woo Variation ID resuelto: [id]" y permite continuar; si no, el mensaje pasa a "Falta Woo Variation ID. Revisa el vínculo de esta variante en Catálogo / Mapa Woo-Core."
- `src/pages/core/CoreInventory.tsx`: mismo fallback al calcular unidades listas y sus bloqueos.

### 3. Reparación de unidades antiguas
RPC `public.core_repair_unit_variant_links(p_dry_run boolean default true)`:
- recorre unidades no canceladas y no ingresadas cuyo `core_variant_id` no existe (o es nulo)
- resuelve con la misma cascada (variant_sku → producto+talla+color)
- coincidencia única → actualiza `core_variant_id`, `variant_sku`, `size` en la unidad
- ambiguas / sin match → no toca nada y las devuelve con motivo
- retorna JSON: `reparadas`, `ambiguas`, `no_resueltas`, detalle por unidad

No toca procesos, nómina, unidades ya ingresadas, OP cerradas ni WooCommerce.

### 4. Botón admin
En `/core/inventario`, acción "Reparar Woo Variation IDs pendientes": ejecuta el RPC en modo real y muestra un resumen (reparadas / ambiguas / no resueltas / errores). Solo metadata interna.

### 5. Validación de entrada a inventario
Regla explícita en escaneo e inventario:
- producto variable (tiene variantes en catálogo) → exige `woo_product_id` + `woo_variation_id` (resuelto o guardado)
- producto simple → solo `woo_product_id`

## Validación
- `OP-000009-WOO-4077-M-001` (`MF60 M` · Negro/M) debe resolver Woo Variation `4079` y quedar lista para inventario.
- Jogger I Wonder y Cargo Basico Club: variantes con costo propio conservan su Woo Variation ID.
- Guardar un producto en el catálogo no debe cambiar los IDs de sus variantes.
- Typecheck en 0 errores.

## No se toca
WooCommerce remoto, ventas históricas, costos aprobados, OP cerradas, nómina, procesos completados, QR existentes, inventario ya ingresado.
