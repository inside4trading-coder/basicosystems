Cambio mínimo en `src/pages/core/CoreFabricationFunds.tsx` para calcular días sin cerrar usando el rango de período del run.

### Cambios

1. **Extender tipo `Run`** para incluir `period_start` y `period_end` (ya vienen en `select("*")` de Supabase, solo falta el tipo).

2. **Reemplazar `missingDays` useMemo**:
   - ANTES: marcar cerrado solo el día del `created_at` del run.
   - AHORA: para cada run exitoso, recorrer `period_start → period_end` (convertidos a hora Venezuela, -04:00) y agregar cada día al set `closed`.
   - Seguir ignorando días anteriores a `BASELINE_DATE` y posteriores a ayer.
   - Mantener los mismos estados exitosos: `completed`, `completed_warnings`, `success`, `posted`.

3. **Helper** `dateToLocalISO` / o `toVenezuelaDateISO` para evitar desfases por timezone.

### Validación

- El run del 30/07 con `period_start = 2026-07-27 04:00Z` y `period_end = 2026-07-30 03:59Z` debe cerrar 27/07, 28/07 y 29/07.
- La alerta "Hay días sin cerrar en Partidas" desaparece si no hay otros días reales pendientes.
- No se tocan backend, DB, saldos, necesidades, OP, movimientos ni reprocesos de ventas.
- Typecheck (`tsgo`) en 0 errores.

### Requisitos del usuario incluidos
1. Archivo modificado: `src/pages/core/CoreFabricationFunds.tsx`.
2. Antes usaba `created_at` → se corregirá.
3. Ahora usará `period_start` / `period_end`.
4. Días que cubre el run del 30/07: 27/07, 28/07, 29/07.
5. Alerta desaparece.
6. Typecheck verificado.