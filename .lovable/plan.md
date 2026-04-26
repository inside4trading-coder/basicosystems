## Problema

En la landing (`src/pages/Landing.tsx`), los enlaces del header (`Empezar`, `Módulos`, `Caso`, `Proceso`) y el enlace `Acceso equipo` están ocultos en móvil:

- `div` con enlaces: `hidden md:flex` → invisible bajo 768px
- `Acceso equipo`: `hidden sm:inline` → invisible bajo 640px

En móvil sólo queda visible el botón rojo `Hablemos`, dejando la navegación inaccesible.

## Solución

Añadir un menú hamburguesa que aparezca exclusivamente en móvil/tablet (`<md`), reutilizando el componente `Sheet` de shadcn (ya presente en el proyecto) para abrir un panel lateral con todos los enlaces. En desktop (≥md) se mantiene exactamente la barra horizontal actual — ningún cambio visual.

### Cambios en `src/pages/Landing.tsx`

1. **Imports**: añadir `Menu` (lucide-react) y `Sheet, SheetContent, SheetTrigger, SheetClose` desde `@/components/ui/sheet`. Añadir `useState` para controlar apertura.

2. **Header (líneas 131-149)** — mantener la barra desktop intacta y añadir, junto al botón `Hablemos`:
   - Un `SheetTrigger` con icono `Menu` visible sólo en `<md` (`md:hidden`), tamaño táctil ≥44px.
   - Un `SheetContent` lateral (side="right", width responsive) que liste:
     - Empezar, Módulos, Caso, Proceso (mismos `scrollTo` handlers)
     - Separador
     - Acceso equipo / Panel (Link a `/login`)
     - Botón `Hablemos` (cierra menú + scroll a contacto)
   - Cada enlace cierra el sheet al pulsarse (vía `setOpen(false)` o `SheetClose asChild`).

3. **Eliminar `hidden sm:inline`** del enlace `Acceso equipo` desktop ya no es necesario; quedará dentro del sheet en móvil y dentro de la barra desktop como ahora (se mantiene `hidden md:inline` para coherencia con los demás enlaces desktop).

4. **Accesibilidad / UX**:
   - `aria-label="Abrir menú"` en el trigger.
   - Tipografía consistente (`uppercase tracking-wide font-medium`).
   - Cerrar automáticamente al navegar.

### Breakpoints

- `<768px` (móvil + tablet pequeño): hamburguesa visible, barra horizontal oculta.
- `≥768px`: barra horizontal visible, hamburguesa oculta. Sin cambios respecto al estado actual.

### Archivos modificados

- `src/pages/Landing.tsx` (único cambio)

No se requieren migraciones, edge functions ni nuevas dependencias.
