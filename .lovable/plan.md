

## Objetivo

Cruzar el CSV de pedidos de abril (`257 filas-item / ~140 pedidos`) con `orders` + `order_items` de la BD para detectar inconsistencias de datos.

## Hallazgos preliminares (ya detectados en la inspección)

Comparando primeros pedidos del CSV vs BD:

| # Pedido | CSV (canal) | BD (canal) | CSV (canal real) | Problema |
|---|---|---|---|---|
| BA16420 | Pop Up Barquicenter | **web** | POS físico | `sale_channel` mal clasificado en BD |
| BA16419 | Pop Up Barquicenter | **web** | POS físico | Igual |
| BA16422 | MercadoLibre | **web** | ML | Igual |
| BA16421 | Web | web | OK | OK |

**Otra alerta**: BD reporta **140 pedidos con 140 items** en abril (1:1), lo cual es imposible — varios pedidos del CSV tienen 2-3 items (BA16423, BA16419, BA16412, BA16404, BA16399, BA16397, BA16393…). Sospecha: la sync de `order_items` está perdiendo líneas o sobreescribiendo.

Además: 3 pedidos sin `total_amount_usd` ni `exchange_rate` en BD.

## Qué voy a hacer (en modo default)

1. **Copiar el CSV** al sandbox y parsearlo con DuckDB/Python (delimitador `,`, decimal `,`, comillas, normalizar `&#8211;` → `–`).
2. **Agregar a nivel pedido** desde el CSV: número, fecha, estado, canal, total, items_count, suma de SKUs.
3. **Exportar `orders` + `order_items` de abril** desde Supabase con un SELECT amplio.
4. **Cruzar por `order_number`** y producir un reporte CSV en `/mnt/documents/abril_incoherencias.csv` con estas categorías de incoherencia:

   - **Pedidos solo en CSV** (faltantes en BD)
   - **Pedidos solo en BD** (no exportados por Woo, posibles duplicados/borrados)
   - **Diferencia de canal** (CSV vs `sale_channel` BD) — caso crítico ya visto
   - **Diferencia de estado** (mapping de slugs `SLUG_TO_CANONICAL` vs canónico del CSV)
   - **Diferencia de monto total** (>0.01)
   - **Diferencia de items_count** (CSV vs `order_items` BD) — caso crítico ya visto
   - **SKUs faltantes/extra** por pedido
   - **Diferencia de exchange_rate o currency**
   - **`total_amount_usd` nulo** cuando el CSV sí trae monto USD

5. **Reporte en pantalla** con resumen por categoría (counts) + top 20 ejemplos de cada tipo + el CSV completo descargable.

## Salida esperada

- Resumen en chat con conteos por tipo de incoherencia y los casos más graves listados.
- `/mnt/documents/abril_incoherencias.csv` — reporte completo descargable, una fila por pedido con columnas `order_number, tipo_incoherencia, valor_csv, valor_bd, detalle`.
- Recomendación de qué arreglar en el sync de Woo (probablemente: mapeo de canal POS/ML, y la lógica de inserción de `order_items` que está perdiendo filas).

## Sin cambios de código en este paso

Solo análisis y reporte. Cualquier fix al edge function `woo-sync` se propondría después según los hallazgos.

