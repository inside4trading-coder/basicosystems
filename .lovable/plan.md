

## Plan: Auditoría de inconsistencias entre WordPress export y datos en Lovable

### Contexto
Tienes un export de WooCommerce con todas las órdenes desde el 1 de abril hasta hoy. El objetivo es comparar contra la BD de Lovable y encontrar dónde divergen **Total Sales**, **Pedidos** y **Products Sold**.

### Lo que voy a hacer (en modo default)

**1. Leer el .xlsx con DuckDB**
- Extraer columnas clave: `order_id`, `order_date`, `status`, `total`, `items_count`/line_items.
- Filtrar al rango 2026-04-01 → hoy.
- Normalizar status (los que vienen en el export podrían ser etiquetas largas en español, no slugs).

**2. Calcular agregados de WordPress** (la "verdad de WooCommerce"):
- `WP_total_orders` = conteo de órdenes válidas (aplicando `isValidOrder` sobre la etiqueta del export).
- `WP_total_sales` = suma de `total`, excluyendo `EXCLUDED_FROM_REVENUE`.
- `WP_products_sold` = suma de `quantity` de line items en órdenes válidas.

**3. Calcular los mismos agregados en Lovable** (mismo rango de fechas):
```sql
SELECT order_id, order_status, total_amount, total_amount_usd, order_date
FROM orders WHERE order_date >= '2026-04-01';
SELECT order_id, quantity FROM order_items WHERE order_id IN (...);
```
- Aplicar `isValidOrder(status)` y `isExcludedFromRevenue(status)` igual que en el dashboard.

**4. Comparar y diagnosticar**
Construir 3 deltas:
- **Δ Total Sales**: WP vs Lovable. Posibles causas:
  - Conversión a USD mal aplicada (Lovable estandariza a USD, WP probablemente reporta en moneda original).
  - Órdenes que en WP están en estado válido pero el slug de la BD no está en `SLUG_TO_CANONICAL` (ej. `en-fabricacion`) → quedan como "no válidas" en Lovable.
  - Órdenes con `total_amount_usd = NULL` filtradas por el dashboard.
- **Δ Pedidos**: misma raíz — slugs no mapeados o filtros adicionales (USD>0, VES roto) en `useDashboardData`.
- **Δ Products Sold**: 
  - El dashboard cuenta sobre `order_items` filtrados por órdenes válidas. Si una orden válida en WP no se cuenta en Lovable, sus items tampoco.
  - Posible falta de sincronización de items para órdenes recientes.

**5. Identificar específicamente las órdenes faltantes/divergentes**
- `LEFT JOIN` para encontrar órdenes en WP que no están en `orders` (o viceversa).
- Listar slugs de status presentes en Lovable que NO están en `SLUG_TO_CANONICAL` → esos son "fugas" silenciosas.
- Listar órdenes con `total_amount_usd IS NULL` en el rango.

### Entregable
Un reporte conciso en chat con:
1. Tres números lado a lado (WP vs Lovable) con su delta absoluto y %.
2. La causa raíz de cada delta (con conteos y ejemplos de órdenes).
3. Recomendación de fix (mapeo nuevo, re-sync, o ajuste de filtros en `useDashboardData`).

**No se modifica código en este paso** — primero auditamos, luego decides qué arreglar.

