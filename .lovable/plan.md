## Nuevo módulo: Sublime / Fichaje

Solo estructura visual. Sin cambios en DB ni en módulos existentes. Sin lógica de fichaje real (todo placeholder/empty state).

### Rutas nuevas

- `/sublime/fichaje` — vista pública, fuera de `AppLayout` y de `ProtectedRoute` (link independiente, accesible sin sesión, mobile-first).
- `/sublime/admin/fichaje` — vista administrativa, dentro de `AppLayout` + `ProtectedRoute`, agrupada bajo "Sublime" en el sidebar.

### Archivos a crear

```
src/pages/SublimeFichajePublico.tsx     # vista pública
src/pages/SublimeAdminFichaje.tsx       # vista admin
src/components/sublime/FichajeClock.tsx # reloj grande + botones Entrada/Salida (UI)
src/components/sublime/FichajeIdentify.tsx # input código/PIN empleado (UI)
src/components/sublime/AdminMetricCard.tsx # KPI card reutilizable
```

### Vista pública `/sublime/fichaje`

- Layout vertical centrado, fondo oscuro premium (gradiente sutil + acentos rojos `#E3001B`), pensado para tablet/móvil de tienda.
- Header mínimo: logo "Sublime" + reloj en vivo (HH:MM:SS, fecha larga en español).
- Card central:
  - Estado inicial: input grande para código de empleado / PIN (placeholder, sin lógica).
  - Tras "identificarse" (mock con state local): muestra nombre, foto placeholder, y dos botones grandes: **Entrada** (verde) y **Salida** (rojo).
  - Empty state cuando nadie está identificado: "Introduce tu código para fichar".
- Footer: "Sublime · Control de presencia".
- Sin sidebar, sin nav. Pensado para pantalla dedicada.

### Vista admin `/sublime/admin/fichaje`

Estructura tipo hub (igual patrón que `Crew`):
- Header con título "Sublime · Fichaje", subtítulo y botón "Vista pública" (link a `/sublime/fichaje`, abre en pestaña nueva).
- Tabs: **Asistencia hoy**, **Horarios**, **Incidencias**, **Métricas**.
- Cada tab muestra empty state limpio con icono Lucide + texto explicativo + CTA deshabilitado:
  - Asistencia hoy: tabla vacía con columnas (Empleado, Entrada, Salida, Horas, Estado). Empty: "Aún no hay fichajes registrados hoy".
  - Horarios: grid semanal vacía. Empty: "Configura los horarios del equipo".
  - Incidencias: lista vacía. Empty: "Sin incidencias pendientes".
  - Métricas: 4 `AdminMetricCard` con valores en `—` (Horas totales semana, Puntualidad, Ausencias, Horas extra).

### Sidebar

Añadir un único item nuevo en `mainItems` de `AppSidebar.tsx`:
```
{ title: "Sublime", url: "/sublime/admin/fichaje", icon: Store }
```
Icono `Store` de lucide. No se crean grupos colapsables nuevos (mantiene el patrón actual). El módulo se mostrará bajo "CRM" al final.

### Permisos

- Añadir `/sublime` al array de rutas del rol `admin` en `DEFAULT_ROLE_ROUTES` (`useAuth.tsx`). Otros roles no lo verán hasta que el usuario lo configure en Configuración.
- La ruta pública `/sublime/fichaje` se monta fuera de `ProtectedRoute` (igual patrón que `/crew/incidencias`).

### Diseño

- Tokens HSL existentes (`--primary` rojo, `--background`, `--card`, `--muted`).
- Cards con `rounded-2xl`, `shadow-lg`, espaciado generoso.
- Tipografía Inter (ya activa). Display grande para reloj (`text-7xl font-black tabular-nums`).
- Mobile-first: público usa `min-h-dvh`, paddings amplios, botones `h-16` táctiles.
- Sin animaciones complejas, transiciones sutiles (`transition-colors`).

### Lo que NO se toca

- DB, edge functions, tipos generados.
- Otros módulos (Crew, Pedidos, etc.).
- `useAuth` salvo añadir `/sublime` al rol admin (1 línea).
- Configuración de roles en runtime (admin podrá habilitar `/sublime` para otros roles desde la UI existente de Configuración, sin cambios).
