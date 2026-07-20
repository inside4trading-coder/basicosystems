# Conciliación Woo vs Partidas — herramienta read-only (v3)

## Objetivo
Añadir en `/core/partidas-fabricacion` una acción **"Conciliar rango"** que compare las ventas Woo del rango con lo que las Partidas registraron. 100% read-only: solo `select`. Cero `insert/update/upsert/delete/rpc/invoke`, cero migraciones, cero RPC, cero tablas nuevas.

## Archivos
- `src/pages/core/CoreFabricationFunds.tsx` — botón "Conciliar rango", dialog con resumen, filtros y tabla.
- `src/lib/coreReconciliation.ts` (**nuevo**) — helpers puros: constantes de status, detección shipping/fee, clasificación por línea, CSV, conversión VE↔UTC.

## UX
1. Botón **"Conciliar rango"** junto a "Procesar ventas confirmadas". Usa el `periodStart`/`periodEnd` ya existentes.
2. `Dialog` grande con:
   - **Rango VE** (`DD/MM/YYYY 00:00 → DD/MM/YYYY 23:59`) y **Rango UTC** (VE = UTC-4).
   - Aviso si abarca >1 día: "Este rango incluye X días. Para comparar con Woo, exporta exactamente el mismo rango."
   - Nota: "Antes de conciliar o procesar, sincroniza Woo para incluir pedidos recientes."
   - Cards resumen (11 métricas).
   - Filtros: Todos / Movimientos / Pendientes / Sin costo / Sin mapeo / Excluidos / Rezagados / Diferencias.
   - Tabla: Pedido, Fecha VE, Status Woo, SKU, Producto, Woo product/variation, Qty, Resultado Hub, Costo, Monto, Partida/bucket, Motivo. Badge "Rezagado confirmado" cuando aplique.
   - Botón **"Exportar conciliación Hub"** → CSV de las filas visibles.

## Datos (solo `select`, paginados en bloques de 1000)

Al abrir (React Query, `enabled: open`, key `["reconciliation", from, to]`):

1. **Pedidos del rango** — `orders` con `order_datetime BETWEEN periodStart AND periodEnd`. Sin filtrar por `order_status` — la clasificación decide después. Paginar con `.range()`.
2. **Rezagados confirmados** — `orders` con `order_status IN CONFIRMED_STATUSES` + `order_datetime >= "2026-07-16"` + `order_datetime < periodStart`. Después, en cliente, descartar los que ya tengan movimiento `sale_generated*` en todas sus líneas.
3. **`order_items`** por `order_id IN (...)` unión de ambos sets. Chunks de ~200 IDs en `.in()`, paginado con `.range()`. Solo se seleccionan columnas conocidas existentes; **no se pide `type`** (heurística por nombre/SKU).
4. **`core_fabrication_fund_movements`** por `source_order_id IN (...)` con `movement_type IN ('sale_generated','sale_generated_non_restockable')`, paginado.
5. **`core_fabrication_fund_pending_items`** por `source_order_id IN (...)`, paginado. Activo = `status NOT IN {resolved, ignored, completed, cancelled}`.

**No** se consulta `core_replenishment_policy_events` en esta versión.

## Clasificación por línea — `Resultado Hub` (primer match gana)
1. **Delivery/envío/fee** → `Excluido: delivery/envío`. Prioridad máxima, aunque haya movimiento o status confirmado. Detección **solo por heurística de nombre/SKU** `/env[ií]o|shipping|delivery|fee/i` (no se lee columna `type`).
2. **Movimiento existe** → `Ya reservado` (muestra `amount`, `unit_cost_snapshot`, `fund_bucket`, `movement_type`).
3. **Pending activo** → según `reason`:
   - `unit_cost_missing` / `missing_cost` → `Pendiente sin costo`
   - `variation_not_mapped` / `product_not_mapped` → `Pendiente sin mapeo`
   - `pending_classification` → `Pendiente de clasificación`
4. **`order_status ∉ CONFIRMED_STATUSES`** → `Excluido por status` (cubre `cancelled`, `refunded`, `failed`, `on-hold`, `pending`, etc.).
5. Sin match → `No procesado`.

Badge extra **"Rezagado confirmado"** cuando el `order_id` está en el set de rezagados.

Comparación siempre por `(source_order_id, source_order_item_id)`.

## Constantes en `coreReconciliation.ts`
- `CONFIRMED_STATUSES` y `REVERTING_STATUSES` copiadas 1:1 del edge function.
- `BASELINE = "2026-07-16"`.
- `CLOSED_PENDING_STATUSES = new Set(["resolved","ignored","completed","cancelled"])`.
- Columna real de status en `orders`: **`order_status`** (no `status`).

## CSV
Serializa las filas visibles (post-filtro). Blob + `URL.createObjectURL`. Nombre `conciliacion-hub_<from>_<to>.csv`.

## Rango UTC
VE = UTC-4 fijo. `00:00 VE = 04:00 UTC`; `23:59 VE = (día+1) 03:59 UTC`. Inline, sin librerías.

## Fuera de alcance
No procesa ventas, no crea movimientos/pending/eventos, no toca fondos, Woo, stock, OP, QR, nómina. No hay migraciones, RPC, tablas ni edge functions nuevas. No se invoca ningún edge function.

## Checklist de respuesta al terminar
1. Archivos modificados.  2. Botón "Conciliar rango".  3. Rango VE y UTC.  4. `CONFIRMED_STATUSES` reales.  5. Rezagados desde 2026-07-16.  6. Delivery/envío excluido con prioridad máxima (heurística por nombre/SKU, sin `type`).  7. Uso de `order_status` (no `status`).  8. Comparación por `order_id + line_item_id`.  9. Resumen + tabla + filtros.  10. CSV exporta filas visibles.  11. Cero escrituras (solo `select`).  12. Sin consulta a `core_replenishment_policy_events`.  13. Typecheck.
