

## Diagnóstico del problema

La categorización no funciona correctamente por dos razones encadenadas:

1. **La tabla `orders` solo tiene 238 pedidos** (del 21 Feb al 24 Mar 2026), cubriendo apenas 126 clientes únicos
2. **La función `refresh_customers_order_stats()` recalcula `orders_count` usando solo la tabla `orders` local**, sobreescribiendo los valores que WooCommerce ya trae correctos

Resultado: 7,819 clientes aparecen como "Nuevos" (0 compras) cuando en realidad WooCommerce tiene su historial completo con `orders_count` y `total_spent` reales.

```text
Flujo actual (roto):
WooCommerce API → customers_cache (orders_count correcto de Woo)
                         ↓
         refresh_customers_order_stats() SOBREESCRIBE con datos
         de la tabla orders (solo 238 pedidos locales)
                         ↓
         7,819 clientes quedan con orders_count = 0
```

## Solución propuesta

**Enfoque híbrido**: usar los datos de WooCommerce como base y enriquecerlos con la tabla `orders` local solo cuando haya datos.

### Paso 1 — Modificar `refresh_customers_order_stats()`
Cambiar la función SQL para que **no sobreescriba a 0** cuando un cliente no tiene pedidos en la tabla local. Solo actualizar clientes que SÍ tienen pedidos en `orders`, y usar el mayor valor entre Woo y local:

```sql
UPDATE customers_cache cc SET
  orders_count = GREATEST(cc.orders_count, stats.cnt),
  total_spent = GREATEST(cc.total_spent, stats.spent)
FROM (SELECT customer_email, COUNT(*) cnt, SUM(...) spent FROM orders ...) stats
WHERE cc.email = stats.customer_email;
```

### Paso 2 — Modificar `woo-customers-sync`
Guardar los valores originales de WooCommerce (`c.orders_count`, `c.total_spent`) en dos nuevas columnas `woo_orders_count` y `woo_total_spent` para preservar la fuente de verdad de Woo. Luego en la lógica de upsert, usar esos valores como base para `orders_count` y `total_spent`.

### Paso 3 — Re-sincronizar
Ejecutar el sync completo (botón ↻) para que los 7,919 clientes tengan sus `orders_count` reales de WooCommerce.

### Cambios en archivos

| Archivo | Cambio |
|---------|--------|
| Migration SQL | Agregar columnas `woo_orders_count`, `woo_total_spent` a `customers_cache`. Reemplazar `refresh_customers_order_stats()` con lógica GREATEST |
| `supabase/functions/woo-customers-sync/index.ts` | Guardar `woo_orders_count`/`woo_total_spent` y usarlos como base |
| `src/pages/CRM.tsx` | Sin cambios — la lógica de filtros ya funciona correctamente sobre `orders_count` |

