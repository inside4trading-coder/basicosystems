# Canales de venta en Pedidos

Agregar visibilidad del canal de venta (`_basico_sale_channel`) en el módulo de Pedidos, con su propia pestaña, filtros por período, desglose por canal con estado de cada pedido, y un gráfico de torta.

## 1. Capturar `_basico_sale_channel` desde WooCommerce

Hoy en `supabase/functions/woo-sync/index.ts` se detecta el canal con las claves `_sale_channel`, `sale_channel` y `_created_via`. Por eso todos los pedidos en la base aparecen como `"web"`.

- Añadir `_basico_sale_channel` como la clave **prioritaria** en `extractSaleChannel`. Si no existe, caer al resto y finalmente a `"web"`.
- Normalizar el valor (trim, lowercase) para que agrupe consistentemente (`POS`, `pos`, `Pos` -> `pos`).

Como `meta_data` no se guarda en la tabla `orders`, los pedidos viejos no se pueden recalcular sin volver a sincronizar. Tras el cambio, al pulsar "Sincronizar 30d" se reescribirán los canales reales para los pedidos recientes. Para reescribir el histórico completo hace falta correr `woo-sync` con un rango más amplio (`?days=...&start_page=1`), pero eso queda fuera del alcance de esta tarea — lo dejamos disponible cuando lo necesites.

## 2. Nueva pestaña "Canales" en Pedidos

En `src/pages/Pedidos.tsx` ya existen las pestañas Dashboard / Pedidos. Añadimos una tercera: **Canales**.

```text
[Dashboard] [Pedidos] [Canales]
```

Componente nuevo: `src/components/pedidos/PedidosChannels.tsx`.

### Filtros de período (reutilizados)

Mismos cinco botones del Dashboard:
Este mes · Mes anterior · Últimos 3 meses · Este año · Todo (desde 2026).

Se extrae `periodBounds` / `PERIOD_OPTIONS` de `PedidosDashboard.tsx` a un archivo compartido (`src/components/pedidos/periodFilters.ts`) y se usa en ambos componentes.

### Resumen por canal (acordeones colapsables)

Mismo patrón visual que los buckets del Dashboard (Pago por confirmar, Listos para envío, etc.), pero agrupando por **canal de venta** detectado dinámicamente desde los pedidos del período seleccionado.

Para cada canal:
- Cabecera con: nombre del canal, número de pedidos, monto total USD, **% sobre el total del período**.
- Al desplegar: lista de pedidos del canal con número, cliente, total, fecha y **badge del estado** (mismas etiquetas/colores que ya usa la vista de Pedidos: completado, procesando, pago confirmado, enviado, etc.).
- Click en un pedido abre el detalle expandible (mismo `OrderExpandedDetails` que ya existe), o link al pedido en WooCommerce.

Los pedidos cancelados/refunded/failed se excluyen del cálculo de totales y porcentajes (igual criterio que `EXCLUDED_FROM_REVENUE` en `src/config/orderStatuses.ts`), pero pueden mostrarse si se despliega el canal.

### Gráfico de torta al final

Debajo de los acordeones, un `PieChart` (usando `recharts`, que ya está en el proyecto vía `@/components/ui/chart`) con:
- Una porción por canal.
- Tooltip con cantidad de pedidos, monto USD y porcentaje.
- Leyenda lateral con los mismos colores que el badge de cada canal.

## 3. Detalle técnico

- Query: `supabase.from("orders").select("order_id, order_number, customer_email, order_status, total_amount_usd, total_amount, order_currency, exchange_rate, order_datetime, sale_channel").gte("order_date", from).lte("order_date", to)`.
- Agrupar en cliente por `sale_channel ?? "web"` (mismo fallback que la tabla actual).
- Conversión a USD: misma helper `toUsd` que ya usa `Pedidos.tsx`.
- Colores de canal: paleta consistente generada a partir del nombre (hash -> índice en una paleta fija de tokens semánticos) para que el mismo canal tenga siempre el mismo color en lista y torta.

### Archivos afectados

- `supabase/functions/woo-sync/index.ts` — añadir `_basico_sale_channel` y normalizar.
- `src/components/pedidos/periodFilters.ts` — nuevo, helpers compartidos.
- `src/components/pedidos/PedidosDashboard.tsx` — usar helpers compartidos (refactor mínimo).
- `src/components/pedidos/PedidosChannels.tsx` — nuevo.
- `src/pages/Pedidos.tsx` — añadir tab "Canales" y montar el componente.
