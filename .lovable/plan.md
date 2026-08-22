# Cierre automático de nómina semanal (jueves 11:59 pm hora Venezuela)

Generar sola la nómina de la semana operativa (viernes → jueves) al cerrar el jueves a las 23:59 hora de Venezuela, sin duplicar lo que ya exista.

## Cómo funciona para el usuario

- Cada jueves a las 23:59 (hora Venezuela, UTC-4) el sistema cierra la semana y crea la nómina de esa semana automáticamente, en estado **borrador**, igual que si se hubiera pulsado "Generar nómina".
- Ejemplo: la semana 21/08 → 27/08 se cierra el **27/08 a las 11:59 pm** hora Venezuela y queda la nómina lista para revisar el viernes.
- Si esa semana ya tiene nómina (o se solapa con una existente no cancelada/fusionada), no crea nada: no hay duplicados.
- Si no hubo trabajos pendientes en la semana, no crea nómina vacía; sólo queda registrado el intento.
- El botón manual "Generar nómina semanal" se mantiene igual, por si hay que adelantar o repetir el cierre.
- En la pestaña Nóminas se muestra el origen (Automática / Manual) y la fecha del último cierre automático.

## Detalles técnicos

**Zona horaria**: todo el cálculo de la semana se hace en `America/Caracas`. El cron corre en UTC, así que se programa a las **03:59 UTC del viernes** (= jueves 23:59 en Venezuela). Venezuela no aplica horario de verano, el desfase es fijo UTC-4.

**Nueva Edge Function `core-payroll-auto-close`** (`supabase/functions/core-payroll-auto-close/index.ts`):

1. Calcula la semana operativa cerrada en hora Caracas: `period_start` = viernes, `period_end` = jueves (inclusivo), `payment_date` = viernes siguiente — misma regla que `src/lib/corePayrollWeek.ts`, reimplementada en el server con offset -4h.
2. **Single-flight**: toma un lock por semana antes de trabajar (fila de estado con clave `payroll_auto_close_<period_start>` y expiración) para que dos ejecuciones simultáneas no generen dos nóminas.
3. **Guarda de solape**: consulta `core_payroll_runs` y aborta si alguna nómina no `cancelled`/`merged` se cruza con el rango.
4. Selecciona trabajos de `core_production_work_entries` con `payroll_status='pending'`, `operator_id` no nulo, `payroll_amount > 0`, `created_at` dentro de `[viernes 00:00, viernes siguiente 00:00)` **en hora Caracas** (`>= start+04:00Z`, `< endExclusive+04:00Z`), excluyendo los que ya tengan vínculo en `core_payroll_work_entry_links` (idempotencia real, además de la restricción única existente).
5. Si no queda ningún trabajo: sale sin crear nada y registra el resultado.
6. Crea `core_payroll_runs` (status `draft`, contadores y total), las `core_payroll_operator_lines` por operario, los `core_payroll_work_entry_links` y marca los trabajos como `included_in_payroll` — misma secuencia que hoy hace `GeneratePayrollDialog`.
7. Registra auditoría en `core_audit_logs` con `action = 'payroll_auto_generated'` (período, total, operarios, trabajos, o el motivo de omisión).
8. Errores: no reintenta en bucle; deja el resultado registrado para que el cierre siguiente o el botón manual lo resuelvan.

**Cambios de datos**:
- `core_payroll_runs`: nueva columna `generated_by_system boolean default false` (marca el origen automático) y `generation_source text` opcional para el detalle.
- Tabla de control de ejecución (`core_payroll_auto_close_runs`): semana, estado (`created` / `skipped_existing` / `skipped_empty` / `error`), mensaje, timestamps, con RLS de lectura para admin/manager y escritura sólo desde la función. Sirve de lock y de historial.

**Programación**: `pg_cron` + `pg_net` con `cron.schedule('core-payroll-auto-close', '59 3 * * 5', ...)` que llama por HTTP a la Edge Function. La guarda de solape y el lock hacen que una ejecución extra sea inofensiva.

**Frontend** (`src/pages/core/CorePayroll.tsx`): badge "Automática" en las nóminas generadas por el sistema y una línea con el resultado del último cierre automático. Sin cambios en cálculos ni en el flujo manual.

## Alcance

No se tocan montos, tarifas, ajustes, fusión de nóminas, comprobantes ni ningún otro módulo (Woo, OP, escaneos, inventario, Partidas).

## Validación

- Ejecutar la función manualmente sobre la semana 21/08 → 27/08 y comprobar que crea la nómina con los mismos trabajos/total que el preview del diálogo manual.
- Ejecutarla dos veces seguidas: la segunda no crea nada (`skipped_existing`).
- Confirmar que el cron quedó agendado a las 03:59 UTC del viernes.
- Typecheck en 0 errores.
