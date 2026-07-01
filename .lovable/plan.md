# Plan: Recetas de Blank + DTF para productos de fabricación ligera

## Objetivo
Permitir definir, para cada producto `made_to_order` de España, **qué DTF lleva** y **qué familia de blank usar** (con el blank exacto resuelto automáticamente según la talla de la variante vendida). Editable desde dos lugares: ficha del producto y módulo Blanks/DTF.

## Modelo de datos

Ajustar el esquema de recetas para soportar "blank por talla":

- `esp_product_material_recipes` (ya existe, a nivel producto):
  - Añadir `dtf_material_id uuid` → apunta al DTF único del producto.
  - Añadir `blank_family` text → familia lógica de blank (ej. `camiseta_basica_negra`).
- `esp_material_items` (blanks):
  - Añadir `blank_family` text y `size` text (normalizada: S, M, L, XL…).
  - Un blank pertenece a una familia + talla; así la receta resuelve `blank_family + variant.size → material_item`.
- `esp_product_material_recipe_items` queda solo para "extras" opcionales (etiqueta, bolsa, hilo). No se usa para el blank principal.

Backfill: para los blanks ya cargados, poblar `blank_family` a partir del nombre/color agrupado actual, y `size` desde su etiqueta actual (ya normalizada en UI).

## RPC de resolución
Actualizar `esp_resolve_fabrication_materials` para que:
1. Lea la receta del producto.
2. Devuelva el DTF (`dtf_material_id`).
3. Busque el blank exacto: `esp_material_items` where `blank_family = receta.blank_family and size = normalize(variant.size)`.
4. Sume los extras del recipe_items.
5. Marque error claro si falta el blank de esa talla ("No hay blank talla XL en familia camiseta_basica_negra").

El preflight y consumo (`esp_consume_materials_for_fabrication_request`) ya usan este resolver, así que heredan el cambio.

## UI — dos accesos

**1. Desde `/espana/productos` (ficha del producto)**
- Nueva sección "Receta de fabricación ligera" visible solo si el producto es `made_to_order`.
- Dos selects:
  - **DTF** (buscador entre materiales tipo `dtf`).
  - **Familia de blank** (lista distinct de `blank_family` con preview de tallas disponibles y stock).
- Tabla pequeña debajo: "Resolución por talla" mostrando cada variante → blank específico → stock actual → ✓ / ⚠ sin blank.
- Botón "Guardar receta".

**2. Desde `/espana/blanks-dtf` → pestaña Recetas**
- Buscador de producto + filtro "solo sin receta".
- Vista lista con: producto, DTF asignado, familia blank, nº variantes sin cobertura.
- Edición inline / diálogo con los mismos campos que la ficha del producto.
- Acción masiva: "Asignar familia de blank a N productos seleccionados".

## Detalles técnicos
- `normalizeSize` (ya en `src/lib/espMaterials.ts`) se reutiliza en el resolver SQL (crear helper `esp_normalize_size(text)` que replique la lógica: quitar "Talla ", trim, upper).
- Nuevo hook `useEspProductRecipe(productId)` con react-query para leer/escribir receta.
- Componente `ProductRecipeCard.tsx` reutilizable en ambos accesos.
- Sin cambios en el flujo de fabricación existente: el botón "Fabricar" seguirá funcionando y ahora encontrará los materiales correctos.

## Fuera de alcance
- Recetas por color/variante fina (queda modelado pero no expuesto en UI aún).
- Importación masiva por CSV de recetas.
