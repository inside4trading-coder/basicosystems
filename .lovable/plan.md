# Etiqueta QR: mostrar el código de variante interno (MSW56, MSW57…)

## Qué pasa hoy

Las etiquetas y fichas viajeras se generan en un único sitio: la pantalla **QR / Ficha Viajera**. Hoy la etiqueta imprime el código de unidad, una línea de SKU (que a veces cae al SKU padre, p. ej. `WOO-4077` o `MF89 / MF90`), la talla grande y el nombre del producto. El código interno real de la variante no queda visible como dato propio.

Verificado en datos reales: el código interno vive en el SKU de variante de la unidad y de la variante enlazada, con la talla pegada al final (`MF64 L`, `JGM45 L`, `MSW56 L`). Por eso hay que extraer el código base, no imprimir el texto crudo.

## Qué se hará

1. Añadir un resolvedor del código de variante con esta prioridad:
   - SKU de variante guardado en la unidad
   - SKU de variante de la variante enlazada
   - SKU Woo de la variación
   - código embebido en el código de unidad (`OP-000017-MSW56-L-001`)
   - si nada existe: **"Código variante no disponible"** (nunca None/null/undefined)
   Del valor elegido se recorta el sufijo de talla (`MSW56 L` → `MSW56`) y se conserva la talla aparte.
2. Cargar en la pantalla los datos de las variantes enlazadas a las unidades mostradas (SKU de variante, SKU Woo, color) para poder aplicar los fallbacks.
3. Etiqueta 10×10: nueva línea destacada **"Código variante: MSW56"** justo encima del nombre del producto, manteniendo el QR, la talla grande y el bloque de procesos tal cual. El color, si existe, se muestra como apoyo en pequeño.
4. Ficha viajera A5: fila **"Código variante"** al inicio del bloque de datos, encima de Producto; se mantienen SKU padre y SKU variante.
5. Tabla y panel de detalle de unidades en pantalla: mostrar el mismo código resuelto, para que lo impreso coincida con lo que se ve.

## Alcance técnico

- Archivos: `src/pages/core/CoreQRTravelSheets.tsx` (carga de variantes + HTML de etiqueta y ficha + tabla/detalle) y un helper nuevo pequeño para resolver el código (junto a `src/lib/coreVariantResolve.ts`).
- Sin cambios en QR, escaneo, inventario, escritura a Woo, nómina, costos ni generación de unidades. Sin migraciones de base de datos.
- Validación: generar etiqueta y ficha de dos unidades de variantes distintas y comprobar que cada una muestra su código; typecheck en 0 errores.
