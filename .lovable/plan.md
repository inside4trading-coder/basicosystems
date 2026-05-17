## Verificación matemática (3 fichajes de hoy, Ediana Velásquez)

Horario configurado: **09:45 → 17:45** (8h, tolerancia 10m). Los 3 turnos fueron:

| # | Entrada | Salida | Trabajadas | Retraso vs 09:45 | Overtime vs 17:45 |
|---|---------|--------|------------|------------------|-------------------|
| 1 | 18:59:55 | 19:00:27 | ~1m | 9h 14m | +1h 15m |
| 2 | 19:18:52 | 19:23:16 | ~4m | 9h 33m | +1h 38m |
| 3 | 19:27:37 | 19:37:26 | ~10m | 9h 42m | +1h 52m |
| **Σ** | | | **~15m** | **~28h 29m** | **~4h 45m** |

Comparación con lo mostrado en la UI:

- Horas trabajadas **15m** ✓ · Debían **24h 00m** (3×8h) ✓
- Puntualidad **0%** (3 tarde / 0 a tiempo, fuera de tolerancia) ✓
- Minutos de retraso **28h 32m** ✓ (≈28h 29m, diferencia por redondeo de segundos)
- Horas extra **4h 45m** ✓
- Salidas anticipadas **0** ✓ (todas las salidas son posteriores a 17:45)
- Sin salida marcada **0** ✓ · Pendientes **0** ✓
- Fuera de radio **3** ✓ (los 3 eventos tienen `location_state=fuera_del_radio`)
- Turnos cerrados **3 / 3** ✓
- Detalle Ediana: 3/3, 15m / 24h 00m, −23h 45m, 0%, 3 turnos con +28h 32m, +4h 45m extra ✓

**Conclusión:** todos los valores son matemáticamente correctos según las fórmulas actuales. La única "rareza" semántica es que un mismo turno puede sumar a la vez muchas horas de retraso (entrada tardía) y horas extra (salida posterior a la programada) aunque el trabajo real haya sido de 1 minuto. Es coherente con la definición de cada métrica, no es un bug.

## Cambios a implementar

### 1. Tooltips en cada KPI card
Extender `AdminMetricCard` para aceptar un prop opcional `tooltip` y envolver la card con el componente `Tooltip` de shadcn. Al pasar el cursor se mostrará una leyenda con:

- **Horas trabajadas** — "Suma del tiempo entre entrada y salida de todos los turnos cerrados en el periodo. El descanso cuenta como parte del turno."
- **Puntualidad** — "% de turnos con entrada dentro de la tolerancia configurada (por defecto 10m sobre la hora de entrada del horario)."
- **Minutos de retraso** — "Suma de minutos de retraso de los turnos que superaron la tolerancia. Se mide entrada real vs. hora de entrada programada."
- **Horas extra** — "Suma de minutos trabajados después de la hora de salida programada de cada turno."
- **Sin salida marcada** — "Turnos con entrada pero sin salida registrada (olvidos o turnos aún abiertos)."
- **Pendientes de revisión** — "Fichajes marcados por el sistema como dudosos que requieren aprobación manual."
- **Fuera de radio** — "Fichajes realizados a más distancia que el radio permitido de la tienda."
- **Turnos cerrados** — "Turnos con entrada y salida registradas vs. total de turnos del periodo."

### 2. Tooltips en cabeceras de la tabla "Detalle por empleado"
Envolver cada `TableHead` con tooltip:

- **Turnos** — "Cerrados / Total. Un turno se cuenta como cerrado cuando tiene entrada y salida."
- **Trabajadas / Debía** — "Tiempo realmente trabajado vs. tiempo que debía trabajar según su horario. La diferencia se muestra en verde si trabajó de más, en rojo si faltó."
- **Puntualidad** — "% de entradas dentro de la tolerancia configurada."
- **Retrasos** — "Cantidad de turnos donde llegó tarde y total de minutos acumulados de retraso."
- **Salidas anticipadas** — "Turnos donde salió antes de la hora programada y minutos acumulados."
- **Horas extra** — "Minutos trabajados después de la hora de salida programada."
- **Incidencias** — "Sin salida marcada, pendientes de revisión y fichajes fuera de radio."

### 3. Detalles técnicos
- `AdminMetricCard`: añadir prop `tooltip?: string`. Si está presente, envolver el `<Card>` con `<Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip>`.
- Asegurar un único `<TooltipProvider>` en `SublimeAdminFichaje` (o usar el global del layout si ya existe).
- Pasar el texto del tooltip a cada `AdminMetricCard` de la pestaña Métricas.
- En las cabeceras de la tabla detalle, envolver el contenido con `<Tooltip>` (no toda la celda, solo el texto + cursor `help`).

Sin tocar lógica de cálculo: las cifras ya son correctas.