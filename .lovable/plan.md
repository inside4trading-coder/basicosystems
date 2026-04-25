## Problema

Si configuras un vencimiento el **5 de mayo**, el calendario lo muestra el **4 de mayo**. Es un bug clásico de zona horaria.

## Lógica actual

1. Las obligaciones recurrentes generan fechas con `new Date(year, month, day)` (medianoche local).
2. Al guardar en BD se serializan con `toISOString().slice(0, 10)` → convierte primero a **UTC**. En Venezuela (UTC-4), la medianoche local del 5 mayo = `2026-05-05T04:00:00Z`, que aún slicea a `"2026-05-05"` ✅.
3. **Pero** al leer del backend, `AdminCalendar.tsx` hace `new Date("2026-05-05")`. JS interpreta strings `YYYY-MM-DD` como **UTC midnight** → en local UTC-4 = `4 de mayo 20:00`. Por eso aparece un día antes ❌.
4. El mismo problema potencial existe al generar instancias recurrentes (`generateDueDates`) y al crear instancias únicas (`NewInstanceSheet`), donde un input `<input type="date">` también puede sufrir desfase si se reconvierte vía `Date`.

## Solución

Tratar `due_date` como **fecha pura (date-only) sin timezone** en todos los puntos:

### 1. `src/types/admin.ts` (o nuevo `src/lib/dateUtils.ts`)
Añadir helpers:
- `parseLocalDate(str: "YYYY-MM-DD"): Date` → construye `new Date(y, m-1, d)` (medianoche **local**, no UTC).
- `formatLocalDate(d: Date): string` → retorna `YYYY-MM-DD` usando getFullYear/getMonth/getDate (sin pasar por UTC).

### 2. `src/components/admin/AdminCalendar.tsx`
- Reemplazar `new Date(inst.due_date)` (línea ~53) por `parseLocalDate(inst.due_date)`.
- Igual en `computeUrgency` de `types/admin.ts` (línea ~93).

### 3. `src/hooks/useAdminData.ts` — `generateDueDates`
- Reemplazar todos los `d.toISOString().slice(0, 10)` (líneas 70 y 85) por `formatLocalDate(d)` para evitar dependencia de offset.

### 4. `src/components/admin/CreateObligationSheet.tsx`
- Líneas 92, 116, 145: usar `formatLocalDate(today/d)` en lugar de `toISOString().slice(0,10)`.

### 5. `src/components/admin/NewInstanceSheet.tsx`
- Línea 53: misma sustitución.

### 6. Otros consumidores de `due_date`
Revisar `AdminListView`, `AdminInstanceSheet`, `AdminKPIs`, `AdminObligationDetail` y reemplazar cualquier `new Date(due_date)` por `parseLocalDate(due_date)` para que el día mostrado coincida exactamente con el guardado.

## Resultado esperado

Si pones vencimiento el 5 de mayo → en el calendario aparece el **5 de mayo**, sin importar la zona horaria del navegador. Los vencimientos recurrentes generados (día 15, etc.) caerán siempre el día exacto configurado.

## Fuera de alcance

- Migración de datos existentes (las fechas ya en BD están correctas como `YYYY-MM-DD`; solo cambia cómo se leen/renderizan).
- Manejo de timezones por usuario (se asume timezone del navegador como referencia local).
