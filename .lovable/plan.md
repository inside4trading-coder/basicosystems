## Parche mínimo — Rezagados confirmados desde 2026-07-16

**Archivo único a modificar:**
`supabase/functions/core-process-fabrication-funds/index.ts` (función `runProcessSales`)

**Sin cambios en:** UI, migraciones, RPC, WooCommerce, stock, OP, QR, nómina, `CONFIRMED_STATUSES`, `REVERTING_STATUSES`.

---

### Cambios puntuales

1. **Constante nueva** en el módulo:
   ```ts
   const LATE_CONFIRMED_BASELINE = "2026-07-16";
   ```

2. **Nuevos contadores** en `summary` (inicializados a 0):
   - `late_confirmed_orders_found`
   - `late_confirmed_items_checked`
   - `late_confirmed_movements_created`
   - `late_confirmed_pending_items_created`
   - `late_confirmed_order_ids: number[]`

3. **Detección de rezagados (antes del `while` de paginación).**  
   Solo se activa si `periodStart` es `> LATE_CONFIRMED_BASELINE`. Si no, no hay rezagados que agregar (el rango normal ya los cubre).

   ```ts
   const lateOrderIds = new Set<number>();
   if (periodStart && periodStart > LATE_CONFIRMED_BASELINE) {
     // 1) orders confirmados >= BASELINE y < periodStart
     const { data: candOrders } = await supabase
       .from("orders")
       .select("order_id")
       .in("order_status", Array.from(CONFIRMED_STATUSES))
       .gte("order_datetime", LATE_CONFIRMED_BASELINE)
       .lt("order_datetime", periodStart);

     const candIds = (candOrders ?? []).map((o: any) => o.order_id);
     if (candIds.length) {
       // 2) reservas existentes por línea para esos orders
       const { data: existingLineMovs } = await supabase
         .from("core_fabrication_fund_movements")
         .select("source_order_id, source_order_item_id, movement_type")
         .in("source_order_id", candIds)
         .in("movement_type", ["sale_generated", "sale_generated_non_restockable"])
         .not("source_order_item_id", "is", null);

       const reservedByOrder = new Map<number, Set<number>>();
       for (const m of existingLineMovs ?? []) {
         const s = reservedByOrder.get(m.source_order_id) ?? new Set<number>();
         s.add(m.source_order_item_id);
         reservedByOrder.set(m.source_order_id, s);
       }

       // 3) líneas por order → incluir order solo si alguna línea NO tiene reserva
       const { data: candItems } = await supabase
         .from("order_items")
         .select("order_id, line_item_id")
         .in("order_id", candIds);

       const linesByOrder = new Map<number, number[]>();
       for (const li of candItems ?? []) {
         const arr = linesByOrder.get(li.order_id) ?? [];
         arr.push(li.line_item_id);
         linesByOrder.set(li.order_id, arr);
       }
       for (const oid of candIds) {
         const lines = linesByOrder.get(oid) ?? [];
         if (lines.length === 0) continue;
         const reserved = reservedByOrder.get(oid) ?? new Set<number>();
         const hasMissing = lines.some((iid) => !reserved.has(iid));
         if (hasMissing) lateOrderIds.add(oid);
       }
     }

     summary.late_confirmed_orders_found = lateOrderIds.size;
     summary.late_confirmed_order_ids = Array.from(lateOrderIds);
   }
   ```

4. **Segundo pase de paginación (mismo pipeline).**  
   Después de que termina el `while` actual, si hay `lateOrderIds`, se ejecuta un `while` paralelo idéntico salvo por:
   - No aplica `.gte/.lte("order_datetime", ...)`.
   - Aplica `.in("order_id", Array.from(lateOrderIds))`.
   - Mantiene `.in("order_status", CONFIRMED_STATUSES)`.
   - Incrementa `late_confirmed_items_checked` por cada item procesado.
   - Antes de cada `movementInserts.push(...)` de tipo `sale_generated*` originado por un order en `lateOrderIds`, incrementa `late_confirmed_movements_created`.
   - Antes de cada `pendingInserts.push(...)` para un order en `lateOrderIds`, incrementa `late_confirmed_pending_items_created`.

   Refactor mínimo: envolver el cuerpo del `while` existente en una función interna `processOrdersPage(orders, items, opts)` para reusar en ambos pases sin duplicar lógica. Alternativamente, mantener dos loops que solo difieren en la query inicial y sumar contadores con un flag `isLatePass`.

5. **Idempotencia** — sin cambios adicionales.  
   El pipeline actual ya salta las líneas con `existingReserveByLine(oid, iid)` presente (bloque en línea ~408+). Los rezagados con algunas líneas ya reservadas simplemente no generarán duplicado; solo se procesan las líneas faltantes.

6. **Dry run** — sin cambios estructurales.  
   El segundo pase respeta el mismo `dryRun`: no inserta movimientos, pending_items, runs ni auditoría. El summary sí refleja `late_confirmed_orders_found` y `late_confirmed_order_ids` en dry run.

7. **Cero cambios en:**
   - `CONFIRMED_STATUSES`, `REVERTING_STATUSES`.
   - Query normal del rango (se mantiene tal cual).
   - Lógica de resolución de costo, política, routing, movimientos, buckets.
   - Auditoría, `core_fabrication_fund_runs`.

---

### Validación esperada (34152, 34139, creados el 16/07/2026)

Con un rango `18/07 .. 19/07`:
- `late_confirmed_orders_found ≥ 2`.
- `late_confirmed_order_ids` incluye 34152 y 34139.
- Con costo válido → movimiento `sale_generated` creado (contado en `late_confirmed_movements_created`).
- Sin costo → aparece en pending_items / Requiere atención → Sin costo.
- Segunda ejecución con el mismo rango → 0 movimientos nuevos, 0 pending nuevos (idempotencia por `source_order_id + source_order_item_id + movement_type`).

---

### Detalles técnicos

- Pedidos con `order_datetime < 2026-07-16` nunca entran al set `lateOrderIds` por el `.gte("order_datetime", LATE_CONFIRMED_BASELINE)`.
- Si `periodStart` es `null` o `<= BASELINE`, el bloque de rezagados no se ejecuta (rango ya cubre desde el inicio).
- Paginación de `lateOrderIds` con `pageSize=1000` para respetar límite PostgREST en `.in(...)`.
- Typecheck al final: `deno check` no aplica en Lovable; se valida con el typecheck automático del build tras editar.

### Respuesta post-implementación (a devolver al usuario)

1. Archivo modificado.
2. Confirmación de query de rezagados.
3. `BASELINE_DATE = 2026-07-16`.
4. Cómo se bloquea `< 16/07`.
5. Cómo se evita duplicar reservas.
6. Resultado con 34152 / 34139.
7. Campos añadidos al summary.
8. Confirmación de cero migraciones / RPC / backend extra.
9. Typecheck.
