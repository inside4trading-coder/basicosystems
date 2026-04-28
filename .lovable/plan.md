## Objetivo

Agregar en la parte superior de la página **Crew** un widget compacto que muestre los cumpleaños del mes en curso, indicando para cada empleado el día de su cumpleaños y cuántos días faltan (o "¡Hoy!" / "Pasado").

## Cambios

### 1. Base de datos
La tabla `employees` no tiene campo de fecha de nacimiento. Crear migración para añadir:

- Columna `birth_date date` (nullable) en `public.employees`.

Se expone también en `get_crew_employees()` (rpc) para que admin y manager puedan leerla — no es información sensible que requiera enmascarar.

### 2. Tipos
- `src/types/crew.ts`: agregar `birth_date: string | null` a `Employee`.
- `src/hooks/useCrewData.ts`: mapear `birth_date` desde el RPC; permitirlo en `updateEmployee`.

### 3. Captura del dato
- `src/components/crew/AddEmployeeSheet.tsx`: añadir input "Fecha de nacimiento" (opcional) y enviarlo al insert.
- `src/components/crew/CrewGeneralData.tsx`: añadir campo editable "Fecha de nacimiento" en la sección de datos personales para poder rellenarlo a empleados existentes.

### 4. Widget de cumpleaños del mes (lo principal)
- Crear `src/components/crew/BirthdaysThisMonth.tsx`:
  - Recibe `employees: Employee[]`.
  - Filtra empleados activos con `birth_date` cuyo mes coincida con el mes actual.
  - Calcula para cada uno:
    - **Día**: día del mes (ej: "12 de mayo").
    - **Días restantes**: diferencia desde hoy hasta el cumpleaños de este año. Etiquetas:
      - `0` → "¡Hoy!" (badge destacado)
      - `> 0` → "En N días"
      - `< 0` → "Hace N días"
  - Ordena por fecha ascendente (próximos primero, pasados al final).
  - Si no hay cumpleaños este mes: muestra una sola línea sutil ("Sin cumpleaños este mes").
  - Diseño compacto: una tarjeta horizontal con icono de pastel (`Cake` de lucide), título pequeño "Cumpleaños de [mes]" y una fila con chips por persona (avatar mini + nombre + día + días restantes).

- `src/pages/Crew.tsx`: insertar `<BirthdaysThisMonth employees={employees} />` justo debajo del header y antes de los filtros.

### 5. Cálculo de días (sin desfase de timezone)
Reutilizar `parseLocalDate` / `formatLocalDate` de `src/lib/dateUtils.ts` para evitar errores de zona horaria al comparar fechas tipo `YYYY-MM-DD`.

## Notas técnicas

- El widget es solo lectura, no requiere RLS adicional.
- `birth_date` se respeta como dato opcional; empleados sin fecha simplemente no aparecen en el widget.
- No se cambia ninguna lógica de salarios/permisos existente.
