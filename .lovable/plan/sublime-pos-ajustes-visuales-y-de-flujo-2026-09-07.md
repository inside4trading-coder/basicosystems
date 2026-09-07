# Sublime POS — ajustes visuales y de flujo

Se trabaja sobre el prototipo actual. Sin backend, sin inventario real, sin migraciones, sin cobros reales.

## 1. Precios con IVA incluido

- Todo precio mostrado es final, con IVA ya incluido. Se elimina el interruptor "Impuesto 16%" del carrito y el total deja de sumar impuesto.
- En factura/comprobante se muestra el desglose fiscal informativo (base imponible e IVA contenido), calculado hacia atrás desde el total.
- Donde hay descuento se muestra siempre: precio full tachado, precio actual destacado y el porcentaje. Sin descuento, solo el precio vigente. Aplica en catálogo, carrito, cobro y factura.

## 2. Moneda

- Bs. como cifra protagonista y REF debajo como referencia, en catálogo, carrito, descuentos, total, pagos, faltante, cambio, factura e historial. Ya existe ese componente; se revisa que no quede ninguna cifra en USD suelta (el método "Efectivo REF" y las etiquetas de moneda).
- La tasa se muestra como "TASA BCV · Bs. 150,00 / REF" en el encabezado.

## 3. Origen de la venta obligatorio

- Sin preselección: el carrito arranca sin origen.
- Opciones: Tienda física, WhatsApp, Cashea, Instagram, Teléfono, Web, Otro (con detalle libre).
- La selección aparece en el carrito y en la pantalla de cobro, con estado visual claro de "confirmado".
- No se puede finalizar la venta sin origen; el botón queda deshabilitado con aviso.
- El botón FINALIZAR VENTA cambia de color/estilo según el origen elegido (mapa de estilos por origen, ajustable después).

## 4. Métodos de pago y pago mixto

- Al elegir un método el CTA dice USAR ESTE MÉTODO DE PAGO. Tras registrar el primero aparece + AÑADIR MÉTODO DE PAGO.
- "Pago mixto" no existe como método: la venta es mixta cuando hay varios pagos registrados.
- Panel permanente con TOTAL, PAGADO, FALTANTE y CAMBIO (Bs. principal, REF secundario).
- FINALIZAR VENTA solo se habilita con faltante 0 y origen elegido.
- Bancos en desplegable (BNC, Banco OFF) para pago móvil, transferencia y punto de venta, con lista central fácil de ampliar.

## 5. Caja: apertura y movimientos

- Diálogo de apertura de caja con efectivo inicial en Bs. y en REF, responsable y hora.
- Acciones "Añadir efectivo" y "Retirar efectivo": tipo, moneda, monto, motivo, responsable y fecha/hora. El retiro descuenta del saldo mostrado.
- Resumen de saldo de caja por moneda y lista de movimientos de la sesión. Todo simulado en memoria.
- Se conserva la arquitectura sede → caja → sesión → cajero → ventas y las acciones separadas Cambiar cajero / Cambiar caja / Abrir-cerrar caja en el encabezado.

## 6. Agregar producto / servicio / extra

- Nueva acción en la barra de funciones: nombre, tipo (producto, servicio, extra), precio y moneda (Bs. o REF), con equivalencia automática en ambas.
- La línea entra al carrito como concepto manual (sin stock) y aparece luego en la factura.

## 7. Nota del pedido

- La acción NOTA abre un cuadro para la nota general de la venta, visible en el carrito y arrastrada al documento de venta para historial, detalle y factura.

## 8. Factura / comprobante y post-venta

- Al finalizar: pantalla VENTA COMPLETADA con acciones Ver factura, Imprimir, Descargar, Enviar, Nueva venta (las tres del medio siguen simuladas).
- Documento con encabezado (número, fecha/hora, sede, caja, cajero, origen), cliente (nombre/razón social, cédula/RIF, teléfono, dirección, correo), detalle por línea (concepto, SKU si aplica, cantidad, precio full, descuento, precio final, subtotal), totales (subtotal regular, descuentos, total final con IVA incluido y desglose fiscal informativo), pagos (método, monto, banco, referencia) y la nota si existe.

## Detalle técnico

- Archivos tocados: `usePosCart.ts` (quitar IVA sumado, origen sin default, líneas manuales, nota), `PosCatalog.tsx`, `PosCart.tsx`, `PosPaymentSheet.tsx`, `PosReceiptPreview.tsx`, `PosHeader.tsx`, `PosFunctionsBar.tsx`, `PosSessionDialogs.tsx`, `SublimePosApp.tsx`, `posMoney.tsx`, `posPaymentMethods.ts`, `posSalesChannels.ts`, `posSession.ts`.
- Nuevos: `posBanks.ts` (catálogo de bancos), `posChannelStyle.ts` (estilo del botón por origen), `PosManualItemDialog.tsx`, `PosNoteDialog.tsx`, `PosCashDrawerDialog.tsx` (apertura y movimientos), `usePosCashDrawer.ts` (estado mock en memoria).
- El IVA pasa a ser derivado: `ivaIncluido = total − total / 1.16`, solo para mostrar en factura.
- Todo el estado sigue en memoria del cliente; sin llamadas a la base de datos ni cambios en inventario.
