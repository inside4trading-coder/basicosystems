## Conectar Sublime · Fichaje con Crew

### Esquema de DB (migración nueva)

**Tabla `sublime_stores`** — tiendas físicas (catálogo).
- `name` text not null
- `address` text
- `active` boolean default true

**Tabla `sublime_clock_settings`** — config de fichaje por empleado (1:1 con `employees.id`).
- `employee_id` uuid PK references employees
- `enabled` boolean default false
- `store_id` uuid references sublime_stores
- `weekly_schedule` jsonb default `{}` — `{ mon:true, tue:true, ... }`
- `entry_time` time
- `exit_time` time
- `break_start` time
- `break_end` time
- `break_minutes` int default 60
- `late_tolerance_minutes` int default 10
- `pin_hash` text — hash del PIN (nullable; null = sin PIN aún)
- `pin_set_at` timestamptz
- `blocked` boolean default false
- `created_at` / `updated_at` timestamptz

**Tabla `sublime_clock_events`** — fichajes individuales (registro append-only).
- `id` uuid PK
- `employee_id` uuid references employees
- `store_id` uuid
- `event_type` text — `entrada` | `salida` | `inicio_descanso` | `fin_descanso`
- `event_at` timestamptz default now()
- `source` text default `pin` — `pin` | `manual` | `admin`
- `notes` text

RLS:
- `sublime_stores`: admin/manager all; authenticated read.
- `sublime_clock_settings`: admin all; manager read.
- `sublime_clock_events`: admin all; manager read; insert también vía edge function (service role) para la vista pública.

Índices: `(employee_id, event_at desc)` en eventos.

### Estado actual del empleado (derivado en frontend)

Función pura `computeCurrentStatus(settings, events, now)` que devuelve uno de:
`fuera_de_jornada` | `trabajando` | `en_descanso` | `jornada_completada` | `pendiente_revision` | `fichaje_bloqueado`

Reglas:
- Si `blocked` → `fichaje_bloqueado`.
- Sin entrada hoy y dentro de horario → `fuera_de_jornada`.
- Última event = `entrada` o `fin_descanso` → `trabajando`.
- Última = `inicio_descanso` → `en_descanso`.
- Última = `salida` → `jornada_completada`.
- Inconsistencia (p.ej. dos entradas seguidas, o salida sin entrada) → `pendiente_revision`.

### Nueva sección "Fichaje" en CrewProfile

Archivo nuevo: `src/components/crew/CrewSublimeClock.tsx`. Tab nuevo `clock` en `CrewProfile.tsx` (después de "Documentos"). No se toca ningún tab existente.

Contenido del tab:
1. **Estado actual** — badge grande con el estado derivado + último fichaje (`event_type` + hora) + botón "Ver historial" (placeholder por ahora).
2. **Configuración** (form, edit en sitio, guarda en `sublime_clock_settings` con upsert):
   - Switch "Fichaje habilitado" (`enabled`)
   - Select "Tienda asignada" (de `sublime_stores`)
   - Grid 7 checkboxes "Horario semanal" (L-D)
   - Inputs hora: entrada, salida, inicio descanso, fin descanso
   - Number: duración descanso (min), tolerancia (min)
   - Estado del PIN: badge "Sin PIN" / "Configurado" + botón "Generar PIN" (genera 4 dígitos, guarda hash, muestra una vez)
   - Botón "Bloquear/Desbloquear fichaje"
3. Validación zod del form. Solo admin puede editar; manager solo lee.

### Filtro de elegibilidad para fichar

Nueva utilidad `canEmployeeClockIn(employee, settings)` aplicada en la vista pública `/sublime/fichaje` y en la admin. Requisitos (todos):
- `employee.status === "active"`
- `settings.enabled === true`
- `settings.store_id != null`
- `settings.weekly_schedule` con al menos 1 día activo
- `settings.entry_time && settings.exit_time`
- `!settings.blocked`

### Vista pública `/sublime/fichaje`

Reescribir lógica (UI ya existe). Flujo:
1. Pantalla pide PIN (4 dígitos).
2. Edge function `sublime-clock-resolve-pin` busca empleado por hash de PIN, valida elegibilidad, devuelve `{ employee, settings, lastEvent, currentStatus }`.
3. Pantalla muestra nombre + estado + botones contextuales:
   - `fuera_de_jornada` → Entrada
   - `trabajando` → Salida + Iniciar descanso
   - `en_descanso` → Fin de descanso
   - `jornada_completada` → mensaje cerrado
   - `pendiente_revision` / `fichaje_bloqueado` → solo aviso
4. Al pulsar acción, edge function `sublime-clock-record` inserta evento.

Edge functions con `verify_jwt = false` (kiosk público), CORS abierto, validación zod del PIN/acción, rate-limit simple por IP.

### Vista admin `/sublime/admin/fichaje`

Reemplazar empty states por datos reales:
- **Asistencia hoy**: lista empleados elegibles con su estado actual + últimos eventos del día (consulta `sublime_clock_events` por fecha actual).
- **Horarios**: lista compacta empleados elegibles con su `weekly_schedule` y horas.
- **Incidencias**: lista de empleados en `pendiente_revision` o llegadas tarde (entrada > entry_time + tolerance).
- **Métricas**: KPIs reales (horas semana, puntualidad, ausencias, horas extra) con cálculos sobre `sublime_clock_events`.

### Sidebar / rutas

Sin cambios (ya están).

### No se toca

- Ningún campo ni componente existente de Crew.
- Tabla `employees` no se altera (toda la config de fichaje vive en `sublime_clock_settings`).
- Otros módulos.

### Entregables (orden)

1. Migración (tablas + RLS + índices).
2. Tipos + hook `useSublimeClockSettings(employeeId)`.
3. `CrewSublimeClock.tsx` + tab "Fichaje" en `CrewProfile.tsx`.
4. Catálogo mínimo de tiendas (UI: alta inline desde el select "Tienda asignada", solo admin).
5. Helper `computeCurrentStatus` + `canEmployeeClockIn`.
6. Reemplazo de empty states en `SublimeAdminFichaje` por listas reales.
7. Edge functions + rewrite de `SublimeFichajePublico` para usar PIN real.

Plan se entrega para aprobación. La implementación se hará por fases en mensajes posteriores si la lista es muy larga; este turno cubrirá hasta el paso 5 (DB + perfil de empleado + helpers), dejando admin/público para el siguiente turno.
