# Inventario Maestro V1 para alimentar el POS de Sublime

## Qué encontré hoy

- Todo el POS y el Hub de Sublime (catálogo, stock, unidades, ventas, clientes) funciona con datos de ejemplo escritos en el código. No hay conexión real.
- Lo real en base de datos es Abastecimiento: 108 artículos de compra, 5 envíos, 6 cajas, 7 reglas de precio. Cada artículo es una compra/lote: nombre, marca, tipo, precio de compra, PVP manual, fotos, consignación, peso y un mapa de tallas con cantidades.
- Esos artículos no tienen color, ni categoría fiable, ni SKU en la mayoría, ni ubicación, ni existencias por tienda.
- Existen 2 tiendas registradas, pero solo se usan para fichaje de personal.
- España ya tiene el modelo producto → variante → ubicación → existencias. Copiamos ese patrón con tablas propias de Sublime.

## Principio corregido

Un artículo de Abastecimiento es una **compra/lote**, no un producto. Un producto maestro puede recibir mercancía de muchas compras a lo largo del tiempo. La relación es de muchos a uno y nunca se pierde el vínculo con el lote de origen (ni su costo).

Además, **ninguna cantidad de Abastecimiento se convierte en stock del POS automáticamente**: pasa antes por una validación física por ubicación.

---

## 1. Esquema final de las tablas

### `sublime_locations`
`id`, `name`, `code` (único), `type` (`store` | `warehouse` | `popup` | `external`), `is_active`, `sells_in_pos`, `notes`, `created_at`, `updated_at`.
Filas iniciales: **Sublime Barquicenter** (`BQ`, store, vende en POS) y **Almacén Sublime** (`WH`, warehouse, no vende en POS).

### `sublime_products`
`id`, `name`, `brand`, `category` (nullable), `product_type` (nullable), `main_image_url` (nullable), `is_active`, `notes`, `woo_product_id` (nullable, reservado), `created_at`, `updated_at`, `created_by`.
No lleva referencia al lote: esa relación vive en la tabla de enlace.

### `sublime_variants`
`id`, `product_id` → productos (cascade), `size` (nullable), `color` (nullable), `sku` (nullable), `barcode` (nullable), `full_price_ref` (numeric, nullable), `current_price_ref` (numeric, nullable), `discount_pct` (generado), `is_active`, `pos_enabled` (bool, default false), `woo_variation_id` (nullable, reservado), `created_at`, `updated_at`.
- Único parcial de `sku` cuando no es nulo (no bloquea las variantes con SKU pendiente).
- Único de `(product_id, coalesce(size,''), coalesce(color,''))` para no duplicar variantes al reimportar.
- `discount_pct` se calcula de full vs vigente; si no hay full o es igual, es 0.

### `sublime_stocks`
`id`, `variant_id`, `location_id`, `quantity_on_hand` (default 0), `quantity_reserved` (default 0), `quantity_available` generado como `greatest(on_hand - reserved, 0)`, `last_counted_at`, `updated_at`. Único `(variant_id, location_id)`.

### `sublime_variant_lots` (enlace con Abastecimiento, capa financiera)
`id`, `variant_id`, `merch_item_id` → `sublime_merch_items`, `size` (talla del lote), `qty_from_lot`, `unit_cost_ref`, `shipment_id`, `is_consignment`, `consignment_commission_pct`, `consignment_commission_amount`, `created_at`. Único `(merch_item_id, variant_id)`.
Esta tabla es la que permite responder "de qué compra vino esta prenda y cuánto costó".

### `sublime_stock_intake_proposals` (validación inicial)
`id`, `variant_id`, `location_id`, `suggested_qty` (desde Abastecimiento), `counted_qty` (nullable, lo que se cuenta físicamente), `status` (`pending` | `confirmed` | `discarded`), `source_merch_item_id`, `note`, `confirmed_at`, `confirmed_by`, `created_at`, `updated_at`.

Todas con GRANT explícitos a `authenticated` y `service_role`, RLS activo, lectura abierta a autenticados y escritura por `has_module_access(auth.uid(), '/sublime')`, más trigger `set_updated_at`.

---

## 2. Cómo se relaciona Abastecimiento con producto/lote

```text
sublime_merch_items (compra / lote)
        │  (muchos a muchos por talla)
        ▼
sublime_variant_lots  ── costo, envío, consignación, cantidad del lote
        │
        ▼
sublime_variants ──► sublime_products
        │
        ▼
sublime_stocks (por ubicación)   ← solo tras validación
```

- El producto maestro es lo que vendemos; el lote es de dónde vino y cuánto costó.
- Un producto puede tener N lotes; un lote puede alimentar N variantes (una por talla).
- El PVP se copia al catálogo, pero el **costo de compra, el envío y la consignación quedan en el lote**, nunca se pierden.

## 3. Cómo se evitan productos duplicados en futuros restocks

Al importar una compra, se busca coincidencia en este orden:
1. La compra ya está enlazada (`sublime_variant_lots` con ese `merch_item_id`) → solo se actualiza.
2. Coincidencia por SKU de variante, si la compra trae SKU.
3. Coincidencia por `(marca, nombre normalizado)` sin acentos, sin espacios dobles, en minúsculas → se propone vincular al producto existente.
4. Sin coincidencia → se propone producto nuevo.

La importación **no escribe directo**: presenta una lista de propuestas ("vincular a producto existente X" / "crear producto nuevo") y tú confirmas o cambias el destino. Además queda disponible una acción manual "Asociar esta compra a un producto existente" para corregir después.

## 4. Pantalla "Validación inicial de inventario"

Tabla por variante con: imagen, producto, talla, color, SKU, **Sugerido desde Abastecimiento**, **Físico Barquicenter**, **Físico Almacén**, **Diferencia**, y estado.

- Las cantidades físicas se escriben a mano (con "copiar sugerido" como atajo).
- Botón **Confirmar** por fila y confirmación masiva de lo revisado.
- Solo al confirmar se escribe en `sublime_stocks`; hasta entonces las cifras viven en las propuestas y el POS no las ve.
- Se puede descartar una propuesta (mercancía aún en tránsito, o no localizada) dejando nota.
- Se muestra la fecha de la última confirmación por variante y ubicación.

## 5. Cuándo una variante está "lista para POS"

Se marca `pos_enabled` automáticamente solo si cumple **todo**:
- Producto activo y variante activa.
- Tiene SKU.
- Tiene `current_price_ref` mayor que 0 (y si hay `full_price_ref`, que sea mayor o igual al vigente).
- Tiene categoría en el producto.
- Tiene talla o está marcada como talla única.
- Tiene stock confirmado en una ubicación con `sells_in_pos`.

La imagen **no** es requisito: si falta se muestra un marcador de posición.

El POS consulta únicamente variantes con `pos_enabled`, activas, de Sublime Barquicenter y con disponible mayor que 0.

Pantalla **"Variantes pendientes de completar"**: lista lo que falta por variante (SKU, color, categoría, precio, imagen, stock sin validar), con edición rápida en la misma fila.

## 6. Cómo se conservan costo y consignación

Toda la capa financiera vive en `sublime_variant_lots`: costo unitario en REF, envío asignado, si fue consignación y con qué comisión, y cuántas unidades vinieron de esa compra. Desde la ficha de una variante se ve el historial de lotes con su costo, y desde una compra se ve a qué productos alimentó. El catálogo del POS solo lee precios; no toca ni pisa esa información.

---

## Importación: dos acciones separadas

**A. Crear catálogo** — recorre las compras de marca `sublime`, propone productos y variantes (una por talla de `size_quantities`, o "Única" si `no_size`), copia PVP, fotos y tipo de artículo como **sugerencia** de categoría, y deja SKU, color y categoría en **pendiente** cuando no existen. Nunca inventa datos.

**B. Proponer stock inicial** — crea propuestas de cantidad por variante y ubicación a partir de las cantidades de compras en estado recibido. No escribe stock.

## Fuera de alcance en esta fase

Unidades físicas individuales, RFID, QR por unidad, conteos recurrentes, movimientos y transferencias reales, reservas, sincronización con WooCommerce, descuento de stock al vender, cambios en Abastecimiento o Mercancía actuales.

**Finalizar venta NO descuenta stock todavía.**

## Detalle técnico

- Una migración con las seis tablas, GRANT, RLS, triggers e índices descritos, más el alta de las dos ubicaciones iniciales.
- `src/hooks/useSublimeInventory.ts` (consultas y mutaciones de catálogo, stock, propuestas y lotes).
- `src/lib/sublimeInventoryImport.ts`: normalización de nombre, matching de productos, mapeo de `size_quantities` / `no_size` / `pvp` / `pvp_manual` / `fotos_web` / `fotos_origen` (prefijo `sb:` del bucket `sublime-merch`), y cálculo de costo unitario y consignación por lote reutilizando `src/lib/sublimeMerch.ts`.
- `src/lib/sublimePosReadiness.ts`: única función que decide `pos_enabled`, usada por la UI y por las mutaciones.
- Páginas nuevas bajo `src/pages/sublime/`: `SublimeInventarioMaestro.tsx` (tabla con filtros de ubicación, categoría, marca, talla, color y estado, búsqueda por nombre/SKU/código), `SublimeInventarioValidacion.tsx` y `SublimeInventarioPendientes.tsx`. Rutas en `src/App.tsx` y entradas en el menú de `SublimeLayout.tsx`.
- `usePosCart.ts`: `posCatalog` pasa de constante a hook con React Query sobre las tablas nuevas, filtrado por la ubicación POS; se conserva la forma de `PosCatalogEntry` para no tocar el resto del POS. `POS_STORE_LOCATION` pasa a ser el id real de Sublime Barquicenter.
- Las pantallas del Hub que siguen en modo ejemplo (unidades, movimientos, cierres) no se tocan y conservan su aviso.

## Al terminar te reporto

Estructuras reutilizadas, estructuras nuevas, de dónde sale el stock, cómo se determina el precio, cómo se identifica la ubicación, inconsistencias encontradas y qué datos reales consume el POS.
