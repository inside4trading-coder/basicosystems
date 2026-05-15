## Ampliar parser de tareas recurrentes

Archivo único: `src/pages/CrewRecurringTasksOverview.tsx`

### Nuevas frases soportadas

**Semanales (múltiples días + cada N semanas):**
- "martes y jueves", "lunes, miércoles y viernes", "lun/mié/vie"
- "días hábiles" / "entre semana" / "lun a vie" → L-V
- "fin de semana" / "sábado y domingo"
- "cada 2 semanas" / "quincenal" → toma como ancla la fecha de creación de la tarea (`created_at`) y muestra solo si la diferencia en semanas ISO es múltiplo de N (con día de la semana también respetado si está)

**Mensuales (múltiples días + primer hábil + rangos):**
- "día 15 y 30 de cada mes", "1 y 15", "los días 5, 15 y 25"
- "primer día hábil del mes" / "primer hábil"
- "del 1 al 5 de cada mes" → cualquier día en el rango (ajustable a hábiles si se indica "hábiles")
- "quincena" / "quincenal" en contexto mensual → días 1 y 15

**Trimestrales / cada N meses:**
- "cada 3 meses", "trimestral", "cada 2 meses", "bimestral", "semestral"
- Se evalúa contra `created_at`: `(monthsSinceCreated % N === 0)` y mismo día (o regla de día) que la creación.

### Cambios técnicos

1. **`parseWeeklyDays(raw): number[] | null`** — devuelve lista de weekdays (0-6). Reconoce conectores (`y`, `,`, `/`, `&`, `o`), aliases (`lun`, `mar`, `mie`, `jue`, `vie`, `sab`, `dom`), y atajos (`dias habiles`, `entre semana`, `fin de semana`).
2. **`parseEveryN(raw, unit)`** — extrae N de "cada N semanas" / "cada N meses" / "cada N dias", con sinónimos (`quincenal`=2 sem, `bimestral`=2 mes, `trimestral`=3 mes, `semestral`=6 mes).
3. **`MonthlyRule`** se extiende con:
   - `{ kind: "days-of-month"; days: number[] }`
   - `{ kind: "first-business" }`
   - `{ kind: "range-of-month"; from: number; to: number; businessOnly: boolean }`
4. **`taskHappensOn`**:
   - `weekly`: usa `parseWeeklyDays` (lista) + `parseEveryN(raw, "week")` con ancla `task.created_at`.
   - `monthly`: maneja nuevos `kind` y soporta `parseEveryN(raw, "month")` (cada N meses) con ancla `task.created_at`.
   - `interdaily` se mantiene (cada 2 días por paridad), pero se añade `daily` con "cada N días" si N>1.
5. Mantiene fallback actual (mostrar todos los días) si no hay parseo posible, para no romper datos legacy.

### Notas

- Sin cambios en UI ni en otros archivos.
- Las anclas (`created_at`) se leen del objeto `RecurringTask` ya cargado; si falta, se cae al comportamiento simple sin "cada N".
- No se tocan tareas `daily` salvo para soportar opcionalmente "cada N días" cuando esté escrito en el campo `day`.
