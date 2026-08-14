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

- `core_products`: id, name, product_type, woo_product_id.
- `core_product_variants`: id, core_product_id (así se llama la columna), size, color, variant_sku, woo_variation_id, cost_structure_id, uses_parent_cost_structure, cost_override_enabled, variant_unit_cost_usd.

Agrupación en memoria por producto padre: clave `woo_product_id` si existe, si no el id del producto Core; si una estructura no es vinculable a producto, se muestra como estructura suelta.

### 2. Filas del listado

- Una fila padre por producto, con flecha para expandir/contraer: nombre, tipo, Woo product ID, costo base, moneda, margen, estado, actualización, contador "12 variantes" y las acciones actuales (ver, editar, duplicar, activar/desactivar, eliminar). Se usa la estructura con `variant_id` nulo; si no existe, una fila derivada del producto Core sólo para presentación.
- Al expandir se muestran TODAS las variantes del producto, tengan o no estructura propia, con sangría y fondo suave. Columnas: nombre de variante (`Producto — Color / Talla`), color, talla, SKU variante, Woo variation ID, modo de costo, costo unitario, estado y acciones.

Las estructuras de variante ya no se pintan como filas de primer nivel: pasan a ser filas hijas de su producto, así que no quedan productos duplicados en el listado.

Estados de variante (badges) calculados en el cliente:

- Hereda base (gris): `uses_parent_cost_structure = true` o sin estructura propia habiendo base → costo = `total_unit_cost` de la estructura padre.
- Personalizada (rojo suave): `cost_structure_id` propio distinto del padre → costo = `total_unit_cost` de esa estructura.
- Override manual (ámbar): `cost_override_enabled = true` → costo = `variant_unit_cost_usd`.
- Sin estructura (advertencia): sin estructura propia ni base usable → costo vacío con icono de alerta.

### 3. Buscador y filtros

El buscador coincide con nombre de producto, nombre de variante, SKU padre, SKU variante, color, talla, Woo product ID y Woo variation ID. Si la coincidencia es de una variante, el grupo padre se muestra ya expandido. Los filtros de estado, tipo, moneda y Woo siguen aplicándose sobre el padre.


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
