# Sublime V2 — Abastecimiento + nuevo POS visual

Solo prototipo visual. No se toca lógica funcional existente, ni backend, ni datos.

## 1. Renombrar Mercancía → Abastecimiento

El módulo pasa a llamarse **Abastecimiento**, con subtítulo "Compras, envíos y preparación de producto".

Nueva página contenedora con cinco secciones visibles:

```text
ABASTECIMIENTO
 ├─ Compras        (pestaña actual "Compras sin asignar")
 ├─ En tránsito    (pestaña actual "En camino")
 ├─ Preparación    (pantalla de preparación existente)
 ├─ Envíos         (gestor de envíos y cajas, hoy en diálogo)
 └─ Recepción      (recepción de mercancía, hoy en diálogo)
```

La pestaña "Disponible" sale de Abastecimiento: disponible es una condición del inventario, no una etapa de abastecimiento ni una ubicación.

El menú lateral de Sublime queda en dos grupos claros:

```text
ABASTECIMIENTO          INVENTARIO
 Compras                 Almacén
 En tránsito             Tienda
 Preparación             Movimientos
 Envíos                  Unidades
 Recepción               Conteos (próximamente)
```

"Unidades" y "Conteos" se crean como pantallas de marcador con el diseño del hub; Conteos queda marcado como preparado para RFID.

Las direcciones web actuales siguen funcionando (redirigen a las nuevas), así que ningún enlace guardado se rompe. El módulo equivalente de Basico Core no cambia de nombre en este paso.

## 2. Nuevo POS

Se descarta la interfaz actual del POS y se construye una nueva, con el lenguaje visual Basico Systems.

**Pantalla completa, sin menú del hub.** Desde el hub aparece un botón grande **ABRIR POS** que lo lanza en su propia dirección, lista para funcionar más adelante como aplicación independiente. El POS solo consume datos del Hub (productos, variantes, precios, inventario, clientes, sede, caja, usuario, configuración); el Hub sigue siendo la fuente de verdad.

**Cabecera:** SUBLIME POS · Sede (Sublime Barquicenter) · Caja 1 · Cajero · Tasa BCV · estado de conexión. Acciones: cambiar caja, abrir/cerrar caja, salir.

**Catálogo (izquierda, ~68%):** buscador por producto/SKU/código, botón identificar/escanear, chips de categorías y rejilla de tarjetas con imagen, nombre, variante, SKU pequeño, precio y stock disponible **solo de la tienda activa** (nunca sumando almacén).

**Carrito (derecha, fijo):** líneas con imagen, nombre, talla/color, − cantidad +, precio unitario, total y eliminar. Debajo: subtotal, descuento, impuestos, total muy destacado, selector de cliente (venta sin cliente / seleccionar / crear) y CTA grande **COBRAR**.

**Cliente:** nombre, cédula/RIF, teléfono, correo, fecha de nacimiento, dirección. Ningún campo se muestra como obligatorio salvo el nombre.

**Cobro:** pantalla amplia con TOTAL USD y su equivalencia en VES según tasa. Métodos: punto de venta, pago móvil, efectivo USD, efectivo VES, Zelle, transferencia, Cashea y pago mixto. Cada método pide sus propios campos (banco, referencia, terminal…) desde una definición central, para poder añadir métodos nuevos sin rehacer la pantalla.

**Pago mixto (prioritario):** añadir N métodos, con Total / Pagado / Faltante / Cambio siempre visibles y botón "+ Añadir otro método".

**Barra de funciones del POS** (visual, aún sin funcionar): descuentos, notas, cupones, suspender carrito, recuperar venta suspendida, cambios, devoluciones, historial, reimpresión, vendedor, apertura/cierre de caja.

**Comprobante:** vista previa de ticket y de factura con número, fecha/hora, sede, caja, cajero, datos del cliente, detalle por línea (producto, SKU, cantidad, precio, descuento, impuesto, total), moneda, tasa aplicada, equivalencia VES, pagos (método, monto, banco, referencia) y estado del documento. Al cerrar la venta: VENTA COMPLETADA con Imprimir, Descargar PDF, Enviar y Nueva venta. Sin integración fiscal ni impresora fiscal todavía.

## Detalle técnico

- Nuevas rutas: `/sublime/abastecimiento` (con subrutas compras / transito / preparacion / envios / recepcion), `/sublime/inventario/unidades`, `/sublime/inventario/conteos`, y `/pos` como POS a pantalla completa fuera de `SublimeLayout` (redirección desde `/sublime/pos`). Rutas viejas → `Navigate replace`.
- `src/components/sublime/mercancia/MercanciaModule.tsx` se reutiliza tal cual; las pestañas se exponen por ruta y los diálogos existentes (`ShipmentsManagerDialog`, `ReceiveMerchandiseDialog`) pasan a tener pantalla propia. Sin cambios en hooks ni en `src/lib/sublimeMerch.ts`.
- POS nuevo en `src/components/sublime/pos/`: `PosShell`, `PosHeader`, `PosCatalog`, `PosProductCard`, `PosCart`, `PosCustomerDialog`, `PosPaymentSheet`, `PosPaymentMethodFields`, `PosReceiptPreview`, `PosCompleted`, `PosFunctionsBar`; estado local en `usePosCart`. Se borra el contenido actual de `src/pages/sublime/SublimePOS.tsx`.
- Definición de métodos de pago tipada en `src/lib/posPaymentMethods.ts` (id, etiqueta, moneda, campos requeridos) para extender sin tocar la UI; tipos nuevos en `src/types/sublimeHub.ts` (`cashea`, documento de venta).
- Datos desde `src/lib/sublimeMock` (stock filtrado por `locationId` de la tienda activa). Sin nuevas tablas ni funciones de servidor.
- Solo tokens semánticos del sistema de diseño; nada de colores fijos.
