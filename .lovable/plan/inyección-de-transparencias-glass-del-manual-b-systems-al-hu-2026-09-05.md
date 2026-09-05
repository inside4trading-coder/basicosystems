# Inyección de transparencias (Glass) del manual B Systems al hub

## Hallazgo verificado

- El **manual de marca sí usa transparencias extensamente**: paneles `glass` con `backdrop-filter: blur(20-26px) saturate(170-180%)`, fondos blancos al 10-32% y bordes blancos al 20-35%, tanto sobre fondos oscuros como claros (tarjetas, barras superiores, ventanas apiladas).
- En el hub, la clase `.glass` **existe en `index.css` pero no se usa en ningún componente** (0 referencias fuera del CSS).
- Solo hay transparencias sueltas y sin criterio común en 6 archivos: `Login.tsx`, `FuerzaVenezuela.tsx`, `SublimeFichajePublico.tsx`, `OperatorDashboard.tsx`, `AporteDialog.tsx`, `StudioActionCards.tsx` (mezcla de `backdrop-blur-sm/md/xl` con `bg-white/5..20` y `bg-background/40..95`).
- Las pantallas operativas del hub (dashboards, Core, España) son 100% opacas.

## Alcance del cambio (solo presentación, sin tocar lógica)

### 1. Tokens de vidrio en `index.css`

Definir dos variantes con los valores exactos del manual:

- `.glass-panel` (tema claro, para el hub operativo): `bg-[hsl(var(--card)/0.72)]`, `backdrop-blur(20px) saturate(180%)`, borde `hsl(var(--border)/0.6)`, sombra sutil.
- `.glass-dark` (páginas oscuras ya existentes): `bg-white/10`, `blur(20px)`, borde `white/20` — los valores actuales sueltos se consolidan aquí.

### 2. Aplicación en superficies donde el vidrio aporta jerarquía

- **`BrandWindow`**: barra de título superior con `.glass-panel` (es la pieza insignia del manual: ventana con barra translúcida).
- **Barra lateral y cabecera fija** de `AppSidebar` / `CoreLayout`: fondo translúcido con desenfoque al hacer scroll (el contenido pasa por debajo).
- **Diálogos, popovers y dropdowns** (variante de los componentes `Dialog`, `Popover`, `SelectContent`, `DropdownMenu`): superficie `.glass-panel` en lugar de fondo opaco.
- **Encabezados pegajosos** de tablas/listados largos (`CoreWooCoreMap`, `CoreProductionNeeds`, listados de España) si tienen header sticky: fondo translúcido.

### 3. Consolidación de lo existente

- Reemplazar las transparencias manuales de los 6 archivos detectados por `.glass-panel` / `.glass-dark` según corresponda, para que todo el vidrio del sistema salga de un solo token.

### 4. Verificación

- `bunx tsc --noEmit` + capturas Playwright de: Dashboard (cabecera/sidebar), un diálogo abierto, Mapa Woo con scroll, y Login (tema oscuro).

## Fuera de alcance

- Sin cambios de lógica, rutas, permisos ni base de datos.
- No se toca la landing pública.
- No se aplica vidrio a tarjetas de datos (KPIs, tablas): el manual las mantiene sólidas para legibilidad; el vidrio se reserva a barras, ventanas y capas flotantes.

## Detalle técnico

- Valores tomados del manual: `blur(20px) saturate(180%)`, opacidades 70-80% en claro y 10-14% en oscuro, borde semitransparente + sombra `inset 0 1px 0` de brillo superior.
- Todo en tokens CSS (`hsl(var(--token)/alpha)`), compatible con modo oscuro futuro.
