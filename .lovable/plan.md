

## Respuesta corta

Sí, **trae el 100% del histórico** y deja los segmentos de Campaigns funcionando correctamente. Pero hay un matiz: necesitamos asegurarnos de que **todos los pedidos históricos estén en la tabla `orders`**, no solo los últimos 30 días.

## Cómo queda el flujo

```text
WooCommerce  ──(sync histórico completo)──►  orders (tabla local)
                                                   │
                                                   ▼
                              refresh_customers_order_stats()
                                                   │
                                                   ▼
                                   customers_cache.orders_count
                                                   │
                                                   ▼
                              Campaigns / SegmentBuilder (filtros por nº pedidos)
```

La fuente de verdad es `orders`. Mientras esa tabla tenga el histórico, el resto se calcula solo.

## Plan en 3 pasos

### 1. Sync histórico completo de pedidos (one-shot)
Modifico `supabase/functions/woo-sync/index.ts` para aceptar `?full=true`. Cuando se invoca con ese flag, ignora el filtro de 30 días y pagina **todos** los pedidos de WooCommerce (status `any`, sin `after`). Esto trae el histórico completo a la tabla `orders`.

### 2. Auto-recálculo en cada sync
Al final de `woo-sync` (sea incremental o full), llamamos `supabase.rpc("refresh_customers_order_stats")`. Así, cada pedido nuevo que entre en el futuro actualiza automáticamente el contador del cliente. Nunca más quedará desfasado.

### 3. Botón en CRM con dos modos
En `src/pages/CRM.tsx`, junto al botón ↻ actual:
- **"Sincronizar pedidos"** → modo incremental (30 días) — uso diario.
- **"Sync histórico completo"** → llama con `?full=true` — uso puntual, ahora y rara vez después.
- **"Recalcular contadores"** → solo dispara la RPC sin re-bajar pedidos. Útil para forzar refresh sin esperar.

## Migración inmediata
Ejecuto `SELECT public.refresh_customers_order_stats();` ya, para arreglar los 169 clientes con pedidos que ya tenemos sincronizados. Resultado inmediato visible en CRM antes incluso del sync histórico.

## Impacto en Campaigns / SegmentBuilder

`SegmentBuilder` filtra contra `customers_cache.orders_count`. Una vez recalculado:
- **Primera compra (=1)** → ~140 clientes reales (hoy: 0).
- **Recurrentes (2-5)** → se puebla.
- **VIP (6+)** → se puebla cuando llegue el histórico completo.
- **Sin compras (=0)** → baja de 8.405 a ~8.236 (los que de verdad nunca compraron).

Las audiencias de campañas pasan a ser fiables.

## Validación

1. Click en "Recalcular" → toast con número de clientes actualizados.
2. CRM: filtro "Primera compra" muestra ~140.
3. Click en "Sync histórico completo" → barra de progreso, trae todos los pedidos antiguos. Al terminar, recalcula solo. Segmentos VIP/Recurrentes se pueblan según el histórico real de Basico.
4. En Campaigns Wizard, al construir un segmento "compradores 3+ pedidos", el contador de audiencia es realista.

## Archivos a tocar

- `supabase/functions/woo-sync/index.ts` — flag `full=true` + llamada RPC al final.
- `src/pages/CRM.tsx` — 2 botones nuevos (sync histórico, recalcular).
- Migración SQL one-shot — `SELECT public.refresh_customers_order_stats();`.

## Fuera de alcance

- Tocar Brevo / sync de contactos (los segmentos se construyen con datos locales; Brevo solo recibe el resultado).
- Pedir `orders_count` a Woo (Woo lo devuelve en 0 — irrelevante).

