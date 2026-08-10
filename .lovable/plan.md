# Modal "Nueva orden manual" con buscador y carga por lote

Objetivo: crear una sola orden manual con varios productos y varias tallas, cargados cómodamente desde el mismo modal.

## 1. Buscador en el selector de producto

Reemplazar el `Select` de "Producto de fabricación" por un combobox con búsqueda (mismo patrón ya usado en Inventario por sedes y Blanks/DTF):

- Input superior: "Buscar producto por nombre o SKU…"
- Filtro en tiempo real por nombre y SKU (multi-término, sin acentos).
- Altura máxima con scroll interno.
- Vacío: "No se encontraron productos".

## 2. Modal en dos zonas

**A. Formulario de agregado**
- Producto de fabricación (combobox con buscador)
- Tallas / variaciones con cantidades
- Observaciones del ítem (opcional)
- Botón "Agregar producto"

**B. Lista de productos agregados**
- Tarjeta por producto: `SKU — Nombre`, tallas con cantidad, nota del ítem.
- Acciones por ítem: Editar (recarga el bloque en el formulario) y Eliminar.
- Total de unidades y de líneas visible.

**Campos de la orden (una sola vez, fuera del bloque por producto):** Motivo, Prioridad, Fecha esperada, Observaciones generales.

## 3. Comportamiento

- "Agregar producto" solo añade a la lista temporal; no crea nada.
- Bloquea agregar si todas las cantidades del producto están en 0.
- Producto repetido: se fusiona automáticamente por talla (suma cantidades) y se avisa con un toast "Se sumaron cantidades a un producto ya agregado".
- Al agregar, el formulario se limpia y el selector queda listo para buscar el siguiente.
- Botón principal "Crear orden": requiere Motivo y al menos 1 ítem.
- Cerrar el modal con ítems cargados pide confirmación antes de descartar.
- Mobile: modal a pantalla casi completa con scroll; lista en tarjetas apiladas.

## 4. Backend (necesario)

Hoy la función `core-create-production-order` en modo `manual` acepta un único `core_product_id`, así que multiproducto no es posible sin tocarla. Cambio mínimo y retrocompatible:

- Aceptar además `items: [{ core_product_id, lines: [{core_variant_id, quantity}], notes? }]`.
- Si llegan `items`, normalizar a un array plano de líneas y crear **una sola** orden:
  - cabecera igual que el flujo `from_needs` multiproducto: si hay más de un producto, `core_product_id = null`, `sku = "MULTI (n)"`, `product_name = "Lote multiproducto · …"`; si hay uno solo, se comporta como hoy.
  - misma verificación de política por línea (bloqueo 409 con `blocked_lines`).
  - mismo resolutor de costo por línea (`resolve_core_operational_unit_cost`).
  - procesos: se insertan solo cuando la orden tiene un único producto (igual que `from_needs`).
- El payload antiguo (`core_product_id` + `lines`) sigue funcionando.

## 5. Archivos afectados

- `src/pages/core/CoreProductionOrders.tsx` — estado del modal (lista temporal `manualItems`), combobox con buscador, lista de agregados, editar/eliminar, confirmación al cerrar, envío con `items`.
- `supabase/functions/core-create-production-order/index.ts` — modo `manual` multiproducto.

Sin cambios de base de datos.

## 6. Verificación

Typecheck con `tsgo` y prueba del flujo: buscar producto, agregar 2–3 productos con tallas, repetir uno para ver la fusión, editar, eliminar y crear la orden única.
