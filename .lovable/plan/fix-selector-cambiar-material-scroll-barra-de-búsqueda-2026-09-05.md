# Fix selector "Cambiar material": scroll + barra de búsqueda

## Problema
En el modal "Fabricar solicitud", el selector "Cambiar material" abre la lista de materiales pero:
1. **El scroll no funciona**: la lista de materiales no se puede desplazar (la ventana modal bloquea los eventos de rueda/táctiles hacia la lista flotante).
2. **La búsqueda no se percibe**: el campo existe pero no es evidente / no recibe foco correctamente dentro del modal.

## Cambios (un solo archivo)

`src/components/espana/MaterialOverridePicker.tsx`:

1. **Scroll funcional**
   - Hacer el `Popover` modal (`modal` prop) para que su contenido entre en la pila de capas del diálogo y acepte interacción/scroll.
   - Garantizar altura máxima + scroll propio en la lista: `CommandList` con `max-h-[260px] overflow-y-auto` explícito.
   - Añadir `onWheel` / `onTouchMove` con `stopPropagation` en la lista, para que el bloqueo de scroll del `Dialog` padre no se trague los gestos.

2. **Barra de búsqueda visible y usable**
   - `CommandInput` con placeholder claro: "Buscar material por nombre, talla, color o SKU…".
   - Icono de lupa (ya lo provee `CommandInput`); auto-focus al abrir el selector.
   - El filtro ya existe (busca en nombre/talla/color/SKU); solo se hace evidente y funcional.

3. **Sin tocar**: lógica de overrides, RPC `p_overrides`, recetas, badges "Material sustituido", ni ningún otro modal.

## Verificación
- `bunx tsc --noEmit -p tsconfig.app.json` sin errores y `bun run build` OK.
- Prueba visual con Playwright: abrir Fabricar solicitud → "Cambiar material" → escribir en la búsqueda filtra, y la lista se desplaza con rueda del ratón.
