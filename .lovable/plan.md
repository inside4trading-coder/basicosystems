# Órdenes manuales de fabricación (España)

Reutiliza el sistema actual: las órdenes manuales se guardan en la misma tabla de solicitudes de fabricación que usan los pedidos WooCommerce, con los mismos estados (Pendiente → Fabricando → Listo → Entregado), las mismas recetas y el mismo consumo de blanks/DTF. No se crea ningún flujo ni tabla paralela.

## Cómo funciona hoy (verificado)

Las solicitudes se crean automáticamente al sincronizar pedidos Woo confirmados, con `source_type = 'woocommerce_order'` y referencia al pedido. La tabla ya soporta filas sin pedido asociado (producto, variante, cantidad, prioridad, notas son campos propios). Por tanto una orden manual es la misma fila con otro origen.

## Cambios en la base de datos

Añadir a la tabla de solicitudes de fabricación los campos que solo usan las órdenes manuales (todos opcionales):

- motivo y detalle del motivo (obligatorio en la app cuando el origen es manual)
- indicador "requiere envío"
- destinatario: nombre, teléfono, dirección, ciudad, provincia, código postal, país

El origen manual se guarda como `source_type = 'manual'` (valor ya soportado por la columna existente). La prioridad usa la columna existente con valores normal / alta / urgente.

## Nueva orden manual (formulario)

Botón "+ Nueva orden manual" en la cabecera de Fabricación ES, abre un diálogo:

1. Producto: buscador por nombre o SKU sobre los productos España existentes.
2. Variante: desplegable con las variantes reales del producto seleccionado (talla/color). No se crean variantes.
3. Cantidad: entero mayor que 0.
4. Envío: casilla "No requiere envío / recogida interna"; si no está marcada, se piden nombre, teléfono, dirección, ciudad, provincia, código postal y país, y se validan como obligatorios.
5. Motivo (obligatorio): Reemplazo, Error de pedido, Defecto, Cambio de talla, Muestra, Colaboración / regalo, Producción interna, Pedido especial, Otro. Con "Otro" se exige descripción.
6. Notas internas (opcional).
7. Prioridad: Normal / Alta / Urgente.

Validación de receta: al elegir producto y variante se consulta el resolvedor de materiales existente. Si no hay receta activa, se muestra una advertencia clara y el botón Crear queda bloqueado (nunca se crea en silencio).

Al confirmar se inserta la solicitud en estado Pendiente y la tabla se recarga: aparece de inmediato en el listado con el resto de órdenes.

## Listado de fabricación

- Badge **MANUAL** en la columna Marca para las órdenes de origen manual.
- Nueva columna/celda con motivo y destinatario (o "Recogida interna"), más prioridad visible como badge (Alta/Urgente destacadas).
- Nuevo filtro de origen: Todos / Automático (WooCommerce) / Manual, combinable con las pestañas actuales.
- El resto del flujo (Fabricar con preflight de materiales, Marcar listo, Entregar, Cancelar) funciona igual para las manuales.

## Notas técnicas

- Migración: `ALTER TABLE public.esp_fabrication_requests` añadiendo `manual_reason`, `manual_reason_detail`, `requires_shipping`, `ship_to_name/phone/address/city/province/postal_code/country`; check de motivo y de prioridad (`normal|alta|urgente`) tolerante con los datos actuales.
- Nuevo componente `src/components/espana/ManualFabricationDialog.tsx`; cambios de tabla, badge y filtro en `src/pages/espana/EspanaFabricacion.tsx`.
- Preflight de receta con la función `esp_resolve_fabrication_materials` ya existente; el consumo sigue usando `esp_consume_materials_for_fabrication_request`.
- No se llama a WooCommerce ni se toca stock Woo; el consumo de materiales solo ocurre al pulsar Fabricar, como ahora.
