## Causa raíz

Las dos partidas de CAN0001 (M y XL) **sí se generaron** en `core_fabrication_fund_movements`, pero quedaron con `core_variant_id = NULL`.

Datos verificados en BD:

- Producto Core `1bb588d0…` (Basico T-Shirt Canserbero) solo tiene **1 variante** en `core_product_variants`: la **L** (woo_variation_id 32302).
- Las variantes **M (32301)** y **XL (32303)** existen en WooCommerce pero **no fueron creadas como Core variants**.
- Movimientos afectados:
  - `CAN0001 M` (#32802) → woo_variation_id 32301 → core_variant_id = NULL
  - `CAN0001 XL` (#32803) → woo_variation_id 32303 → core_variant_id = NULL

`core-process-fabrication-funds` encontró el **producto** (por SKU / woo_product_id) y posteó el movimiento igual, pero sin variante. Luego `core-generate-production-needs` filtra explícitamente:

```ts
if (!m.core_variant_id || !m.core_product_id) { skipReason("missing_core_ids"); continue; }
```

Por eso JGM43 L/XL sí entraron como necesidades (tienen core_variant_id) y los dos CAN0001 fueron silenciosamente descartados, sin aparecer en pendientes tampoco (porque el producto fue resuelto).

CAN0001 L (#32782) no aparece como necesidad porque ya fue absorbida por OP-000001 — correcto.

## Plan

### 1. Backfill de variantes CAN0001 M y XL (data fix puntual)

Migración para:

- Insertar las dos variantes faltantes en `core_product_variants` clonando los campos canónicos de la variante L existente (mismo `core_product_id`, status, etc.), con:
  - M → size `M`, variant_label `M`, variant_sku `CAN0001-M`, woo_sku `CAN0001 M`, woo_variation_id 32301
  - XL → size `XL`, variant_label `XL`, variant_sku `CAN0001-XL`, woo_sku `CAN0001 XL`, woo_variation_id 32303
- Actualizar los dos movimientos existentes (`CAN0001 M` y `CAN0001 XL`) para setearles el `core_variant_id` recién creado.
- No tocar costos, stock, ni WooCommerce.

### 2. Volver a correr generación de necesidades

Después del backfill, ejecutar **"Generar necesidades"** (botón existente) y validar que aparezcan:

- CAN0001 M × 1 (pedido #32802)
- CAN0001 XL × 1 (pedido #32803)

Sin tocar las necesidades ya generadas de JGM43.

### 3. Prevención (cambio mínimo en `core-process-fabrication-funds`)

Para que esto no se repita silenciosamente cuando un producto Core existe pero la variante Woo no está mapeada: cuando `product` se resuelve pero `variant` queda `null` y hay `wooVarId`, encolar un pendiente `variation_not_mapped` además de postear el movimiento (o, alternativamente, **no** postear el movimiento y solo crear el pendiente — preferible para mantener "no fund sin variant" y forzar mapeo).

Propuesta: **encolar pendiente `variation_not_mapped` y NO crear el movimiento** cuando product existe + wooVarId presente + variant null. Esto evita movimientos huérfanos sin variante que luego se pierden en la generación de necesidades.

### Archivos a tocar

- Nueva migración SQL: insert de 2 variantes + update de 2 movimientos por id.
- `supabase/functions/core-process-fabrication-funds/index.ts`: rama "producto sí, variante no" → encolar pending `variation_not_mapped` en lugar de postear movimiento sin variante (líneas ~237-275).

### Fuera de alcance

- No tocar OP-000001 ni CAN0001 L (#32782).
- No tocar costos, inventario, ni WooCommerce.
- No cambiar lógica de filtrado del generador de necesidades.
