## Cambios en "Tareas recurrentes"

### 1. Zona horaria fija a Caracas (America/Caracas)

Hoy todo se calcula con la hora local del navegador. Lo cambio para que **siempre** se use la hora de Caracas, sin importar dónde esté el usuario.

- Helper interno `caracasParts(date)` que usa `Intl.DateTimeFormat` con `timeZone: "America/Caracas"` para obtener año/mes/día/hora/minuto/día-de-semana en hora venezolana.
- `taskHappensOn` recibe esos parts en vez de un `Date` local (afecta lunes/martes/etc. en frecuencia semanal y día del mes en mensual).
- `minutesUntil` se calcula como `(hora_tarea − hora_actual_caracas)` en minutos.
- Header muestra fecha y hora con `timeZone: "America/Caracas"` y un sufijo `(Caracas)` para que quede explícito.
- Las horas guardadas en `task.time` (`"HH:MM"`) se interpretan como hora local de Caracas — que es como ya las introduce el usuario.

### 2. Sin duplicados entre buckets

Las cuatro bandas son disjuntas y excluyentes:
- Próxima hora: 0–60 min
- Próximas 3 h: 61–180 min
- Resto del día: > 180 min
- Sin horario / Ya pasaron: como hoy

(La lógica de buckets ya era disjunta; ajusto el subtítulo de "Próximas 3 horas" a "Entre 1 y 3 horas" para dejarlo claro visualmente.)

### 3. Secciones colapsables, cerradas por defecto

- Reemplazo el componente `Section` para envolver el contenido en `Collapsible` (shadcn, ya disponible en `@/components/ui/collapsible`).
- Cada sección: header clickable con ícono + título + contador + chevron animado que rota 180° al abrir.
- Estado individual con `useState(false)` por sección → todas cerradas al cargar.
- Los **KPIs de resumen** arriba se mantienen visibles siempre, así de un vistazo ves los conteos sin abrir nada.
- Las secciones vacías muestran solo el header (sin tarjetas dentro), pero siguen siendo clickables para mostrar el "empty hint".

### Archivos a tocar

- `src/pages/CrewRecurringTasksOverview.tsx` (único archivo; sin cambios en DB ni en otros componentes).
