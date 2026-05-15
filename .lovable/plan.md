## Problema

En `CrewRecurringTasksOverview.tsx`, la función `taskHappensOn` decide si una tarea recurrente aparece "hoy". Hoy parsea el campo `day` de forma muy estricta:

- **Semanal**: solo acepta el nombre exacto del día (ej. `"jueves"`). Si el usuario escribe `"jueves de cada semana"`, `dayMap[...]` devuelve `undefined` y la lógica actual termina mostrando la tarea **todos los días**.
- **Mensual**: solo acepta un número (ej. `"15"`). Frases como `"último de cada mes"`, `"último día hábil"`, `"primer lunes"` caen en `NaN` y también se muestran **todos los días**.

## Solución

Reescribir el parser del campo `day` para reconocer frases en español/inglés y devolver una regla estructurada. La lógica de "¿ocurre hoy?" se evalúa contra esa regla usando la fecha actual en zona Caracas (que ya se calcula con `caracasParts`).

### Reglas soportadas (campo libre `day`)

**Semanal** (`frequency: "weekly"`)
- "jueves", "jueves de cada semana", "todos los jueves", "every thursday" → solo los jueves
- Vacío → todos los días de la semana (comportamiento actual)
- Lunes…domingo + variantes con/sin acento, en EN

**Mensual** (`frequency: "monthly"`)
- "15", "el 15", "día 15 de cada mes" → día numérico del mes
- "último de cada mes", "último día", "ultimo dia hábil", "last business day" → **último día hábil** del mes (lunes–viernes; si el último cae en sábado/domingo, retrocede al viernes)
- "último día del mes", "fin de mes" (sin "hábil") → último día calendario del mes
- "primer día hábil", "primer lunes", "segundo viernes", "tercer miércoles", "último jueves" → N-ésimo día de la semana del mes (incluye "último <día>" usando la última ocurrencia del mes)
- Vacío → todos los días del mes (comportamiento actual)

**Diaria / Interdiaria**: sin cambios.

### Implementación

Archivo único: `src/pages/CrewRecurringTasksOverview.tsx`

1. Añadir helpers puros (junto a `dayMap`):
   - `lastDayOfMonth(year, month)` → número del último día calendario.
   - `lastBusinessDayOfMonth(year, month)` → ajusta a viernes si cae sábado/domingo.
   - `nthWeekdayOfMonth(year, month, weekday, n)` → n=1..4 o n="last". Devuelve día del mes o null.
   - `parseWeeklyDay(raw)` → busca tokens lunes/martes/.../domingo (con acentos y EN) en el string; devuelve weekday 0..6 o null si no encuentra (en cuyo caso = todos los días).
   - `parseMonthlyRule(raw)` → devuelve un discriminated union:
     - `{ kind: "day-of-month", day: number }`
     - `{ kind: "last-calendar" }`
     - `{ kind: "last-business" }`
     - `{ kind: "nth-weekday", weekday: 0..6, nth: 1|2|3|4|"last" }`
     - `null` (= todos los días, fallback).
   - El parser detecta:
     - "habil"/"hábil"/"business" → variante hábil
     - "ultimo"/"último"/"last"/"fin de mes" → último
     - "primer/primero/1er", "segundo/2do", "tercer/3er", "cuarto/4to" → nth
     - Combinado con un nombre de día → `nth-weekday`
     - Solo número → `day-of-month`

2. Reemplazar el bloque actual de `taskHappensOn` para `weekly` y `monthly`:
   - **Weekly**: usar `parseWeeklyDay(task.day)`. Si null y string no vacío → no asumir; aplicar fallback actual (todos los días) para no romper datos viejos.
   - **Monthly**: evaluar la regla contra `parts.year/month/day` y `parts.weekday`. Si la regla es null y el string no es vacío, fallback a comportamiento actual.

3. Mantener el orden, los buckets y el resto del archivo intactos. Sin cambios en DB ni en `CrewRecurringTasks.tsx` (el sheet ya guarda texto libre en `day`).

### Casos cubiertos por el ejemplo del usuario

- `"jueves de cada semana"` + weekly → aparece **solo los jueves**.
- `"último de cada mes"` + monthly → aparece **solo el último día hábil del mes** (interpretación pedida: "DIA HABIL ULTIMO").
- `"último día hábil"` + monthly → idem.
- `"15 de cada mes"` + monthly → aparece **solo el día 15**.

### Riesgos

- Datos existentes con `day` ambiguo (ej. "lunes y miércoles"): el parser tomará el primer día detectado. Si se requiere multi-día, sería un cambio de modelo (fuera de alcance de este pedido).
- Zona horaria: ya se usa Caracas en todo el archivo, se mantiene.
