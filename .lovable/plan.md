

## Análisis: Consistencia de datos del Dashboard

### Hallazgo principal

Después de analizar la base de datos y el código, **los cálculos son matemáticamente consistentes**: tanto Total Sales como la suma de Métodos de Pago usan exactamente la misma fuente de datos y los mismos filtros.

**Datos actuales del mes (Marzo 2026):**
- Total de órdenes: 246 (215 pagadas + 31 excluidas)
- Total Sales: $6,191.55
- Suma métodos de pago: $6,191.55 (idéntico)

### Cómo funciona cada KPI

| KPI | Fuente | Lógica |
|-----|--------|--------|
| **Total Sales** | `orders` filtradas por `order_date` en rango, excluyendo cancelled/failed/refunded/trash | `SUM(total_amount_usd ?? total_amount)` |
| **Pedidos** | Misma lista filtrada | `COUNT` |
| **Products Sold** | `order_items` de esos pedidos | `SUM(quantity)` |
| **Ticket Medio** | Total Sales / Pedidos | Calculado |
| **Clientes Nuevos** | Emails únicos del periodo actual que NO aparecen en el periodo anterior | Set difference |
| **Métodos de Pago** | Misma lista filtrada, agrupada por `payment_method` | `SUM(total_amount_usd)` por grupo |

### Hallazgos relevantes

1. **No hay inconsistencia numérica real** — ambas métricas iteran el mismo array `paid` con la misma función `getUsd()`. La suma de las partes siempre iguala el total.

2. **80 órdenes tienen `payment_method = NULL`** — aparecen como "Otro" en el gráfico con $1,431.39. Esto no causa inconsistencia pero sí dificulta el análisis de métodos de pago.

3. **5 órdenes `yith_pos_cash_gateway` tienen total = $0** — probablemente aperturas/cierres de caja POS. Inflan el conteo de pedidos sin aportar revenue.

4. **Si la percepción de inconsistencia viene de comparar en distintos momentos**, es porque la fecha `end` es `new Date()` (ahora), y cada carga del dashboard puede incluir órdenes nuevas.

### Propuesta de mejoras

**1. Resolver los 80 pedidos sin método de pago** 
Consultar la tabla `payments` para enriquecer `orders.payment_method` cuando es NULL. O usar la tabla `payments` directamente para el gráfico de métodos de pago, ya que ahí se registra el método real por cada pago.

**2. Excluir órdenes POS de total $0**
Filtrar órdenes con `total_amount_usd = 0` (o `total_amount = 0`) del conteo de pedidos y del gráfico de métodos de pago, ya que no son ventas reales.

**3. Mostrar total en el gráfico de métodos de pago**
Agregar una fila "Total" al final de la leyenda del pie chart para que el usuario pueda verificar visualmente que coincide con Total Sales.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useDashboardData.ts` | Usar tabla `payments` para desglose por método de pago. Filtrar órdenes $0 del conteo. |
| `src/pages/Dashboard.tsx` | Agregar total en leyenda del pie chart |

