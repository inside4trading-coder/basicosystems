## Diagnóstico

- Movimientos `replacement_*` se crean correctamente (6 filas, status `posted`, buckets y montos correctos).
- `core_fabrication_funds.available_amount` NO se actualiza (last `updated_at` es 22-jul, previo a los reemplazos del 24-jul).
- `CoreFabricationFunds.tsx:200` calcula las cards Fábrica / Pendiente sumando `available_amount` directamente desde `core_fabrication_funds`, no desde movimientos.
- Todas las demás operaciones (aportes, egresos, transferencias) actualizan `available_amount` explícitamente. El RPC de reemplazo lo omite.

## Causa raíz

`core_apply_replacement_event` inserta filas en `core_fabrication_fund_movements` pero olvida el `UPDATE core_fabrication_funds SET available_amount = available_amount + delta` para cada fondo afectado.

## Patch mínimo recomendado

Migración que redefine `core_apply_replacement_event` añadiendo, dentro de la misma transacción y justo después de los 3 INSERT de movimientos:

```sql
UPDATE public.core_fabrication_funds
   SET available_amount = available_amount - v_reserved_amount,
       updated_at = now()
 WHERE id = v_pending_fund_id;

UPDATE public.core_fabrication_funds
   SET available_amount = available_amount + v_reserved_amount,
       updated_at = now()
 WHERE id = v_factory_fund_id;

UPDATE public.core_fabrication_funds
   SET available_amount = available_amount + v_cost_delta, -- negativo si destino más barato
       updated_at = now()
 WHERE id = v_factory_fund_id;
```

(los tres UPDATE se pueden consolidar en dos, uno por fondo, sumando deltas).

## Backfill

Migración one-shot que reajusta `available_amount` de los fondos `07f14689…` (pending) y `96f2b00c…` (general) sumando el neto de todos los movimientos `replacement_*` con `status='posted'` cuya fecha sea posterior al último `updated_at` del fondo.

## Fuera de alcance

- No cambiar la UI: las cards seguirán leyendo `available_amount`.
- No tocar otros RPCs.
- No modificar movimientos ya existentes.
