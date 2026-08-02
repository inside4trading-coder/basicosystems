## Estado verificado (lecturas hechas)

- En `core_fabrication_fund_movements` ya existen movimientos con `fund_bucket = 'external_supplier'`: 1 `sale_generated` posted ($5.34), 1 `sale_generated` reversed ($3.40) y 1 `reversal` (-$3.40). Es decir, **el backend ya suma a la partida de proveedor externo**; no hace falta tocar el procesamiento de ventas.
- La card “Proveedores externos” ya existe en `/core/partidas-fabricacion` (`PartidaCard`, línea ~675) pero, a diferencia de “Pendiente por resolver”, **no tiene `onClick` para ver detalle**.
- En `/core/necesidades` las pestañas actuales son sólo “Fabricación interna” y “Requieren atención”: **no hay pestaña de proveedor externo**.
- Ya existe flujo de compras externas (`ExternalReplenishmentPanel`, `core_external_purchase_order_lines`, RPCs de órdenes externas) — se reutiliza, no se crea nada nuevo.

Conclusión: el trabajo es de **presentación**. No se crean tablas ni se modifica el cálculo financiero.

## Qué se construye

### 1. Nueva pestaña “Proveedor externo” en `/core/necesidades`
Nuevo componente `src/components/core/needs/ExternalRestockList.tsx`, montado como tercera pestaña en `CoreProductionNeeds.tsx`.

Fuente de datos (solo lectura):
- `core_fabrication_fund_movements` con `fund_bucket = 'external_supplier'`, `movement_type = 'sale_generated'`, `status = 'posted'`.
- Enriquecido con `core_products` / `core_product_variants` para nombre, SKU y talla cuando el movimiento no los trae.
- Cruce con `core_external_purchase_order_lines` (por `core_product_id` + `core_variant_id`/SKU) para derivar el estado.

### 2. Dos vistas dentro de la pestaña
- **Agrupada (por defecto)**: por producto + variante/talla → `SKU · Talla`, cantidad total a reponer, costo reservado total, nº de pedidos involucrados. Fila expandible al detalle.
- **Detalle**: fecha de venta, producto, SKU, variante/talla, cantidad, costo reservado, pedido (`source_order_id`), `source_order_item_id`, estado.

Estados derivados:
- **Pendiente de compra** — sin línea en orden externa.
- **En orden de compra** — existe línea en orden externa `draft/approved/ordered`.
- **Recibido / cerrado** — línea recibida o cancelada.

Acciones por fila:
- **Ver movimiento** → navega a `/core/partidas-fabricacion` con filtro de movimientos externos aplicado y resaltado del movimiento.
- **Preparar compra** → abre el flujo externo ya existente (panel de reposición externa / preview de orden externa) con la selección correspondiente; si no hay evento asociado, el botón queda deshabilitado con tooltip explicativo.

Filtro de fecha desde el baseline vigente (27/07/2026), coherente con el resto del módulo.

### 3. Card “Proveedores externos” en `/core/partidas-fabricacion`
- Añadir `onClick` que fija el filtro de movimientos a bucket `external_supplier` y salta a la pestaña “Movimientos” (mismo patrón que “Pendiente por resolver”).
- La card ya muestra monto acumulado y cantidad de movimientos; se verifica que el conteo use los movimientos del fondo externo `posted`.
- El listado de movimientos filtrado muestra producto, SKU, variante, pedido, costo y fecha (columnas ya presentes; se completan las que falten desde el enriquecimiento).

## Reglas respetadas
- No se crean órdenes de producción internas, unidades ni QR.
- No se consume inventario interno.
- Estos ítems no aparecen en la pestaña “Fabricación interna”.
- No se toca Woo, OP, QR ni el edge function de partidas.
- Sin tablas nuevas ni migraciones.

## Detalles técnicos
- Archivos: `src/components/core/needs/ExternalRestockList.tsx` (nuevo), `src/pages/core/CoreProductionNeeds.tsx` (pestaña), `src/pages/core/CoreFabricationFunds.tsx` (onClick + filtro externo), y un hook pequeño `useExternalRestockItems` (probablemente dentro de `useExternalPurchaseOrders.ts` para no dispersar).
- Agrupación en cliente por clave `core_product_id|core_variant_id|sku_normalizado`.
- Validación final con Playwright sobre `/core/necesidades` y `/core/partidas-fabricacion` + typecheck.
