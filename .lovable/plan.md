# Por qué no coincide con WooCommerce (1–9 May 2026)

WC muestra: Total sales **1.585,02**, Orders **59**, Products sold **124**.
Nuestro Dashboard muestra: **$1.648,97**, **60**, **93**.

Comparé pedido por pedido en la base de datos (69 pedidos en el rango). Estas son las 4 causas exactas:

## 1. Pedidos con total = 0 que SÍ tienen artículos (causa principal del gap de "Products sold")

Hay 2 pedidos `completed` en USD con `total_amount = 0` pero con artículos reales:
- Pedido **32293** → 14 unidades, $0
- Pedido **32309** → 19 unidades, $0

Total: **33 unidades** que WooCommerce sí cuenta como "Products sold" pero nuestro hook descarta porque filtra `if (usd <= 0) return false;` en `useDashboardData.ts` (línea 134).

`93 (nuestro) + 33 (descartados) = 126`, prácticamente los **124** de WC (la pequeña diferencia restante viene del punto 2).

## 2. Pedido VES con `exchange_rate = 0` descartado completamente

Pedido **32321**: VES, total 28.769,18, `exchange_rate = 0`, **3 unidades**. Nuestro filtro lo elimina (línea 136). WC lo incluye (con su propia tasa).

## 3. "Orders": incluimos `Pago por confirmar`, WC no

Pedido **32399** tiene status `pedido-pending-pa` (= "Pago por confirmar" / pending payment). WC Analytics por defecto excluye los pendientes de pago. Por eso WC = 59 y nosotros = 60.

## 4. Diferencia de Total Sales ($63,95)

`$1.648,97 − $1.585,02 = $63,95`. Causas combinadas:
- Diferencia de tasas FX: nosotros usamos la tasa guardada en el pedido al momento de crearse; WC usa su propio histórico de conversión.
- Pequeñas diferencias de redondeo al sumar 50+ pedidos VES convertidos.

(No hay pedidos refunded en el rango, así que "Total sales" y "Net sales" coinciden tanto en WC como en nuestros datos — eso descarta el shipping/refunds como causa.)

---

# Plan de corrección

Cambios sólo en `src/hooks/useDashboardData.ts`. Sin tocar UI ni esquema.

## A. Contar artículos de pedidos válidos aunque su total sea 0

Separar dos conceptos que hoy están mezclados en el mismo filtro `paid`:

```text
validOrders     -> status válido (incluye pedidos a $0). Base para: orders count, products sold, statuses, hourly, sizes.
revenueOrders   -> validOrders ∩ NO excluido de revenue ∩ usd > 0 ∩ FX VES OK.
                   Base para: revenue, avgTicket, dailyRevenue, topProducts revenue, categoryBreakdown, revenueByState, payments.
```

Resultado: `productsSold` pasará de 93 → ~126 (incluye los 33 ítems de 32293/32309 y los 3 de 32321), alineado con WC.

## B. Excluir "Pago por confirmar" del conteo de Orders (opcional, configurable)

Para que `orders` cuadre con WC, dejar de contar `Pago por confirmar` (`pedido-pending-pa`) y `Pending payment` (`pending`) como "validos" en el KPI Orders.

Hay dos opciones — necesito que decidas:

- **B1**: igualar a WC y excluirlos siempre (60 → 59).
- **B2**: mantenerlos (criterio actual) y mostrar en el tooltip "incluye pendientes de pago" para que la diferencia con WC sea explicable.

## C. Diferencia de FX en revenue

La diferencia de $63,95 (≈4%) es estructural por tasas distintas. Opciones:

- **C1**: dejar como está (usamos la tasa real del momento del pedido — más fiel al ingreso real recibido).
- **C2**: recalcular con una tasa diaria de referencia almacenada (requiere tabla de tasas; trabajo mayor, futuro).

Recomiendo **C1** + nota visual "Tasas de cambio del momento del pedido" en el tooltip del KPI.

## D. Pedido 32321 con FX = 0

Hoy lo descartamos por completo. Dos opciones:

- **D1**: contarlo en `validOrders` (orders + products sold) pero seguir excluyéndolo del revenue (no podemos convertir sin tasa). Es el comportamiento más cercano a WC.
- **D2**: dejarlo fuera (statu quo).

Recomiendo **D1**.

---

# Preguntas para ti

1. Punto B: ¿**B1** (igualar exactamente a WC excluyendo "Pago por confirmar") o **B2** (mantener inclusión y aclararlo)?
2. Punto D: ¿**D1** (contar el pedido sin FX en orders/products) o **D2** (seguir excluyéndolo)?
3. Punto C: ¿aceptamos la diferencia de ~4% por FX como esperada, o quieres que abramos un plan posterior para tasas diarias unificadas?

Con tus respuestas dejo Total sales prácticamente idéntico, Orders idéntico y Products sold idéntico a WooCommerce.
