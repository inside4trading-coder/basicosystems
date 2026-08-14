# Estructuras de Costos: listado agrupado por producto padre + variantes

## Causa (verificada)

El listado principal (`src/pages/core/CoreCostStructures.tsx`) hace una única consulta plana:
`core_cost_structures.select("*")` ordenada por `updated_at`. No cruza con `core_products` ni con `core_product_variants`.

Consecuencias comprobadas con el caso Jogger Basico I Wonder +3 Colores (Woo 6553):

- El producto tiene 12 variantes en `core_product_variants` (Beige/Marrón/Negro × S,M,L,XL).
- En `core_cost_structures` existen la estructura base (`variant_id` nulo) y estructuras por variante (`variant_id` no nulo), pero no una por cada variante y con el mismo nombre repetido.
- Como el listado sólo pinta filas de `core_cost_structures`, las variantes que no tienen fila propia no aparecen, y las que sí la tienen aparecen como filas sueltas duplicando el nombre del producto.

Es decir: el listado no oculta datos por un filtro, simplemente no consulta las variantes.

## Qué se va a construir

### 1. Carga de datos

En el `load()` del listado, además de `core_cost_structures`, traer:

- `core_products` (id, nombre, woo_product_id) para resolver el padre.
- `core_product_variants` (id, size, color, variant_sku, woo_variation_id, cost_structure_id, uses_parent_cost_structure, cost_override_enabled, variant_unit_cost_usd).

Agrupación en memoria por producto padre usando `woo_product_id` como clave principal; si una estructura no tiene `woo_product_id`, se agrupa por su propio `id` (grupo suelto, sin variantes).

### 2. Filas del listado

- Una fila por producto padre: la estructura con `variant_id` nulo (o, si no existe, una fila sintética sólo de presentación derivada del producto Core). Muestra nombre, tipo, Woo ID, costo base, moneda, margen, estado, actualización y el contador `N variantes`.
- Fila expandible con las variantes del producto: color, talla, SKU variante, Woo padre, Woo variation ID, modo de costo, costo unitario resuelto y estado.

Estados de variante calculados en el cliente:

- Personalizada: tiene `cost_structure_id` propio distinto de la base.
- Override manual: `cost_override_enabled` con costo propio y sin estructura propia.
- Hereda estructura base: `uses_parent_cost_structure` o sin costo propio, existiendo estructura base → muestra el costo de la base.
- Sin estructura: no hay estructura base ni costo propio.

Las estructuras de variante ya no se pintan como filas de primer nivel: pasan a ser filas hijas de su producto.

### 3. Buscador y filtros

El buscador pasa a coincidir (grupo visible si el padre o cualquiera de sus variantes coincide) con: nombre de producto, SKU padre, SKU variante, talla, color, Woo product ID y Woo variation ID. Los filtros de estado, tipo, moneda y Woo siguen aplicándose sobre el padre.

### 4. Acciones

- Padre: Ver, Editar estructura base, Duplicar, Activar/Desactivar, Eliminar (se mantienen tal cual están hoy).
- Variante: Editar costo variante / Personalizar → navega a `/core/estructuras-costos/nueva?variant=<id>` (el editor ya soporta modo variante), y Volver a heredar base → limpia `cost_structure_id`, `cost_override_enabled` y pone `uses_parent_cost_structure = true` en esa variante.

### 5. Exportación

El export XLSX actual sigue exportando estructuras existentes; se le añade únicamente la columna de variantes vinculadas, sin cambiar su lógica de líneas.

## Alcance técnico

- Archivo modificado: `src/pages/core/CoreCostStructures.tsx` (más un componente auxiliar de fila expandible si el archivo crece demasiado).
- Sin migraciones, sin cambios en Edge Functions, sin tocar Woo, Partidas, OP, QR, nómina, inventario, movimientos ni resolvers de costo.
- No se crean estructuras automáticamente: las variantes sin estructura sólo se muestran con su etiqueta de estado. La única escritura nueva es la acción explícita "Volver a heredar base" sobre `core_product_variants`.
- Typecheck al final.
