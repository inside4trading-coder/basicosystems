
## Diagnóstico

El problema no es el límite local de 1000 por batch en sí. Ese batch está bien pensado.

Lo que sí está fallando es esto:
- La primera llamada a `woo-sync?full=true&start_page=1&max_pages=10` trae **1000 pedidos** y responde `next_page: 11`.
- La segunda llamada (`start_page=11`) devuelve **`total_pages: 1`, `total_fetched: 0`, `next_page: null`**.
- En `supabase/functions/woo-sync/index.ts`, cuando Woo devuelve un payload no-array o un error de paginación, la función lo interpreta como “ya terminé” en vez de marcarlo como error/retry.

Resultado:
- el histórico se corta tras los primeros 1000 pedidos
- `refresh_customers_order_stats()` recalcula con histórico incompleto
- CRM y Campaigns siguen viendo `orders_count` subestimado o en 0 para muchos clientes

## Qué voy a corregir

### 1. Hacer robusta la paginación del edge function
Actualizar `supabase/functions/woo-sync/index.ts` para que:
- valide explícitamente la respuesta de Woo
- detecte respuestas de error/página inválida
- no convierta un error en `next_page: null`
- devuelva un estado claro tipo:
  - `success`
  - `next_page`
  - `has_more`
  - `reached_end`
  - `source_error` cuando Woo responda mal

### 2. Dejar de depender solo de `X-WP-TotalPages`
Woo parece devolver metadatos inconsistentes a partir de cierto punto. Voy a cambiar la lógica para terminar el histórico por una condición más segura:
- seguir mientras la respuesta traiga pedidos
- considerar fin real cuando el lote venga vacío de forma válida
- si Woo devuelve error estructurado, abortar con mensaje claro y sin “cerrar” el histórico falsamente

### 3. Reducir el riesgo de corte por lote
El batch actual son 10 páginas = 1000 pedidos.
Voy a bajarlo y hacerlo más conservador:
- usar lotes más pequeños para histórico
- opcionalmente permitir ajuste simple del chunk desde cliente
Esto reduce probabilidad de respuestas inconsistentes o timeouts intermedios.

### 4. Mejorar el loop del CRM
En `src/pages/CRM.tsx`:
- el loop histórico debe frenar solo cuando el backend indique fin real
- si recibe payload inválido o inconsistente, mostrar error claro
- añadir progreso más confiable:
  - pedidos sincronizados
  - página actual
  - si el histórico quedó incompleto

### 5. Recalcular contadores solo con histórico consistente
Mantener `refresh_customers_order_stats()` como fuente de verdad, pero asegurar que:
- se ejecute al final del histórico completo
- o manualmente con el botón de recalcular
Así Campaigns segmentará por cantidad de compras con datos reales.

## Archivos a tocar

- `supabase/functions/woo-sync/index.ts`
- `src/pages/CRM.tsx`

## Validación

Después del fix voy a verificar:
1. que el histórico avance más allá de la página 10 / 1000 pedidos
2. que no se marque como terminado cuando Woo responda mal
3. que el CRM muestre clientes en:
   - Primera compra
   - Recurrentes
   - Fieles
   - VIP
4. que `SegmentBuilder` use esos `orders_count` ya corregidos

## Detalle técnico

El bug actual está en esta combinación:
- la función usa `X-WP-TotalPages` como verdad absoluta
- si Woo responde distinto en `page=11`, `wcFetch` no tipa el fallo
- `woo-sync` cae en el branch de “body no es array” y sale sin propagar error real
- el frontend interpreta `next_page: null` como “histórico completo”

La corrección consiste en distinguir claramente:
```text
fin real del histórico != respuesta inválida de Woo
```

## Resultado esperado

Una vez aplicado:
- el histórico ya no se corta en 1000
- `orders` tendrá el histórico completo realmente importado
- `customers_cache.orders_count` se recalculará bien
- CRM y Email Campaigns podrán segmentar correctamente por cantidad histórica de compras
