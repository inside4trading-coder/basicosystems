# Planificación: nueva experiencia de calendario (desktop y móvil)

Rediseño visual y responsive del módulo Planificación reutilizando los datos, estados y sincronización que ya existen. Solo lectura: crear tareas y editar sigue ocurriendo en Notion.

## Qué cambia para ti

### Escritorio
- Cabecera limpia: **PLANIFICACIÓN**, navegación `‹ Septiembre 2026 ›` y botón **Hoy**.
- Las fuentes dejan de ocupar toda la pantalla como fila de pastillas: pasan a un selector compacto **Fuente**, junto a **Estado** y **Persona**. Se mantiene archivar/restaurar fuentes dentro de ese selector.
- Vistas: **Agenda · Semana · Mes**.
- Vista Mes: cada tarea se ve como `● Título`, con el punto de color según su estado (verde hecho, azul en proceso, naranja pendiente, rojo vencida, morado delegada) y el texto en color neutro.
- Las semanas crecen de alto según cuántas tareas tengan (estilo Notion): una semana cargada se hace más alta en vez de esconder todo. Con un tope razonable; al superarlo aparece `+4 más`, que abre el día en el panel lateral. La página hace scroll vertical.
- Días pasados en gris muy claro con tareas atenuadas; hoy marcado en azul suave; días futuros alternando blanco y azul muy claro, día a día.
- Panel lateral derecho al pulsar un día: fecha completa, número de tareas y todas las tarjetas con estado, título, fuente, área/contexto y **siempre** las personas etiquetadas (iniciales o avatar + nombre). Al final, acceso para crear la tarea en Notion. El calendario sigue visible con el panel abierto.
- Vista Semana: siete columnas con tarjetas algo más completas (estado, título, fuente, iniciales de la persona).
- Vista Agenda: lista cronológica agrupada por día (HOY, MAÑANA, fechas) con estado, fuente y persona.
- Sección colapsable **Tareas sin fecha asignada (X)** debajo del calendario, como hasta ahora.

### Filtro por persona
- Botones **Mis tareas** y **Ver tareas de… ▼**.
- El selector lista únicamente las personas etiquetadas en las tareas del período visible (no todos los usuarios del sistema), y se actualiza al cambiar de mes.
- **Mis tareas**: la primera vez eliges quién eres dentro de esa lista de personas etiquetadas; queda recordado en tu navegador y se puede cambiar cuando quieras.
- Con filtro activo se muestra `Viendo tareas de: Luis David ×`; la X lo quita. Afecta a Mes, Semana, Agenda, panel lateral y hoja inferior en móvil.

### Móvil (experiencia propia, no el escritorio encogido)
- Vista por defecto: **Semana**, con rango `22 – 28 de septiembre 2026` y flechas; los días en vertical con su conteo y tarjetas compactas (`● Título`, fuente · contexto, iniciales).
- Vista **Mes** compacta: solo número de día y puntitos de color; al tocar un día aparece justo debajo un resumen con sus tareas y **Ver todas ›**.
- Detalle del día en hoja inferior deslizable, con todas las tareas, personas y estado, cerrable arrastrando o con X.
- Filtro de persona en selector compacto **Todos ▼**.
- El día actual se resalta en azul suave.

### Detalle de tarea
Al pulsar cualquier tarea (mes, semana, agenda, panel o hoja inferior) se abre la ficha con título, estado, fuente, fecha, personas etiquetadas, área y enlace para abrirla en Notion. Un solo componente compartido por todas las vistas.

## Detalle técnico

- **Sin cambios de backend.** `notion-planning`, `usePlanningData` y `planningStatus.ts` se mantienen tal cual; el filtrado por persona y estado se hace en cliente sobre `tasks`.
- Nuevo `src/components/planning/` :
  - `PlanningToolbar.tsx` — navegación de mes/semana, selectores compactos de fuente/estado/persona, switch de vistas.
  - `PlanningMonth.tsx` — grilla de 7 columnas, filas por semana con altura dinámica (`minHeight` calculado a partir del máximo de tareas de la fila, con tope ~6 chips y `+N más`), tokens de fondo pasado/hoy/futuro alternado por índice de día cronológico.
  - `PlanningWeek.tsx` — vista semana desktop (7 columnas) y móvil (lista vertical de días) desde el mismo componente con `useIsMobile`.
  - `PlanningMonthMobile.tsx` — grilla compacta con puntos de estado + resumen inline del día.
  - `PlanningDayPanel.tsx` — contenido del día, reutilizado por el sidebar desktop y por `Sheet side="bottom"` en móvil.
  - `TaskDetailDialog.tsx` — ficha única de tarea.
  - `TaskChip.tsx`, `AssigneeAvatars.tsx` — punto de estado + título neutro, iniciales/avatares.
  - `usePlanningFilters.ts` — estado de filtros (fuente, estado, persona), derivación de personas del período visible y persistencia de "soy yo" en `localStorage` (`planning:me`).
- `PlanningCalendar.tsx` se reduce a orquestador (mes/semana + panel/hoja); `PlanningAgenda.tsx` conserva su lógica de buckets y solo recibe las tareas ya filtradas; `PlanningTable.tsx` no se toca salvo recibir tareas filtradas.
- `Planning.tsx`: se elimina la fila horizontal de pastillas de fuentes y el toggle Activas/Archivadas se integra en el selector de Fuente, conservando `useArchivedSources` y `planning:archived_sources`.
- Colores: se reutiliza `statusVisual()`. Los fondos pasado/hoy/futuro usan tokens del design system (`muted/40`, `primary/5`, `primary/[0.03]`) — nada hardcodeado.
- Personas: identidad por nombre de la persona etiquetada en Notion (`task.assignee[].name`), elegido por el usuario desde la lista de etiquetados.
- Verificación: `bunx tsc --noEmit -p tsconfig.app.json`, `bun run build`, y revisión en preview de mes con semana cargada, filtro por persona, panel lateral y vistas móviles.

## No se toca
Sincronización con Notion, fuentes, permisos, sistema de estados, tabla de tareas, ni Sublime, Core, España o Studio.
