# Excepciones de material y nota de producción por solicitud (Basico España)

Capa de excepción por fabricación concreta: el operario puede sustituir el material real que usará (por ejemplo, blank XL en lugar del L que pide la receta) sin que cambie nada del pedido, del producto ni de la receta.

## Cómo funciona hoy (verificado)

- El botón "Fabricar" abre un modal que llama al resolvedor de materiales: por cada línea de la receta muestra el material resuelto (para blanks, la talla se deduce de la talla del pedido), el stock disponible y si hay suficiente.
- Al confirmar, el consumo vuelve a resolver la receta por su cuenta, descuenta stock, registra un movimiento de material y una fila de consumo por línea. Hoy no acepta ninguna elección del operario.
- La tabla de consumos guarda receta, línea de receta, material consumido, cantidades y movimiento; no distingue entre material previsto y material realmente usado.
- Cada solicitud ya tiene un campo de notas (hoy solo se rellena al crear órdenes manuales y no se ve en el listado).

## 1. Cambiar material en el modal

En cada fila de "Materiales requeridos" se añade la acción "Cambiar material". Abre un selector "Seleccionar material utilizado" con materiales reales del inventario de la misma ubicación:

- Mismo tipo de material y misma familia (nombre + color) que el material previsto, estado activo, y también cualquier material del mismo tipo si el operario amplía la búsqueda.
- Cada opción muestra código/SKU, talla o variante y stock disponible en la ubicación.
- Sin texto libre: solo materiales existentes.
- Se puede cambiar cada línea por separado (blank, DTF u otros).
- Botón para deshacer y volver al material previsto.

Aplica a blanks, DTF y cualquier otra línea de la receta.

## 2. Indicación visual de la excepción

Cuando una línea se sustituye, la fila muestra "Esperado: …" tachado o en gris, "Usado: …" destacado y una insignia **Material sustituido**, más un resumen antes del botón de confirmar. Si no se cambia nada, el modal se ve y se comporta exactamente igual que hoy.

## 3. Consumo real y validación

Al pulsar "Consumir materiales y fabricar" se envía la lista de sustituciones. El consumo, dentro de la misma operación bloqueante de hoy:

- Usa el material elegido cuando existe sustitución; si no, el de la receta.
- Vuelve a leer el stock en ese momento (evita datos viejos) y bloquea la fabricación con mensaje claro si el material alternativo no alcanza.
- Verifica que cada material sustituido exista, esté activo y tenga stock en la ubicación.
- Descuenta solo el material realmente usado; el previsto no se toca.

## 4. Trazabilidad

Cada línea de consumo guarda: material previsto, material usado, cantidad requerida, cantidad consumida, si hubo sustitución, la nota/motivo, el usuario y la fecha. El movimiento de inventario deja constancia de la sustitución en su nota. La receta original no se modifica nunca.

En el modal, si la solicitud ya fue fabricada con sustitución, se muestra el historial (previsto → usado, cantidad, operario, fecha).

## 5. Nota de producción por solicitud

Se reutiliza el campo de notas que ya tiene cada solicitud (no se crea nada nuevo ni se toca el producto global):

- En el listado, debajo del producto/SKU aparece una segunda línea discreta "Nota: …".
- Se puede agregar, editar y borrar desde la propia fila (icono de nota → diálogo con textarea) y también desde el modal "Fabricar solicitud".
- La nota viaja como motivo/comentario al registrar el consumo.

## 6. Qué no cambia

Talla y variante del pedido, SKU final, producto, pedido y variante de WooCommerce, cliente, resultado de fabricación, POS, recetas base, Basico Core Venezuela, QR, nómina y órdenes de producción quedan intactos. Si el operario no modifica nada, el flujo es idéntico al actual.

## Notas técnicas

- Migración sobre `public.esp_fabrication_material_consumptions`: añadir `expected_material_id uuid`, `expected_variant_id uuid`, `actual_material_id uuid`, `was_overridden boolean not null default false`, `override_reason text` (se mantienen `material_id`, `planned_quantity`, `consumed_quantity` por compatibilidad; `material_id` = material realmente consumido).
- `public.esp_consume_materials_for_fabrication_request` gana el parámetro `p_overrides jsonb default '[]'` con elementos `{recipe_item_id, material_id}`. Por cada línea: resolución actual → si hay override, validar material activo y del mismo `material_type`, releer `esp_material_stock` con `FOR UPDATE`, y consumir el override. Se rellenan las columnas nuevas y la nota del movimiento indica la sustitución. Mismo `SECURITY DEFINER` y misma comprobación `has_module_access(v_uid, '/espana')`.
- `public.esp_resolve_fabrication_materials` añade al JSON de cada material `material_id` previsto explícito y las alternativas no son necesarias: el selector consulta `esp_material_items` + `esp_material_stock` desde el cliente filtrando por `material_type`/familia y `location_id` devuelto por el resolvedor.
- Nuevo componente `src/components/espana/MaterialOverridePicker.tsx` (popover con buscador tipo Command, igual que el buscador de productos existente) y `src/components/espana/FabricationNoteDialog.tsx`.
- Cambios en `src/pages/espana/EspanaFabricacion.tsx`: estado `overrides` dentro de `preflight`, filas de materiales con acción y badge, envío de `p_overrides` en `confirmConsume`, columna de nota en la tabla y consulta del historial de consumos cuando la solicitud ya está en fabricación.
- Las notas de producción (origen "Nota") mantienen su propio flujo actual sin cambios.
