## BLOQUE 1A (final aprobado) — Reserva financiera separada de política operativa

### Alcance
- `supabase/functions/core-process-fabrication-funds/index.ts`
- `core_fabrication_fund_movements` (schema)
- `core_fabrication_funds` (CHECK + 1 fila)
- 1 sola migración

Sin cambios en UI, en `route_core_replenishment_candidate`, en `resolve_core_operational_unit_cost`, en Necesidades, ni en Woo/OP/QR/nómina.

### Movimiento de venta unificado
- Nuevas reservas: `movement_type = 'sale_generated'`.
- Idempotencia considera también `'sale_generated_non_restockable'` (histórico).
- Movimientos históricos no se tocan.

### Publicación atómica de la reserva (protección 1)

Se **reutiliza el mecanismo actual** del archivo, que ya publica el movimiento y actualiza el saldo del fondo en el mismo flujo (`movementInserts` + `fundDeltas` aplicados juntos al final del run dentro de la misma vía de escritura). No se cambia esa mecánica; solo se añade `fund_bucket` al payload del movimiento y se mapea el `fund_id` según el bucket. Si en el archivo existiera un helper/RPC transaccional (`post_fund_movement`, `apply_fund_movement`, etc.), se reutiliza en su lugar; jamás dos operaciones independientes desacopladas nuevas.

### Separación reserva ↔ enrutamiento operativo

Por línea Woo confirmada:

1. Resolver identidad Woo/Core (permitir `core_product_id` null si hay `woo_product_id`).
2. Resolver costo con `resolve_core_operational_unit_cost`. Sin costo > 0 → `queuePending('unit_cost_missing')` y continuar.
3. `routeReplenishment(dry_run: true)` para leer `replenishment_route`, `route_action`, `allow_internal_need`, política efectiva.
4. Calcular `fund_bucket`:
   - `replenishment_route='external_supplier'` → `external_supplier`
   - `replenishment_route='internal_factory'` → `internal_factory`
   - sin ruta + `core_product_id` resuelto → `internal_factory`
   - resto → `pending_classification`
   `lifecycle_status` y `route_action` no influyen.
5. **Reserva financiera idempotente**:
   - Buscar existente por `(source_order_id, source_order_item_id, movement_type IN ('sale_generated','sale_generated_non_restockable'))`.
   - Si existe → `financial_reserve_status='existing'`, `movementId = existing.id`; **no** insertar; **no** sumar delta.
   - Si no existe → publicar atómicamente vía el mecanismo actual: movimiento `sale_generated` + delta al fondo mapeado; `financial_reserve_status='created'`, `movementId = new.id`.
6. **Enrutamiento operativo real (SIEMPRE)** — incluso cuando la reserva ya existía:
   ```
   routeReplenishment({
     source_type: 'fabrication_fund_movement',
     source_key: `fabrication_fund_movement:${movementId}`,
     source_id: movementId,   // uuid del movimiento (nuevo o existente)
     product, variant,
     woo_product_id, woo_variation_id,
     woo_order_id, woo_order_item_id,
     quantity, unit_cost, amount, cost_source,
     dry_run: false,
   })
   ```
   Nunca `source_id = order_id | order_item_id | uuid aleatorio | null`. `dedupe_key` del motor garantiza reconciliación sin duplicar. Para `internal_factory` `allow_internal_need` sigue rigiendo la necesidad interna, sin duplicar.

### Snapshots financieros inmutables (protección 2)

Cuando la reserva **ya existía**, para el paso 6 se usan los snapshots del movimiento existente:
- `quantity = existing.quantity`
- `unit_cost = existing.unit_cost_snapshot`
- `amount = existing.amount`
- `fund_bucket = existing.fund_bucket` (si null en histórico, se preserva y no se sobrescribe la fila)
- identidad Woo/Core la del existente cuando esté; si falta, se completa desde la línea Woo solo para el evento, sin modificar el movimiento.

La política operativa sí se re-resuelve para crear/reconciliar el evento correcto, pero **nunca** se modifica el movimiento original ni su costo/monto/fund_bucket. Un cambio posterior de costo no altera la base financiera del Bloque 2.

Cuando la reserva **es nueva**, el evento se emite con los valores recién calculados y persistidos en el movimiento (`quantity`, `unit_cost`, `amount`, `fund_bucket`), asegurando coherencia 1:1.

### Contenido del movimiento (solo nuevos)
Igual al actual + `fund_bucket` columna + en `cost_snapshot_data`: `cost_source`, `policy_id`, `policy_action`, `replenishment_route`, `lifecycle_status`, `fund_bucket`, resolvers Woo/Core, `warning`.

### Fondos (`core_fabrication_funds`)
Mapeo bucket→fondo USD resuelto una vez al iniciar el run:
- `internal_factory` → `fund_type='general'`, `core_product_id IS NULL` (existe).
- `pending_classification` → `fund_type='pending'`, `core_product_id IS NULL` (existe, sin movimientos).
- `external_supplier` → `fund_type='external_supplier'`, `core_product_id IS NULL` (creado en migración).

Faltante cualquiera → `error: missing_base_funds`. Fondo `non_restockable` histórico queda solo-lectura para históricos.

### Identidad Woo sin Core
`core_product_id` y `core_variant_id` ya son nullable. La migración no toca esas columnas.

### Migración única
```sql
-- 1) fund_bucket
ALTER TABLE public.core_fabrication_fund_movements
  ADD COLUMN IF NOT EXISTS fund_bucket text;
CREATE INDEX IF NOT EXISTS core_fab_fund_mov_fund_bucket_idx
  ON public.core_fabrication_fund_movements(fund_bucket);

-- 2) ampliar CHECK fund_type
ALTER TABLE public.core_fabrication_funds
  DROP CONSTRAINT IF EXISTS core_fabrication_funds_fund_type_check;
ALTER TABLE public.core_fabrication_funds
  ADD CONSTRAINT core_fabrication_funds_fund_type_check
  CHECK (fund_type IN ('general','non_restockable','product_specific','replacement','pending','external_supplier'));

-- 3) fondo externo USD idempotente
INSERT INTO public.core_fabrication_funds (fund_type, name, currency, available_amount, status)
SELECT 'external_supplier', 'Proveedores externos USD', 'USD', 0, 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.core_fabrication_funds
   WHERE fund_type='external_supplier' AND currency='USD' AND core_product_id IS NULL
);
```
Sin GRANT/RLS nuevos.

### Dry run
`body.dry_run = true` → resoluciones + `routeReplenishment(dry_run:true)`, cero inserts/updates en movements, funds, pending, runs, events, auditoría. Devuelve `summary` proyectado.

### Validación (post-deploy, `read_query`)
1. `internal_factory` con costo → 1 movimiento `fund_bucket='internal_factory'` en fondo general + evento con `source_id=movement.id`.
2. `no_restock` interno → 1 movimiento `internal_factory`, sin `core_production_needs`, evento `block_no_restock` vinculado.
3. `replaced` interno → 1 movimiento `internal_factory` + `suggest_replacement` vinculado, sin necesidad.
4. `external_supplier` → 1 movimiento `external_supplier` en fondo externo + `external_supplier_review` vinculado, sin necesidad.
5. Reejecución → 0 movimientos nuevos, 0 delta a fondos, eventos reconciliados sin duplicar (dedupe_key).

### Fuera de alcance
Ajustes por reemplazo, diferencias, reclasificación entre partidas, cambios en Necesidades, alerta roja, nuevos tipos de eventos, Woo, stock, OP, QR, nómina, UI. Cero cambios en históricos.

### Entregable
- 1 migración (columna + CHECK + fondo externo).
- 1 archivo modificado: `supabase/functions/core-process-fabrication-funds/index.ts`.
- Typecheck OK.
- Reporte con archivo, columna añadida, fondos usados y resultado de los 5 casos.
