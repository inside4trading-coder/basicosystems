# Sublime POS — últimos ajustes (cliente, canales, factura)

Cambios solo visuales y de flujo sobre el prototipo actual. Sin backend, sin migraciones, sin cobros reales.

## 1. Cliente dentro del cobro

En la pantalla de COBRAR se añade un bloque fijo "Cliente", siempre visible:

- Sin cliente: botones `Seleccionar cliente` y `+ Registrar nuevo cliente`.
- Con cliente: ficha compacta (nombre, cédula/RIF, teléfono, correo) y acción `Cambiar cliente`.
- `Seleccionar cliente` abre el buscador existente (busca por nombre, cédula/RIF, teléfono y correo).
- `+ Registrar nuevo cliente` despliega el formulario dentro del mismo flujo de cobro (nombre/razón social, cédula/RIF, teléfono, correo, fecha de nacimiento, dirección) y al guardar queda seleccionado para la venta.
- El cliente sigue siendo opcional: se puede finalizar sin cliente.

## 2. Canales del POS

El selector manual queda con tres opciones únicamente: WhatsApp, Cashea, Tienda. Se retiran Instagram, Teléfono, Web y Otro de la selección manual (Web llegará después desde la integración). Se conserva el identificador `web` internamente para esas futuras ventas.

## 3. Identidad visual por canal

- WhatsApp: verde, texto claro.
- Cashea: amarillo pollito, texto negro.
- Tienda: fondo negro, texto amarillo.

La opción seleccionada se destaca con su color y el botón FINALIZAR VENTA adopta ese mismo estilo. Sin canal seleccionado el botón permanece deshabilitado y gris.

## 4. Origen ≠ método de pago

Se mantienen como dimensiones separadas; nunca se deduce el canal desde el método de pago. No hay cambios de lógica aquí, solo se conserva la separación actual.

## 5. Número de factura (opcional)

Campo de texto opcional en el bloque final del cobro. No bloquea la venta. Si se completa, aparece en el comprobante/factura, en el detalle de la venta y en el historial. No se genera automáticamente.

## 6. Orden del bloque de cobro

```text
TOTAL A COBRAR
CLIENTE (seleccionar / registrar)
MÉTODO(S) DE PAGO
TOTAL / PAGADO / FALTANTE / CAMBIO
ORIGEN DE LA VENTA *  [WhatsApp] [Cashea] [Tienda]
NÚMERO DE FACTURA (opcional)
[ FINALIZAR VENTA ]
```

Habilitación de FINALIZAR VENTA: faltante = 0 y origen seleccionado. Cliente y número de factura opcionales.

## Detalle técnico

- `src/lib/posSalesChannels.ts`: `POS_SALES_CHANNELS` pasa a `whatsapp | cashea | in_store`; el tipo mantiene `web` (y se marca como canal no seleccionable) para la futura integración.
- `src/lib/posChannelStyle.ts`: nuevos tokens de color por canal (verde / amarillo pollito con texto negro / negro con texto amarillo) para chip activo y botón de finalizar; `null` → estilo deshabilitado.
- `src/components/sublime/pos/PosChannelPicker.tsx`: chips con la nueva paleta y estado activo más marcado.
- `src/components/sublime/pos/PosPaymentSheet.tsx`: reordenar secciones según el bloque final, añadir el bloque Cliente (props `customer`, `onSelectCustomer`, formulario inline reutilizando los campos de `PosCustomerDialog`) y el campo `invoiceNumber` / `setInvoiceNumber`.
- `src/components/sublime/pos/PosCustomerDialog.tsx`: extraer el formulario de alta a un subcomponente reutilizable e incluir correo en el filtro de búsqueda.
- `src/pages/pos/SublimePosApp.tsx`: estado `invoiceNumber`, pasarlo al cobro y al documento de venta; limpiarlo en nueva venta.
- `src/components/sublime/pos/PosReceiptPreview.tsx`: `PosSaleDocument` gana `invoiceNumber?: string | null`; se muestra en el encabezado cuando existe.
- Historial/detalle de venta: mostrar el número de factura cuando esté presente.
