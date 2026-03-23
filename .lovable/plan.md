

# Dashboard Ejecutivo + Pedidos — Plan de Implementación

## Análisis de la API de WooCommerce

Campos disponibles directamente por pedido en `/wc/v3/orders`:

| Campo solicitado | Disponible en WC API | Notas |
|---|---|---|
| order_id, order_number, status, date | Si | Directo |
| subtotal, discount, shipping, tax, total | Si | `discount_total`, `shipping_total`, `total_tax`, `total` |
| currency | Si | Campo `currency` |
| billing_state, customer_email, phone | Si | En objeto `billing` |
| payment_method | Si | `payment_method_title` |
| line_items (sku, name, qty, price, total) | Si | Incluye `sku`, `variation_id` |
| size, color (variaciones) | Si | En `line_items[].meta_data[]` como atributos de variación |
| sale_channel | Parcial | No es estándar; podría estar en `meta_data` si hay plugin. Default: "web" |
| exchange_rate / total_amount_usd | No | Requiere API externa o configuración manual |
| payment_bank, payment_reference, payment_slot | No estándar | Depende de plugins de pago; se puede extraer de `meta_data` si existe |
| item_cost | No | Requiere tabla `product_costs` con CSV manual |
| analytic_category | No | Requiere mapeo manual por SKU/producto |

## Arquitectura

```text
WooCommerce API
      │
      ▼
[Edge Function: woo-sync]  ──►  Supabase DB
  (sync periódico)                  │
                                    ├── orders
                                    ├── order_items
                                    ├── payments
                                    └── product_costs (CSV upload)
                                    │
                                    ▼
                              [Frontend]
                           Dashboard + Pedidos
                         (queries directas a DB)
```

## Paso 1 — Crear tablas en Supabase

**Tabla `orders`**
- order_id (bigint PK), order_number (text), order_datetime (timestamptz), order_date (date), order_status (text), sale_channel (text default 'web'), billing_state (text), subtotal_amount (numeric), discount_amount (numeric), shipping_amount (numeric), tax_amount (numeric), refunded_amount (numeric), total_amount (numeric), total_amount_usd (numeric nullable), exchange_rate (numeric nullable), order_currency (text), customer_email (text), customer_phone (text), synced_at (timestamptz)

**Tabla `order_items`**
- id (uuid PK), order_id (bigint FK→orders), line_item_id (bigint), sku (text), parent_sku (text nullable), product_name (text), quantity (integer), unit_price (numeric), line_total (numeric), item_cost (numeric nullable — joined from product_costs), size (text nullable), color (text nullable), analytic_category (text nullable — superior/inferior/accesorios)

**Tabla `payments`**
- id (uuid PK), order_id (bigint FK→orders), payment_slot (integer default 1), payment_method (text), payment_bank (text nullable), payment_amount (numeric), payment_currency (text), payment_reference (text nullable)

**Tabla `product_costs`** (ya definida en los requerimientos)
- sku (text PK), product_name (text), analytic_category (text — check: superior/inferior/accesorios), collection (text nullable), unit_cost_total (numeric), suggested_price (numeric nullable), updated_at (timestamptz default now())

RLS: lectura para admin y manager (usando `has_role`). Partner solo lectura de orders y order_items.

## Paso 2 — Edge Function `woo-sync`

Nueva función que:
1. Recibe parámetro `since` (fecha) o sincroniza últimos 30 días por defecto
2. Pagina sobre `/wc/v3/orders` (100 por página, status=any)
3. Por cada pedido, extrae y hace UPSERT en `orders`
4. Extrae `line_items` con variaciones (size/color de `meta_data`), hace UPSERT en `order_items`
5. Extrae payment info → UPSERT en `payments` (1 registro por pedido; si hay meta_data de pagos mixtos, múltiples)
6. Hace JOIN con `product_costs` para llenar `analytic_category` y `item_cost` cuando exista match por SKU
7. `sale_channel`: busca en `meta_data` del pedido; si no existe, default "web"
8. `exchange_rate` y `total_amount_usd`: se deja nullable; opcionalmente configurable después

## Paso 3 — Dashboard Ejecutivo (reescritura completa)

El dashboard consultará directamente la DB en lugar de la API de WooCommerce en tiempo real. Componentes:

**KPIs principales** (con % cambio vs período anterior):
- Revenue total, Total pedidos, Ticket medio, Clientes nuevos

**Gráficos y análisis**:
- Revenue diario (bar chart)
- Revenue por estado/región (bar chart horizontal)
- Revenue por método de pago (donut/pie)
- Top 10 productos por unidades vendidas (ranking)
- Top categorías analíticas (superior/inferior/accesorios — bar chart)
- Distribución por hora del día (bar chart — comportamiento horario)
- Distribución por estado de pedido (badges + counts)
- Alertas de stock bajo (se mantiene)

**Filtros**: Período (Hoy, Semana, Mes, Año, Custom), con selector de fechas.

**Selector de moneda**: USD como default. Si `total_amount_usd` está disponible, usar ese; si no, `total_amount`.

## Paso 4 — Pedidos (reescritura)

Ahora lee desde la tabla `orders` + `order_items` en Supabase en lugar de llamar a WooCommerce en tiempo real:
- Tabla con todas las columnas relevantes
- Detalle expandible por pedido mostrando line items con SKU, size, color, categoría
- Filtros por: estado, canal, método de pago, rango de fechas
- Búsqueda por número de pedido, email, nombre
- Paginación server-side via Supabase queries

## Paso 5 — Upload de costos (en Configuración)

Agregar sección en la página de Configuración para:
- Subir CSV con columnas: sku, product_name, analytic_category, collection, unit_cost_total, suggested_price
- Previsualizar datos antes de importar
- UPSERT en tabla `product_costs`
- Después del upload, los `order_items` se actualizan automáticamente con `item_cost` y `analytic_category` vía un trigger o la próxima sincronización

## Paso 6 — Botón de sincronización manual

En el Dashboard, un botón "Sincronizar datos" que invoca `woo-sync`. También se puede configurar un cron después.

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| Migration SQL | Crear tablas orders, order_items, payments, product_costs + RLS |
| `supabase/functions/woo-sync/index.ts` | Nueva función de sincronización |
| `src/pages/Dashboard.tsx` | Reescritura completa con analytics desde DB |
| `src/pages/Pedidos.tsx` | Reescritura para leer desde DB |
| `src/pages/Configuracion.tsx` | Agregar sección upload CSV de costos |
| Componentes de charts | Nuevos componentes reutilizables para los gráficos |

## Limitaciones a comunicar

- **exchange_rate / total_amount_usd**: WooCommerce no provee tipo de cambio. Se puede agregar manualmente o integrar una API de tasas después.
- **payment_bank / payment_reference**: Solo disponible si el plugin de pagos de la tienda guarda estos datos en `meta_data`. Se extraerá lo que exista.
- **analytic_category**: Requiere que se suba el CSV de costos para mapear SKUs a categorías. Sin CSV, este campo queda vacío.
- **sale_channel**: Si no hay plugin multicanal, todos los pedidos serán "web".

