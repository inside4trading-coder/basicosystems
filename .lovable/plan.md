# Sublime Hub V2 — Arquitectura visual navegable

Evolucionar Sublime hacia un sistema operativo completo de tienda, en modo prototipo navegable. Lo que ya funciona (Mercancía, Administración, Fichaje) se conserva intacto y se reubica dentro de la nueva navegación.

## Qué vas a poder hacer al terminar

Entrar a Sublime y recorrer el ciclo completo de una prenda: compra → en camino → preparación → publicación → recepción → almacén → tienda → venta → cierre → administración. Las pantallas nuevas muestran datos de ejemplo; las actuales siguen con datos reales.

## Navegación

Nueva portada de Sublime con 8 accesos: Resumen, Mercancía e Inventario, POS, Cierres, Administración, Clientes, Dashboard, Fichaje. Se añade una barra de submódulos propia de Sublime (mismo estilo que Basico Core y España) para moverse entre secciones sin volver a la portada.

Rutas nuevas, sin tocar las existentes:

```text
/sublime                         portada (ya existe)
/sublime/resumen
/sublime/mercancia               módulo actual + nuevas pestañas
/sublime/mercancia/preparacion
/sublime/mercancia/preparar/:id  workspace de preparación
/sublime/inventario/almacen
/sublime/inventario/tienda
/sublime/inventario/movimientos
/sublime/pos
/sublime/pos/ventas
/sublime/cierres
/sublime/clientes
/sublime/dashboard
/sublime/admin/obligaciones      (ya existe, sin cambios)
/sublime/admin/fichaje           (ya existe, sin cambios)
/sublime/fichaje                 pantalla pública (sin cambios)
```

## Módulos

**Resumen** — Ventas de hoy/semana/mes, unidades, ticket promedio, inventario disponible/almacén/tienda, mercancía en camino y pendiente de preparar, cierres pendientes, pagos por conciliar y obligaciones próximas. Bloque "Acciones rápidas": nueva venta, recibir mercancía, mover mercancía, preparar producto, cerrar caja, ver inventario.

**Mercancía e Inventario** — Se mantienen las tres pestañas actuales y se añaden Preparación, Almacén, Tienda y Movimientos. La pestaña "Disponible" se conserva por compatibilidad con el módulo actual, pero en la nueva navegación se presenta como "Inventario general": una vista agregada por estado, no una ubicación. Almacén y Tienda son las ubicaciones. En Compras se añade una columna Preparación (Sin preparar / En preparación / Listo / Publicado) y la acción "Preparar producto".

**Preparación** — Listado de productos pendientes de publicar con porcentaje de avance y checklist (precio, tallas, SKU, título, descripción, imágenes web). Acción "Continuar preparación".

**Workspace Preparar producto** — Pantalla completa en bloques: Datos de origen (solo lectura), Producto (título, marca, categoría, colección, color, atributos, descripción, etiquetas, con botones simulados de IA para título/descripción/SEO), Variantes (tabla talla + color + cantidad + SKU; el SKU definitivo nace aquí), Precio (compra + envío = costo unitario, margen, IVA, PVP sugerido/manual/final, sin cambiar las reglas de cálculo actuales), Imágenes (referencia y web, con generación IA simulada y aprobar/regenerar/eliminar), y Publicación (checklist + botón Publicar con canal sublime.com.ve).

**Recibir mercancía** — Se crea el flujo visual "Recibir mercancía" como capa de prototipo: cantidades esperadas por talla, campos de cantidades recibidas, diferencia calculada y confirmación que muestra las unidades físicas creadas y su ubicación. El botón "Recibida" actual mantiene intacta su lógica real, sus tablas y su escritura en esta fase; las unidades UNIT-XXXXXX son mock.

**Almacén y Tienda** — Dos pantallas con el mismo diseño: producto, variante, SKU, cantidad, unidades físicas, costo/PVP, valor, fecha, estado y ubicación. Filtros por marca, categoría, talla, color, SKU, fecha y estado. Acciones: mover, ver unidades, ajustar, historial.

**Ciclo de vida del producto** — Acción "Ver historial", disponible desde la ficha del producto y desde el listado, que abre una línea de tiempo vertical con los hitos: Comprado → Asignado a envío → En tránsito → Preparado → Publicado → Recibido → Almacén → Tienda → Vendido. Cada hito muestra fecha, responsable y ubicación cuando aplica; los hitos no alcanzados se ven atenuados. En esta fase combina información mock con los datos reales ya disponibles (compra, envío, recepción).

**Unidades físicas** — Panel "Ver unidades" desde cualquier variante: lista de UNIT-XXXXXX con ubicación, estado, QR, campo RFID ("No asignado"), fecha de recepción e historial.

**Mover mercancía** — Pantalla simple: origen, destino, botón "Identificar prendas", lista de unidades identificadas, contador y confirmación del movimiento.

**Movimientos** — Registro visual con fecha, tipo, producto, SKU, unit ID, origen, destino, usuario y motivo. Tipos: recepción, transferencia, venta POS, venta web, devolución, ajuste, daño, pérdida, conteo. Con filtros.

**POS** — Catálogo/búsqueda a la izquierda (nombre, SKU, código, escaneo, selección de talla) y carrito a la derecha. Sección Cliente opcional (nombre, cédula, teléfono, correo, nacimiento, dirección) con venta sin cliente permitida. Pago en USD/VES con efectivo, punto, transferencia, pago móvil, Zelle, divisa y mixto, incluyendo referencia, banco, cuenta y tasa. Resumen y confirmación de venta, con comprobante y nueva venta. Historial con ventas, cambios/devoluciones y clientes.

**Cierres** — Pestañas Hoy, Punto de venta, Efectivo, Pagos móviles e Historial. Cierre de punto: esperado vs ticket, diferencia, foto y responsable. Cierre de efectivo: contador de billetes USD y VES, contado, diferencia y responsable. Pagos móviles: del día, pendientes de conciliación, confirmados y diferencias.

**Administración** — Se conserva Obligaciones tal como está y se envuelve en pestañas: Resumen, Cuentas, Conciliación, Obligaciones (la actual), Reposición y Balance. Reposición muestra capital recuperado por costo de mercancía vendida y margen bruto, con consignación separada.

**Clientes** — Listado (nombre, cédula, teléfono, correo, compras, última compra, ticket promedio) y ficha con historial, productos, métodos de pago y notas.

**Dashboard** — Métricas comerciales: ventas por período, ticket, unidades, top productos/marcas/tallas/colores, métodos de pago, canal, horas y días fuertes, inventario valorizado, lento y crítico, rotación, consignación y margen.

**Fichaje** — Sin cambios.

## Detalles técnicos

- Layout `SublimeLayout` con `Outlet`, siguiendo el patrón de `CoreLayout`/`EspanaLayout`; rutas nuevas anidadas en `App.tsx` sin alterar las existentes.
- Todos los datos ficticios viven en `src/lib/sublimeMock/` (fixtures tipados por dominio: inventario, unidades, movimientos, ventas, cierres, clientes, métricas, ciclo de vida). Ningún dato mock se escribe en tablas reales ni se crean migraciones.
- Tipos nuevos en `src/types/sublimeHub.ts` con la separación Producto / Variante / Unidad y campos `status` y `location` independientes, `location_id` referenciando un catálogo de ubicaciones (no dos constantes fijas), y `rfid_epc` opcional en la unidad.
- El campo actual "SKU web" se trata como legacy: se conserva, se sigue mostrando y exportando, pero no es la base conceptual del nuevo modelo. En V2 el SKU definitivo nace en "Preparar producto", a nivel de variante. No se borra ni se migra ningún dato histórico.
- Principios inalterables en toda la interfaz: Producto ≠ Variante ≠ Unidad física; SKU ≠ UNIT ID ≠ RFID EPC; Status ≠ Location.
- Lenguaje de interfaz neutro respecto al hardware: "Identificar prendas", "Escanear unidades", nunca "Escanear QR" como concepto estructural.
- Reutilización estricta de componentes existentes (Card, Table, Tabs, Sheet, Dialog, Badge, Button) y tokens del sistema; sin colores nuevos ni gradientes.
- `MercanciaModule`, `ItemEditorSheet`, recepción, envíos, cajas, reglas de precio, consignación y CSV se conservan sin cambios funcionales; solo se añaden pestañas y una columna.
- Se añaden las rutas nuevas al catálogo de permisos existente bajo el mismo permiso `sublime`.

## Fuera de alcance en esta fase

RFID real, hardware, POS bancario, bancos, tasa BCV real, WooCommerce definitivo, conciliación automática y contabilidad. Sin backend funcional nuevo, sin migraciones y sin cambios en tablas reales. Al terminar se revisa toda la arquitectura visual antes de pasar a la fase funcional.
