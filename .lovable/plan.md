# Inventario Maestro V1 para alimentar el POS de Sublime

## Qué encontré hoy

- Toda la pantalla del POS y del Hub de Sublime (catálogo, stock, unidades, ventas, clientes) funciona con datos de ejemplo escritos a mano en el código. No hay ninguna conexión real.
- Lo único real de Sublime en la base de datos es Abastecimiento: 108 artículos de compra, 5 envíos, 6 cajas y 7 reglas de precio. Esos artículos son "tickets de compra": tienen nombre, marca, tipo, precio de compra, PVP manual, fotos, consignación y un pequeño mapa de tallas con cantidades.
- Esos artículos no tienen color, ni categoría, ni SKU en la mayoría de los casos, ni ubicación, ni existencias por tienda.
- Existen 2 tiendas registradas (`sublime_stores`), pero solo se usan para el fichaje de personal, no para inventario.
- España ya tiene exactamente el modelo que necesitamos (producto → variante → ubicación → existencias). Copiaremos ese patrón, con tablas propias de Sublime.

## Lo que voy a construir

### 1. Cuatro tablas nuevas, solo de Sublime

- **Ubicaciones**: nombre, código, tipo (tienda, almacén, pop-up), activa, si vende en POS. Se crea "Sublime Barquicenter" y "Almacén Sublime".
- **Productos**: nombre, marca, categoría, tipo, imagen principal, activo, y el enlace opcional al artículo de Abastecimiento del que vino. Campos `woo_product_id` reservados para el futuro, vacíos por ahora.
- **Variantes**: producto, talla, color, SKU, código de barras, precio full en REF, precio vigente en REF, descuento calculado, activa. Campo `woo_variation_id` reservado.
- **Existencias**: variante + ubicación + en mano + reservado. El disponible se calcula (en mano − reservado) y nunca baja de cero.

Los precios se guardan en REF (dólar). El POS convierte a Bs. con la tasa, como ya hace hoy. Los precios ya incluyen IVA: no se suma nada encima.

### 2. Importación desde Mercancía

Una acción "Importar desde Abastecimiento" que recorre los artículos de Sublime y crea productos y variantes:

- Un artículo = un producto.
- Si el artículo tiene tallas con cantidades, se crea una variante por talla; si es sin talla, una sola variante "Única".
- El precio vigente sale del PVP manual o del PVP calculado del artículo; el precio full arranca igual al vigente (sin descuento) y se edita a mano cuando haya promoción.
- El SKU sale del SKU web si existe; si no, la variante queda **sin SKU** y aparece marcada, nunca inventado.
- La imagen sale de las fotos del artículo.
- La importación es repetible y no duplica: se reconoce el artículo de origen ya importado y solo actualiza lo que falte.
- Las cantidades importadas entran como existencias en Sublime Barquicenter, y luego se pueden ajustar a mano en la pantalla de inventario.

### 3. Pantalla "Inventario" dentro de Sublime

Tabla con imagen, producto, variante, SKU, categoría, marca, precio full, precio vigente, descuento, ubicación, en mano, reservado, disponible y estado.

- Filtros: ubicación, categoría, marca, talla, color, estado.
- Búsqueda por nombre, SKU o código.
- Edición en línea de precios, SKU y cantidades (con motivo del ajuste opcional).
- Botón de importación desde Abastecimiento.

### 4. Pestaña "Revisión" (validación)

Sin corregir nada automáticamente, lista:

- Variantes sin SKU.
- SKU duplicados.
- Variantes sin precio o con precio vigente mayor al full.
- Artículos de Abastecimiento aún no importados.
- Variantes sin existencias en ninguna ubicación.

### 5. Conexión con el POS (solo lectura)

El catálogo del POS deja de leer los datos de ejemplo y pasa a leer productos, variantes, precios y disponibilidad reales de la ubicación activa (Sublime Barquicenter). Se conservan intactos: carrito, descuentos, IVA incluido, Bs./REF, origen de venta, métodos de pago, factura y caja.

**Finalizar venta NO descuenta stock todavía.** Eso queda para la siguiente fase, tras tu revisión.

## Fuera de alcance en esta fase

Unidades físicas individuales, RFID, QR por unidad, conteos, movimientos y transferencias reales, reservas, sincronización con WooCommerce, descuento de stock al vender, y cualquier cambio en Abastecimiento o Mercancía actuales.

## Detalle técnico

- Nuevas tablas `sublime_locations`, `sublime_products`, `sublime_product_variants`, `sublime_inventory_stock`, con GRANT explícitos a `authenticated`/`service_role`, RLS activo, lectura abierta a autenticados y escritura por `has_module_access(auth.uid(), '/sublime')`, más trigger `set_updated_at`. Único `(location_id, variant_id)` en existencias y único parcial de `sku` sobre variantes con SKU no nulo.
- `quantity_available` como columna generada `greatest(quantity_on_hand - quantity_reserved, 0)`.
- Trazabilidad de origen: `source_merch_item_id` en productos y `source_size` en variantes, para que la importación sea idempotente.
- Nuevo hook `src/hooks/useSublimeInventory.ts` (consultas y mutaciones) y `src/lib/sublimeInventoryImport.ts` (mapeo desde `sublime_merch_items`, respetando `brand = 'sublime'`, `size_quantities`, `no_size`, `pvp`/`pvp_manual`, `fotos_web`/`fotos_origen` con el prefijo `sb:` del bucket `sublime-merch`).
- Nueva página `src/pages/sublime/SublimeInventarioMaestro.tsx` con ruta en `src/App.tsx` y entrada en el menú de `SublimeLayout.tsx`.
- `usePosCart.ts`: `posCatalog` pasa de constante a hook con React Query sobre las tablas nuevas, filtrando por la ubicación POS; se mantiene la forma de `PosCatalogEntry` para no tocar `PosCatalog.tsx` ni el resto del POS. `POS_STORE_LOCATION` pasa a ser el id real de Sublime Barquicenter.
- Las pantallas del Hub que siguen en modo ejemplo (unidades, movimientos, cierres) no se tocan y conservan su aviso.

## Al terminar te reporto

Estructuras reutilizadas, estructuras nuevas, de dónde sale el stock, cómo se determina el precio, cómo se identifica la ubicación, inconsistencias encontradas y qué datos reales está consumiendo el POS.
