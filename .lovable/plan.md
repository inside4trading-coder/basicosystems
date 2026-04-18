

## Objetivo

Hacer toda la plataforma responsive (móvil 375px, tablet 768px, desktop 1280px+) sin romper la funcionalidad existente.

## Diagnóstico rápido

Reviso el estado actual de responsividad en los módulos principales.
<lov-tool-use id="toolu_vrtx_0182moWAxfUiYMgr5vxtYE8E" name="code--search_files" integration-id="code" data="{\"query\": \"overflow-x-auto|hidden md:|md:flex|grid-cols-\", \"include_patterns\": \"src/pages/*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017GokHkcQe7qgEoLAzGtzzB" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/AppLayout.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01YVu1QTtXZfDJ5UN9zyCZdr" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/Dashboard.tsx\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012EKct96duY39shC5yp2JBE" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/Pedidos.tsx\", \"lines\": \"1-60\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017FQbukYH9Eqyj4ATJMhUNH" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/pages/*.tsx,src/components/**/*.tsx\", \"query\": \"grid-cols-|md:|lg:|overflow-x\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013baNhnEDvzirUEjBneoCLx" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/Dashboard.tsx\"}">
</lov-tool-use>
I have enough context. Many pages already use responsive grids and `hidden md:` patterns, but headers, action bars, and some tables/sheets need polish. Let me present a focused plan.

<lov-plan>

## Objetivo

Hacer que toda la plataforma sea **responsive** (mobile, tablet, desktop) sin romper el diseño desktop actual. Foco en los puntos donde hoy se rompe en pantallas <768px.

## Diagnóstico rápido

Lo que **ya** funciona:
- KPI grids (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`) en Dashboard, Admin, RRPP.
- Tablas con `hidden md:table-cell` en Pedidos, CRM, Llamadas.
- Sidebar colapsable (`SidebarProvider`).

Lo que **se rompe en móvil/tablet** (verificado en código):
- **Headers de página**: usan `flex items-center justify-between` sin wrap → botones se desbordan (Dashboard, CRM, Pedidos, Crew, RRPP, Administración, Campaigns, Configuración).
- **Barras de filtros y toggles** sin `overflow-x-auto` ni wrap (Administración, Campaigns, CrewProfile, RRPPProfile).
- **Sheets / Dialogs** (`AddEmployeeSheet`, `AddContactSheet`, `CreateObligationSheet`, `NewInstanceSheet`, `MarkPaidDialog`): grids fijos `grid-cols-2` que aplastan inputs en <380px.
- **Tabs** en perfiles (Crew, RRPP, AdminObligationDetail) sin scroll horizontal → se cortan.
- **Padding del main** (`p-6` en `AppLayout`) demasiado grande en móvil.
- **AppLayout header**: título "Basico Systems" puede empujar el trigger en pantallas muy estrechas (OK pero verificar).
- **Tablas en perfiles** (audit logs, salary history) sin wrapper `overflow-x-auto`.
- **Charts de Recharts**: ya usan `ResponsiveContainer` ✓, pero el row de "Métodos de pago" usa `flex gap-6` con `width="50%"` fijo → se rompe en móvil.

## Cambios propuestos

### 1. `AppLayout.tsx` — padding y header responsive
- `p-6` → `p-4 md:p-6`
- Header: dejar título oculto en `<sm` o reducir tamaño.

### 2. Patrón unificado para headers de página
En cada página principal, cambiar:
```
flex items-center justify-between
```
por
```
flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3
```
Y los grupos de acciones a `flex flex-wrap items-center gap-2`.

Páginas afectadas:
- Dashboard, Pedidos, CRM, Crew, CrewIncidencias, CrewProfile, RRPP, RRPPProfile, Administración, AdminObligationDetail, Campaigns, CampaignDetail, CampaignWizard, Llamadas, Configuracion, Planning (ya parcial).

### 3. Barras de filtros / toggles
Aplicar `flex-wrap` o envolver en `overflow-x-auto -mx-4 px-4` con `whitespace-nowrap` en chips:
- `AdminListFilters`, `Administracion` (toggle calendar/lista + month nav), `Campaigns` (filtros de estado), `CrewProfile`/`RRPPProfile` (TabsList), `CampaignWizard` (stepper).

### 4. Sheets / Dialogs
- En `AddEmployeeSheet`, `AddContactSheet`, `CreateObligationSheet`, `NewInstanceSheet`, `MarkPaidDialog`, `CrewSalaryHistory`:
  - Cambiar `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`.
- Asegurar `Sheet` content con `w-full sm:max-w-lg` (verificar default).
- Dialogs con `max-w-[calc(100vw-2rem)]`.

### 5. Tabs en perfiles
`TabsList` con `flex w-full overflow-x-auto justify-start` y `TabsTrigger` con `whitespace-nowrap shrink-0`.

### 6. Tablas internas (no las de listas principales)
Envolver tablas de `CrewSalaryHistory`, `CrewAuditLog`, `CrewIncidents`, `RRPPCollaborations`, `RRPPInteractions`, `RRPPAuditTrail`, `AdminObligationDetail` (instancias) en:
```
<div className="overflow-x-auto -mx-4 sm:mx-0">…</div>
```

### 7. Dashboard "Métodos de pago"
`flex items-center gap-6` → `flex flex-col md:flex-row md:items-center gap-4`. PieChart container: `w-full md:w-1/2`.

### 8. Sidebar en mobile
Verificar que `SidebarTrigger` abra el sidebar como overlay en móvil (`Sidebar` de shadcn ya lo hace por default con `collapsible="icon"` + `useIsMobile`). Confirmar que en mobile use variant `offcanvas` automáticamente — si no, ajustar.

### 9. Tipografía y spacing
- Títulos `text-2xl` → `text-xl sm:text-2xl` en headers de página principales para evitar wrap raro.
- `space-y-6` → `space-y-4 md:space-y-6` en contenedores raíz de páginas.

## Alcance / Fuera de alcance

**Incluido**: Todas las páginas del menú + sheets/dialogs/tabs internos.
**Fuera**: Login (revisar pero ya simple), 404, edición profunda de gráficas (solo el caso de Métodos de pago que sí rompe).

## Estrategia de validación

Tras los cambios, el usuario verifica con el toggle phone/tablet/desktop sobre el preview en estas rutas críticas: `/dashboard`, `/pedidos`, `/crm`, `/crew/:id`, `/rrpp/:id`, `/administracion`, `/configuracion`, `/campaigns/wizard`. Si algo se ve mal en móvil, se ajusta puntualmente.

## Archivos estimados a tocar

~25 archivos (1 layout + 12 páginas + 10–12 componentes de sheets/tabs/listas internas). Sin cambios de lógica ni de datos — solo clases Tailwind.

