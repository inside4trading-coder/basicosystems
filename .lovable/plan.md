# Plan — Corrida real de Partidas de Fabricación (25/05/2026)

## Objetivo
Ejecutar el procesamiento real de la edge function `core-process-fabrication-funds` sobre las ventas confirmadas del **25/05/2026** y validar el resultado con datos reales, sin crear estructuras de costo previamente. Esperamos que los 9 ítems caigan en Pendientes (no hay estructuras todavía) y usar eso para validar todo el flujo de resolución.

No se modifica código en este paso. Solo ejecutar + diagnosticar.

## Pasos

1. **Verificar estado pre-corrida**
   - Confirmar en BD que no hay movimientos previos para órdenes del 25/05 en `core_fabrication_fund_movements` (idempotencia).
   - Contar pendientes existentes (`core_fabrication_fund_pending_items` con `status='pending'`) como baseline.
   - Confirmar que las 9 órdenes/ítems del 25/05 están sincronizadas en `orders` + `order_items`.

2. **Ejecutar la edge function en modo real**
   - Invocar `core-process-fabrication-funds` con rango `from=2026-05-25` / `to=2026-05-25` (modo normal, no `reprocess_pending`).
   - Capturar el response: `orders_checked`, `items_checked`, `movements_created`, `pending_items_created`, `reversals_created`, `by_reason`, `fabrication_fund_run_id`.

3. **Diagnóstico del run**
   - Leer el run desde `core_fabrication_fund_runs` por `id` devuelto.
   - Verificar que `movements_created = 0` (no hay estructuras) y `pending_items_created = 9`.
   - Validar que el `by_reason` desglose sea coherente (esperado: 9 × `product_not_in_core` o `variation_not_mapped`).

4. **Validación de pendientes generados**
   - Query a `core_fabrication_fund_pending_items` filtrado por el `fabrication_fund_run_id`.
   - Para cada uno de los 9 ítems verificar:
     - `woo_sku`, `woo_product_id`, `woo_variation_id`, `product_name`, `quantity`, `revenue` (USD) correctos.
     - `reason` coherente con el ítem (todos sin Producto Core asociado).
     - `status='pending'`, sin `linked_core_product_id`.
   - Verificar logs de la edge function por errores silenciosos.

5. **Validación de reversos**
   - Confirmar que `reversals_created = 0` (no había movimientos previos que revertir).

6. **Verificación en UI**
   - Confirmar que la pestaña Resumen muestra: 9 pendientes históricos / 9 del último run / 9 del rango / revenue pendiente del rango = suma esperada (~$162).
   - Confirmar que la pestaña Pendientes muestra los 9 con badges de motivo correctos y acciones disponibles.

7. **Entregable**
   - Tabla resumen con: SKU vendido · Woo Product ID · Variation ID · cantidad · revenue · motivo detectado · ID del pending item.
   - Diagnóstico final: ¿el sistema se comportó como debe? Confirmar antes de avanzar al siguiente bloque (resolución de pendientes vía UI).

## No se hace en este plan
- No crear las 9 Estructuras de Costo (decisión: procesar en seco primero).
- No resolver pendientes todavía (eso es el siguiente bloque).
- No modificar edge function ni UI.
- No agregar `variant_cost_override`.

## Detalles técnicos
- Herramientas a usar: `supabase--curl_edge_functions` para invocar, `supabase--read_query` para validar BD, `supabase--edge_function_logs` si algo falla.
- La idempotencia está garantizada por el unique index `(source_order_id, source_order_item_id, movement_type)`, así que se puede re-ejecutar sin duplicar.
