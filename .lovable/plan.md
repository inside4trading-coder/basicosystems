# Sublime — Stock operativo real: Almacén, Tienda, Movimientos y Listas para POS

Conectar las pantallas operativas al stock oficial que ya nace en la Validación Inicial, y permitir traslados reales entre Almacén y Tienda. No se toca la venta del POS.

## 1. Almacén Sublime y Tienda Sublime (datos reales)

Ambas pantallas hoy usan datos de ejemplo. Se reemplaza la vista compartida por una versión conectada a las existencias oficiales de la ubicación correspondiente.

- Almacén Sublime → ubicación "Almacén Sublime".
- Tienda → ubicación "Sublime Barquicenter" (fuente de stock vendible).

Columnas: producto (con imagen si existe), variante, SKU, en mano, reservado, disponible, costo unitario, precio full, precio vigente, valor de inventario (en mano × costo), estado y fecha del último movimiento. Si no hay costo se muestra "—" y no se suma al valor.

Indicadores superiores calculados con datos reales: variantes con stock, unidades físicas, valor de inventario.

En la vista de Tienda se añade además el estado "Lista para POS" por variante.

## 2. Mover mercancía (traslado real)

El diálogo existente pasa a ejecutar traslados reales entre ubicaciones mediante una nueva operación de base de datos atómica:

- selección de variante real con buscador (producto/SKU), origen, destino, cantidad y nota;
- validaciones: cantidad entera mayor que cero, no superar el disponible en origen, origen distinto de destino;
- efecto: resta en origen, suma en destino y registra un movimiento auditable de tipo `location_transfer` con usuario, fecha, origen, destino y cantidad;
- nunca deja stock negativo; si algo falla no se aplica nada.

## 3. Movimientos

La pantalla pasa a leer el registro real de movimientos (incluye los de validación inicial y los traslados nuevos). Muestra fecha/hora, producto, variante, SKU, tipo, cantidad, origen, destino, usuario y nota. Filtros por rango de fechas, ubicación, texto (SKU/producto) y tipo de movimiento.

## 4. Lista para POS

La regla se ajusta a lo pedido: una variante está lista si el producto está activo, la variante está activa, tiene SKU, tiene precio vigente mayor que cero y tiene disponible mayor que cero en Tienda. Categoría, color, talla, imagen y mapeo Woo dejan de bloquear y pasan a mostrarse como advertencias.

Motivos posibles cuando no está lista: sin stock en tienda, sin SKU, sin precio, producto inactivo, variante inactiva (pueden ser varios a la vez).

El botón "Recalcular listas para POS" evalúa todas las variantes reales y actualiza el estado sin duplicar registros. Además el estado se recalcula automáticamente al confirmar validación inicial, al trasladar mercancía y al cambiar precio, SKU, stock o el activo/inactivo, porque la elegibilidad se deriva del dato vigente en cada consulta.

## 5. Inventario Maestro

Los indicadores pasan a ser reales: productos, variantes, "Listas para POS" (variantes vendibles hoy en Tienda) y "Unidades disponibles" (suma de disponibles oficiales de todas las ubicaciones), con la etiqueta aclarando el alcance.

## 6. Prueba obligatoria

Con la variante real Anillos (Tienda 2 / Almacén 1): comprobar Almacén = 1, Tienda = 2, movimientos de validación visibles, estado POS correcto; luego mover 1 unidad Almacén → Tienda y verificar Tienda = 3, Almacén = 0, movimiento auditado, sin negativos y Maestro actualizado.

## Detalles técnicos

- Reutiliza `sublime_locations`, `sublime_products`, `sublime_variants`, `sublime_stocks`, `sublime_inventory_movements`, `sublime_stock_intake_proposals`.
- Nueva función `public.sublime_transfer_stock(variant_id, from_location, to_location, qty, note)`: `SECURITY DEFINER`, exige acceso a `/sublime`, bloquea filas con `FOR UPDATE`, valida disponible, actualiza ambas existencias e inserta dos movimientos `location_transfer` (delta negativo/positivo) en una sola transacción.
- `posBlockers` en `src/lib/sublimeInventory.ts` deja de incluir `no_category`/`no_size` como bloqueo; se añaden advertencias separadas.
- Nuevos hooks en `useSublimeInventory.ts`: `useSublimeMovements(filtros)` y `useTransferStock()`, con invalidación de `sublime_inv_all` y `sublime_pos_catalog`.
- `InventoryLocationView.tsx`, `MoveMerchandiseDialog.tsx` y `SublimeMovimientos.tsx` dejan de importar `src/lib/sublimeMock`.
- Fuera de alcance: venta POS, cierres, pagos, clientes, Cashea, Mapeo Woo, escritura a Woo, Preparación, Abastecimiento, Core, España y Studio.

## Pantallas que seguirán con datos de ejemplo

Unidades, Conteos y las demás vistas del hub que dependen de unidades físicas/RFID, que no forman parte de esta fase.
