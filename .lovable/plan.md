# Sublime POS — ajustes de UX y arquitectura visual

Solo prototipo visual. No se toca backend, inventario real, tablas ni migraciones. Se reutilizan los componentes ya aprobados en `src/components/sublime/pos/` y `src/pages/pos/SublimePosApp.tsx`.

## 1. Bolívar protagonista, REF secundario

Nuevo helper `src/lib/posMoney.ts`:

```text
bsFormat(ref, rate) -> "Bs. 5.100,00"
refFormat(ref)      -> "REF 34,00"
<Money ref={n} rate={r} size="lg|md|sm" sign="+|-" />
```

Internamente el cálculo sigue en la unidad actual (lo que hoy es USD pasa a llamarse REF en pantalla). Se sustituye `usdFormat` por el par Bs./REF en catálogo, carrito, descuentos, subtotal, total, cobro, pagos, faltante, cambio y comprobante. La tasa en el encabezado pasa a "TASA BCV · Bs. 150,00 / REF".

## 2. Precio regular y precio con descuento

`usePosCart` amplía cada línea con `regularPrice`, `discount`, `finalPrice`, `quantity`, `lineTotal`, más el origen del descuento (`promo | manual_pct | manual_fixed | coupon | auto | cart`), motivo y cajero que lo aplica (solo campos, sin motor de promociones).

Precio regular en el catálogo: tabla local de precios promocionales en `usePosCart` (sin tocar los datos base) para poder mostrar tachado + porcentaje. Sin descuento se muestra un solo precio.

Se refleja en: tarjeta de producto, línea de carrito, cobro y comprobante.

## 3. Resumen del carrito

Subtotal regular · Descuentos (en negativo) · Subtotal final · Impuestos si aplican · TOTAL. Bs. grande, REF pequeño en cada fila.

## 4-5. Cobro: método por método y pago mixto

Reescritura del cuerpo de `PosPaymentSheet` (misma estructura de datos `PosPaymentLine`):

```text
[ selector de método ]
  campos propios del método (monto, terminal, banco, referencia…)
  [ USAR ESTE MÉTODO DE PAGO ]     <- primer pago
PAGOS
  1. Punto de venta   Bs. 3.000 / REF 20   [x]
[ + AÑADIR MÉTODO DE PAGO ]        <- siguientes
TOTAL · PAGADO · FALTANTE · CAMBIO (Bs. grande + REF)
[ FINALIZAR VENTA ]  habilitado solo con FALTANTE = 0
```

Validación visual de campos obligatorios antes de registrar el método. "Efectivo USD" pasa a llamarse "Efectivo REF".

## 6. Canal / origen de la venta

Nuevo `src/lib/posSalesChannels.ts`: Tienda física (default), Web, WhatsApp, Instagram, Cashea, Teléfono, Otro (+ campo libre "Detalle del origen"). Bloque "ORIGEN DE LA VENTA" visible en el cobro, antes de finalizar, independiente del método de pago. El canal viaja en el documento de venta y se muestra en el comprobante. Para ventas web quedará fijado por el pedido (campo preparado, sin edición del cajero).

## 7. Cliente

`PosCustomerDialog` añade fecha de nacimiento y mantiene todos los campos opcionales; venta sin cliente sigue permitida.

## 8-10. Sede, caja, sesión, cajero y carritos

Nuevo `src/lib/posSession.ts` con datos simulados: sede → cajas → sesiones → cajeros. Contexto ligero en `SublimePosApp` que mantiene `location_id`, `register_id`, `pos_session_id`, `cashier_id` y sella cada venta con ellos.

Carrito activo por caja/sesión (mapa en memoria, cada caja con su propio carrito). Los carritos suspendidos se listan con id, caja, cajero, cliente, hora, total Bs. y REF (listado visual, sin backend).

## 9. Header

SEDE · CAJA · CAJERO · TASA BCV · ESTADO, con acciones separadas: Cambiar cajero, Cambiar caja, Abrir / cerrar caja, Salir. Dos diálogos distintos para cajero y caja.

## 11. Inventario compartido

El stock mostrado es el de la sede, no de la caja; una nota visible indica que todas las cajas consumen el mismo inventario. Sin concurrencia real.

## 12. Cierres

Pantalla/diálogo de cierres con tres bloques separados: cierre de cajero/turno, cierre de caja/sesión y cierre diario de tienda, con filtros previstos por sede, caja, sesión, cajero y fecha. Solo maqueta.

## 13. Comprobante

`PosReceiptPreview` amplía cabecera (documento, fecha, sede, caja, cajero, canal), cliente completo, líneas con precio regular / descuento / precio final, totales con Bs. protagonista y pagos con método, monto, banco, referencia y tasa aplicada. Acciones: Imprimir · Descargar · Enviar · Nueva venta.

## 14. Auditoría

Cada acción sensible (venta, descuento, cambio de precio, anulación, devolución, reimpresión, suspensión, recuperación, apertura, cierre) queda registrada en un log en memoria con cajero, caja, sesión y hora, listo para persistirse más adelante.

## Fuera de alcance

Backend, cobros reales, stock real, migraciones, integración bancaria o fiscal, concurrencia real, motor de promociones.

## Verificación

Recorrido del POS en el navegador: catálogo con precio tachado, carrito con resumen, cobro mixto con dos métodos, canal de venta y comprobante final; `tsgo --noEmit` y build en 0 errores.
