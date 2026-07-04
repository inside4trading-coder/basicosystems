
# Costos por variante en Estructuras de Costos (modo avanzado opcional)

## Principio rector
El flujo actual (una estructura por producto padre, todas las variantes heredan) queda **exactamente igual**. Todo lo nuevo vive detrás de un checkbox apagado por defecto. Cero cambios en WooCommerce, POS, España, Blanks/DTF, QR, nómina o histórico.

## 1. Base de datos (una sola migración aditiva)

### `core_product_variants` — añadir columnas
- `cost_structure_id uuid NULL` → FK a `core_cost_structures(id)` (estructura propia de la variante)
- `uses_parent_cost_structure boolean NOT NULL DEFAULT true`
- `cost_override_enabled boolean NOT NULL DEFAULT false`
- `variant_unit_cost_usd numeric NULL` (costo resuelto en override, cache)
- `cost_updated_at timestamptz NULL`
- `color text NULL`, `normalized_color text NULL`, `woo_attributes jsonb NULL` (si no existen ya — reutilizar `size`, `variant_label`, `woo_variation_id`, `variant_sku` que ya existen)

Todas nullables → registros existentes quedan intactos con `uses_parent_cost_structure = true`.

### `core_cost_structures` — añadir columna
- `variant_id uuid NULL REFERENCES core_product_variants(id)`  
  - `NULL` = estructura base del producto (comportamiento actual)
  - Con valor = estructura propia de esa variante

Se elige esta opción sobre una tabla puente porque mantiene toda la lógica de `core_cost_structure_items` intacta (siguen atados a `cost_structure_id`).

### Helper SQL
`public.resolve_core_variant_unit_cost(p_product_id uuid, p_variant_id uuid)` returns numeric:
1. Si variante tiene `cost_override_enabled=true` y `cost_structure_id` con estructura activa → suma sus items.
2. Si no → costo de estructura base del producto (`variant_id IS NULL`).
3. Si no → `core_products.unit_cost`.
4. Si nada → 0.

## 2. Normalización (frontend)

`src/lib/coreNormalize.ts`:
- `normalizeSize(label)` — ya existe algo en `espMaterials.ts`, replicar para core.
- `normalizeColor(label)` — trim, uppercase, quitar acentos, colapsar espacios.

## 3. Edge function `core-woo-import-variants`

Ya existe y ya detecta atributos. Ajustes mínimos:
- Guardar también `color`, `normalized_color`, `woo_attributes` (raw).
- No tocar lógica existente de tallas.
- Sigue siendo solo-lectura contra Woo.

## 4. UI — `CoreCostStructureEditor.tsx`

Solo en modo "nueva/editar" con Woo Product ID vinculado:

### Checkbox
Debajo del bloque de conexión WooCommerce:
```
[ ] Este producto tiene costos diferentes por variante/color/talla
    Activa solo si algunas variantes consumen materias primas distintas.
```
Estado guardado en la estructura base (nuevo campo `has_variant_overrides boolean` en `core_cost_structures`, o derivado de existencia de variantes con override — usaremos derivado para no añadir más columnas).

### Panel colapsable "Costos por variante" (solo si checkbox ON)
- Botón **"Sincronizar variantes Woo"** → llama edge function existente con `apply: true`.
- Matriz con columnas: Woo variation ID · SKU · Talla · Color · Precio Woo (readonly) · Modo costo (select: `Heredar base` / `Personalizar`) · Costo unitario · Acciones.
- Acciones por fila: **Editar costos** (abre sheet), **Copiar desde base**, **Copiar desde otra variante**, **Resetear a heredar**.
- Por defecto todas en "Heredar base".

### Sheet "Editar costos de variante"
Reutiliza el mismo componente de secciones que la estructura base (Materia prima, Mano de obra, Procesos técnicos, Costos variables, Logística, Empaque, Otros). Al guardar:
- Crea/actualiza una `core_cost_structures` con `variant_id` seteado.
- Marca la variante: `cost_override_enabled=true`, `uses_parent_cost_structure=false`, `cost_structure_id=<nueva>`.
- Recalcula `variant_unit_cost_usd`.

"Copiar desde base": prellena items desde la base pero la variante sigue en "Heredar" hasta que el usuario guarde.

## 5. Catálogo `/core/productos`

En fila del producto padre:
- Si todas heredan → `Costo: X.XX USD`
- Si hay overrides → `Costo: min–max USD` con badge "variantes con costo propio: N".

En expandido, columnas: Talla · Color · SKU · Woo variation ID · Modo (Hereda base / Costo propio) · Costo unitario · acciones (Editar / Copiar base / Resetear).

## 6. Resolución de costo en producción / partidas / necesidades

Sustituir lecturas actuales de `core_products.unit_cost` (cuando hay `variant_id` disponible) por una llamada al RPC `resolve_core_variant_unit_cost(product_id, variant_id)` en:
- `core-create-production-order`
- `core-generate-production-units`
- `core-process-fabrication-funds` (solo en cálculos de costo nuevo)

**No se reprocesa histórico**: solo aplica a nuevos cálculos. OPs, QR, nómina y snapshots existentes intactos.

## 7. Seguridad y auditoría

- Toda escritura protegida: `admin` o `manager` (RLS ya cubierta por políticas existentes de `core_*`).
- Registrar en `core_audit_logs` cada cambio de modo/costo por variante (acción `variant_cost_override`, `variant_cost_reset`).

## 8. Fuera de alcance (explícito)
- Carga masiva de costos por variante (solo se deja preparado el esquema).
- Overrides parciales de líneas dentro de una estructura heredada — implementamos opciones A/B (hereda completa **o** estructura propia completa) más el botón "copiar desde base" para no reescribir manualmente.
- Cualquier escritura a WooCommerce.

## 9. Validación con Woo Product 18007
1. Abrir estructura, ingresar 18007, aplicar → 12 variaciones detectadas por la edge function.
2. Checkbox off → guarda como siempre, todas heredan.
3. Checkbox on → panel muestra 12 filas con talla y color, todas "Heredar base".
4. Cambiar M/Negro a "Personalizar", editar materia prima, guardar → esa variante muestra costo propio; las otras 11 siguen heredando.
5. Catálogo muestra rango de costos si hay overrides.

## 10. Orden de ejecución
1. Migración SQL (columnas + RPC + grants ya cubiertos).
2. Regenerar tipos.
3. Edge function: añadir color/normalized_color/woo_attributes.
4. `src/lib/coreNormalize.ts`.
5. UI: checkbox + panel + matriz + sheet en `CoreCostStructureEditor.tsx`.
6. UI: catálogo `/core/productos` (rango + badges + acciones en expandido).
7. Reemplazar lecturas de costo por RPC en las 3 edge functions listadas.
8. Auditoría.

## Respuesta al cuestionario del brief (post-implementación esperada)
Todos los ítems del checklist final del usuario se cumplirán: checkbox off por defecto, flujo normal intacto, panel colapsable presente, 12 variaciones detectadas para 18007, herencia por defecto, personalización por variante con las 7 secciones, cálculo por variante solo en override, catálogo con rango, resolución con fallback al padre, Woo no tocado, sin romper estructuras existentes.
