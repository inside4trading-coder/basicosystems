# Diagnóstico solo lectura — ¿Partidas baja al crear/producir OP?

## Respuestas directas

1. ¿La partida baja hoy al crear una OP? **No.**
2. ¿La partida baja hoy al ingresar prendas a inventario? **No** (no hay movimiento financiero; el ingreso solo afecta stock Woo y estado de la unidad).
3. ¿Existe algún movement_type de consumo/descuento productivo? **No.**
4. ¿El total actual es acumulado histórico o disponible real? **Acumulado histórico** de reservas por ventas (menos reversiones y ajustes manuales). No descuenta producción.
5. ¿Dónde se calcula? En el frontend, `src/pages/core/CoreFabricationFunds.tsx` (memo `totals`, líneas ~210-266, y `partidaCards`, ~269-283). No hay RPC de cálculo.

## Evidencia verificada

**Tipos de movimiento permitidos** (CHECK de `core_fabrication_fund_movements`):
`sale_generated`, `sale_generated_non_restockable`, `manual_increase`, `manual_decrease`, `transfer`, `reversal`, `close`, `correction`, `replacement_cost_adjustment`, `replacement_reclassification_out`, `replacement_reclassification_in`, `external_supplier_payment`.

No existe ninguno de: `production_order_created`, `production_allocated`, `production_consumed`, `inventory_entered`, `stock_increase`, `fabrication_consumption`, `reserve_consumed`, `order_converted`, `need_converted`. La constraint los rechazaría si se intentaran insertar.

**Datos reales hoy** (agrupado por tipo/bucket/estado):

```text
replacement_cost_adjustment       internal_factory   posted        4      2.87
replacement_reclassification_in   non_restockable    posted       14    115.04
replacement_reclassification_out  internal_factory   posted       14   -115.04
reversal                          external_supplier  posted        1     -3.40
sale_generated                    external_supplier  posted        3     11.78
sale_generated                    external_supplier  reversed      1      3.40
sale_generated                    internal_factory   posted      120    952.70
```

Saldos en `core_fabrication_funds`: general 840.52 · no restockeable 115.04 · pendiente 0 · proveedores externos 11.78.
Todo lo que sube viene de ventas (`sale_generated`); lo único que baja son reversiones de ventas, reclasificaciones entre buckets, pagos a proveedor externo y ajustes manuales.

**Relación OP ↔ fondos:** ninguna. `core_fabrication_fund_movements` no tiene `production_order_id` ni `production_need_id`. `core_production_orders`, `core_production_needs` y `core_production_units` no tienen ninguna columna de tipo `amount / cost / fund / reserved / allocated`. OP-000010, OP-000011 y OP-000012 no generaron movimiento financiero alguno: existen solo como producción.

**Ingreso a inventario:** `core-woo-stock-write` no toca `core_fabrication_fund*`; `core-create-production-order` tampoco.

**Fórmula del resumen (frontend):**
- "Disponible total para fabricar" = `funds.general.available_amount + funds.non_restockable.available_amount` → saldo acumulado de los fondos, sin restar producción.
- "Partida generada" = suma de movimientos `sale_generated*` posted.
- "Ejecutado en inventario" = estimación **solo visual**: empareja por SKU los movimientos de venta más antiguos con unidades en estado `entered_inventory` (no lee ningún movimiento financiero).
- "Disponible sin asignar" = `generado - ejecutado`, clamp a >= 0. También solo visual: no coincide con `available_amount` ni descuenta OP abiertas.

Es decir, la respuesta a la pregunta 5 del pedido es **A**: `disponible_total = suma de reservas acumuladas`.

## Recomendación mínima (sin implementar)

Opción de menor riesgo, en dos pasos separables:

1. **Corto plazo (solo UI, cero backend):** renombrar la card a "Partida acumulada (reservas)" y mostrar debajo, como dato derivado, "Comprometido en producción" y "Disponible estimado" usando el mismo emparejamiento por SKU que ya existe, extendido a unidades en OP abiertas además de `entered_inventory`. Aclara la lectura sin cambiar dinero.
2. **Mediano plazo (backend real):** agregar al CHECK dos tipos, `production_allocated` (al crear la OP, negativo, reservando) y `production_consumed` (al ingresar la unidad a inventario, convirtiendo la reserva en gasto), más columnas `production_order_id` y `production_unit_id` en `core_fabrication_fund_movements`, con clave de idempotencia por unidad. Recién ahí `available_amount` pasaría a ser disponible real y valdría la fórmula B.

No conviene mezclar ambos pasos: el 2 requiere definir qué pasa con las OP y unidades ya existentes (backfill o baseline desde una fecha) antes de tocar saldos.
