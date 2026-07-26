## Patch mínimo — Soporte de variantes talla + color en CoreProductEditor

Un solo archivo: `src/pages/core/CoreProductEditor.tsx`. Sin migraciones, sin edge functions, sin backend.

### Cambios

1. **Tipo `Variant`** (líneas 18–31): añadir `color?: string | null` y `normalized_color?: string | null`. Agregar helper local `normVar(s)` que hace trim + strip acentos + upper.

2. **Import Woo → merge** (líneas 294–320):
   - Cambiar la clave de dedupe de `size.toUpperCase()` a `${normVar(size)}|${normVar(color)}`.
   - Incluir `color: v.color ?? null` y `normalized_color: v.normalized_color ?? normVar(v.color) ?? null` en el payload.
   - Actualizar el índice `byVarId`/`byKey` en consecuencia.

3. **Validación de duplicados en `handleSave`** (líneas 343–345):
   ```ts
   const keys = variants
     .filter(v => v.size.trim() || (v.color ?? "").trim())
     .map(v => `${normVar(v.size)}|${normVar(v.color)}`);
   if (new Set(keys).size !== keys.length) return toast.error("Hay variantes duplicadas (misma talla y color)");
   ```
   Sigue funcionando para productos solo-talla (color vacío en todas: la clave `SIZE|` sigue siendo única entre tallas distintas).

4. **Tabla UI** (líneas 630–666):
   - Añadir `<TableHead>Color</TableHead>` justo después de "Etiqueta".
   - Añadir `<TableCell><Input value={v.color ?? ""} onChange={e => updateVariant(i, { color: e.target.value, normalized_color: normVar(e.target.value) })} className="w-24" /></TableCell>`.
   - Ajustar el `colSpan={8}` a `colSpan={9}` en la fila vacía.

5. **Insert al guardar** (líneas 450–464): añadir `color: v.color?.trim() || null` y `normalized_color: normVar(v.color) || null` al objeto insertado.

6. **Carga al editar** (línea 163): `setVariants((vs as any) ?? [])` ya trae `color`/`normalized_color` porque el select es `*`. Sin cambios.

7. **Texto de ayuda** (línea 670): "No se permiten variantes duplicadas (misma talla y color) dentro del mismo producto."

### Fuera de alcance

Backend, RLS, migraciones, edge functions, WooCommerce, costos, inventario, OP, SKU, plantillas.

### Validación

- Tank Top Men Basics Plain: 8 variantes (S/M/L/XL × Blanco/Negro) deben guardar sin error.
- Producto solo-talla existente: sigue funcionando (todas con color vacío → sigue detectando repetición de talla).
- Typecheck posterior a la edición.

### Respuesta final

Al terminar reportaré los 10 puntos del checklist del usuario.
