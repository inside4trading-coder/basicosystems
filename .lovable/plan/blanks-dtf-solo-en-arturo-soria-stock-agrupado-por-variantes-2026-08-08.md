# Blanks/DTF solo en Arturo Soria + Stock agrupado por variantes

Los materiales de fabricación ligera (Blanks y DTF) pasan a gestionarse únicamente en **Arturo Soria / Taller**. Los productos terminados y su inventario por sedes no se tocan.

## Situación actual verificada

- Hoy todo el stock de materiales está en **Stock central** (5 materiales, 30 unidades). Arturo Soria está en 0.
- Las funciones de recetas (`esp_resolve_fabrication_materials` y `esp_consume_materials_for_fabrication_request`) hoy consumen por defecto de la sede tipo *almacén*, que es **Stock central**, no Arturo Soria.
- La pestaña Stock muestra una columna por cada sede activa y una fila plana por variante.

## Qué se va a hacer

### 1. Traslado del stock histórico
Se registra un traspaso del stock de materiales de Stock central a Arturo Soria (salida en Stock central + entrada en Arturo Soria), con motivo "Consolidación Blanks/DTF en Arturo Soria". No se borra nada y todo queda en el historial de movimientos.

### 2. Recetas consumen solo de Arturo Soria
Las dos funciones de recetas dejan de buscar la sede de tipo almacén y usan Arturo Soria como sede fija de consumo. Si no hay stock allí, sale el error de stock insuficiente habitual. La lógica de recetas (resolución de talla, cantidades, reservas) no cambia.

### 3. Pestaña Stock agrupada por material padre
Se reemplaza la tabla plana por una tabla agrupada, al estilo del modal "Editar tallas":

```text
> Camiseta Beige Oversize   Blank   Beige   SKU base IMP9861-3   Arturo Soria: 0   Tallas: S,M,L,XL,XXL   [Editar stock]
    Talla  SKU variante     Arturo Soria  Umbral  Estado  Acciones
    S      IMP9861-3-S      0             1       Activo  [Entrada][Salida][Ajuste]
    M      IMP9861-3-M      0             1       Activo  ...
```

- Solo una columna de stock: **Arturo Soria**. Total = Arturo Soria.
- Desaparecen las columnas Otros / temporal, Pop Up Ibiza, Stock central y Web / WooCommerce España.
- Buscador por material / SKU / color y filas expandibles.
- Aviso interno (no bloqueante) si queda stock de materiales fuera de Arturo Soria.

### 4. Editar stock por material agrupado
Nueva acción "Editar stock" en cada grupo: modal con una fila por talla y columnas Talla, SKU, Stock Arturo Soria, Umbral, Costo €, Estado, con **Motivo del ajuste obligatorio**. Al guardar se registra un movimiento de ajuste por cada talla modificada, solo en Arturo Soria.

### 5. Entrada / Salida / Ajuste sin selector de sede
En los modales de movimiento de Blanks/DTF la sede queda fijada a Arturo Soria y el selector se muestra deshabilitado con el texto "Blanks/DTF solo se gestionan en Arturo Soria".

### 6. Resumen y modal "Editar tallas"
El modal existente "Editar tallas" y la matriz de Resumen pasan a mostrar solo Arturo Soria, para que ambos números coincidan.

## Detalles técnicos

- Frontend: `src/pages/espana/EspanaBlanksDTF.tsx` (pestaña Stock, `MovementDialog`, `GroupSizesDialog`, nuevo `GroupStockDialog`, matriz de Resumen). Se resuelve la sede por `code = 'ARTURO_SORIA'` en `esp_locations`.
- Migración: `CREATE OR REPLACE` de `esp_resolve_fabrication_materials` y `esp_consume_materials_for_fabrication_request` cambiando únicamente la resolución de `v_loc` a la sede con `code='ARTURO_SORIA'` (con `p_location_id` explícito aún respetado).
- Traslado de stock: movimientos vía `esp_apply_material_movement` (salida + entrada), no edición directa de tablas.
- Sin cambios en: productos terminados, `esp_inventory_stock`, `esp_apply_movement`, POS, Woo, Core, ventas ni órdenes de producción.
- Se ejecuta typecheck al final.
