# Fix: costo resuelto 0.00 / zero_fallback en Catálogo de Fabricación

## Qué está pasando (verificado en base de datos)

Con CORE000006 / MF193 (Franela Oversized BASICO Surf Wave Blanca) confirmé:

- El producto **sí guarda bien** el costo: `unit_cost = 6.68`, `cost_structure_id` apuntando a la estructura activa, snapshot presente. El botón "Actualizar snapshot" y "Guardar" están persistiendo correctamente.
- La estructura asociada está activa, `woo_product_id = 34609`, suma de líneas = 6.68.
- El problema real está en la función que calcula el "Costo resuelto" del catálogo: `resolve_core_variant_unit_cost_with_source` **falla con error** al ejecutarse:

```text
ERROR 42702: column reference "unit_cost" is ambiguous
  SELECT woo_product_id, unit_cost FROM public.core_products WHERE id = p_product_id
```

El parámetro de salida de la función se llama `unit_cost` y choca con la columna `unit_cost` de `core_products`. La función lanza error, el frontend no recibe fila y aplica su valor por defecto: `0.00` con fuente `zero_fallback`. Por eso siempre se ve 0.00 aunque el costo esté bien guardado.

## Correcciones

### 1. Arreglar la función de resolución con fuente

Reescribir `resolve_core_variant_unit_cost_with_source` calificando las columnas (`p.unit_cost`, `p.woo_product_id`) para eliminar la ambigüedad, y mejorar la prioridad de fuentes:

1. Variante con override activo y estructura propia → `variant_override`
2. Variante con override activo y `variant_unit_cost_usd` > 0 → `variant_manual`
3. Estructura base del producto (por `cost_structure_id` del producto, y si no, por `woo_product_id`) con suma > 0 → `product_base`
4. `manual_unit_cost_usd` del producto > 0 → `product_manual`
5. `unit_cost` del producto > 0 → `product_unit_cost`
6. `zero_fallback` solo si no hay ninguna fuente válida

Hoy la búsqueda de estructura base ignora `cost_structure_id` del producto y depende solo de `woo_product_id`; agregarlo como prioridad hace que productos sin vínculo Woo también resuelvan bien.

### 2. Alinear la función escalar

Aplicar la misma prioridad en `resolve_core_variant_unit_cost` (usada por el rango de costos del catálogo) para que producto base y variantes muestren el mismo número.

### 3. Frontend: refrescar desde la base tras guardar

- En el editor de producto, tras "Guardar" en la pestaña Costos, recargar el producto y sus variantes desde la base (no confiar en el estado local) y mostrar el toast: "Costos guardados y variantes heredadas recalculadas."
- En el catálogo, al volver o al expandir, se recalcula con la función corregida; además mostrar un error visible si la RPC falla, en vez de degradar silenciosamente a `zero_fallback`.

## Validación

Con CORE000006 / MF193: producto base 6.68 USD y XL/L/M/S en 6.68 USD con fuente `product_base` (Hereda base), ninguna en `zero_fallback`. Se ejecutará la consulta de comprobación en base y typecheck.

## Alcance

Solo dos funciones de resolución de costos y el refresco de UI en catálogo/editor. No se tocan WooCommerce remoto, ventas, partidas, órdenes de producción, nómina, inventario ni QR.
