
## Problema

En "Necesidades → Abiertas" aparece una fila con "-" (sin SKU, nombre de producto ni variante). Es el registro `78ccc659…` creado hace un momento al confirmar un reemplazo.

Causa: la función `core_apply_replacement_event` inserta en `core_production_needs` sólo `core_product_id` y `core_variant_id`, pero deja vacíos `sku`, `product_name`, `variant_label`, `variant_sku` y `size`. La UI de Necesidades lee esos campos denormalizados directamente, por eso muestra "-".

Verificado en BD:
```
sku=∅, product_name=∅, variant_label=∅  ← fila del reemplazo
```
Todas las demás necesidades (creadas por `auto_from_movements`) sí tienen esos campos poblados.

## Fix

Migración que reemplaza `core_apply_replacement_event` con una única modificación: al `INSERT INTO core_production_needs` (y al `UPDATE` de refresco), poblar los campos denormalizados haciendo lookup en `core_products` y `core_product_variants`:

- `sku` ← `core_products.core_sku`
- `product_name` ← `core_products.name`
- `variant_sku` ← `core_product_variants.variant_sku`
- `variant_label` ← `core_product_variants.variant_label`
- `size` ← `core_product_variants.size`

También backfill de la fila ya creada (`78ccc659-5ea1-47ce-9f04-46881b3b9e63`) con los mismos lookups, para que deje de mostrarse como "-".

Sin cambios de UI ni de otras funciones.
