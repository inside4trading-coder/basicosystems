## BLOQUE HIPER AHORRO — Reset de Partidas + Control de días

**Nota**: el mensaje menciona dos fechas (`2026-07-16` en la constante y `18/07/2026` en textos/validación). Voy a usar **`BASELINE_DATE = '2026-07-18'`** porque aparece consistentemente en los mensajes UI y en la sección H de validación. Confirma en la aprobación si prefieres `2026-07-16`.

### 1. Migración única de reset (mantenimiento)

Archivo: `supabase/migrations/<ts>_reset_partidas_fabricacion.sql`

Estructura con logs `RAISE NOTICE` **antes** de borrar para dejar rastro de conteos y sumas:

```sql
DO $$
DECLARE v_mov int; v_sum numeric; v_pend int; v_runs int; v_events int;
BEGIN
  SELECT count(*), coalesce(sum(amount),0) INTO v_mov, v_sum
    FROM core_fabrication_fund_movements
    WHERE movement_type IN (
      'sale_generated','sale_generated_non_restockable',
      'replacement_cost_adjustment','replacement_reclassification_out',
      'replacement_reclassification_in','external_supplier_payment');
  SELECT count(*) INTO v_pend FROM core_fabrication_fund_pending_items;
  SELECT count(*) INTO v_runs FROM core_fabrication_fund_runs;
  SELECT count(*) INTO v_events FROM core_replenishment_policy_events
    WHERE source_type = 'fabrication_fund_movement';
  RAISE NOTICE 'RESET: mov=% sum=% pending=% runs=% events=%',
    v_mov,v_sum,v_pend,v_runs,v_events;
END $$;

DELETE FROM core_replenishment_policy_events
  WHERE source_type = 'fabrication_fund_movement';
DELETE FROM core_fabrication_fund_movements
  WHERE movement_type IN (
    'sale_generated','sale_generated_non_restockable',
    'replacement_cost_adjustment','replacement_reclassification_out',
    'replacement_reclassification_in','external_supplier_payment');
DELETE FROM core_fabrication_fund_pending_items;
DELETE FROM core_fabrication_fund_runs;

UPDATE core_fabrication_funds
  SET available_amount = 0, updated_at = now()
  WHERE fund_type IN ('general','external_supplier','pending',
                      'non_restockable','replacement');
```

Los ajustes manuales (`source = 'manual'` u otros `movement_type`) se preservan.

### 2. UI — `src/pages/core/CoreFabricationFunds.tsx`

Agregar constante `BASELINE_DATE = '2026-07-18'` y:

**a) Formulario Desde/Hasta del botón "Procesar ventas confirmadas":**
- Default `Desde = BASELINE_DATE`, `Hasta = hoy`.
- `<Input type="date" min={BASELINE_DATE} …>` en Desde.
- Handler `onChange` valida: si `< BASELINE_DATE` → toast: *"Las partidas fueron reiniciadas. El nuevo procesamiento empieza desde 18/07/2026."* y no aplica.

**b) Cálculo de días saltados (frontend puro):**
- Con `runs` ya cargados en el estado, construir set de fechas con al menos un run con `status = 'completed'` (usar el status real que aparezca; si no hay ninguno, fallback a existencia de run — se ajusta en implementación tras confirmar valores reales de `status`).
- Generar lista de fechas desde `BASELINE_DATE` hasta `ayer` que **no** tienen run exitoso → `missingDays[]`.

**c) Card "Cierre diario" en pestaña Resumen:**
- Verde si `missingDays.length === 0`: *"Todo cerrado desde 18/07/2026."*
- Rojo si hay pendientes: *"X días sin cerrar."* + botón "Ver días pendientes" que abre un `Dialog` (no página nueva) con la lista.

**d) Alerta roja + acción:**
- Banner rojo arriba del formulario cuando hay `missingDays`: *"Hay días sin cerrar en Partidas. Esto puede dejar dinero de costo sin reservar."* con lista.
- Botón **"Procesar próximo día pendiente"** que setea `Desde = Hasta = missingDays[0]`. No ejecuta.

**e) Bloqueo anti‑salto en `processSales()`:**
- Antes de ejecutar la RPC actual, si existe `missingDays[0]` y `Desde > missingDays[0]` → toast bloqueante: *"No puedes procesar el DD/MM/AAAA porque el DD/MM/AAAA aún no fue cerrado."*
- Permitido si `Desde <= missingDays[0] <= Hasta`.

### 3. Alcance intocable

Sin cambios: catálogo, mapa Woo/Core, políticas, costos, materia prima, Woo orders, productos, variantes, OP, QR, nómina, inventario. Sin RPC nuevas, sin edge functions nuevas, sin página nueva, sin botón permanente de reset.

### 4. Verificación post-implementación

- Typecheck con `tsgo`.
- Query rápida: saldos en 0 en fondos operativos; conteo cero en movimientos/pendientes/runs de tipos borrados.

### Respuesta final que devolveré al usuario tras implementar

Lista numerada 1–9 exactamente como pide la sección "RESPONDER SOLO".