# Validación inicial real y stock oficial por ubicación (Sublime)

Convertir `/sublime/inventario/validacion` en el punto donde nace el stock oficial por ubicación, con datos reales y confirmación auditable.

## Lo que ya existe y se reutiliza

- Ubicaciones reales: **Sublime Barquicenter** (tienda, vende en POS) y **Almacén Sublime** (almacén). No se crean nuevas.
- Catálogo maestro: productos, variantes y lotes de origen (compra/abastecimiento con costo y consignación).
- Existencias oficiales por variante y ubicación, con cantidad disponible calculada.
- Propuestas de conteo inicial (sugerido, contado, estado, usuario, fecha) y la referencia de la tienda web por mapeo.
- Botón "Proponer stock inicial" en Inventario Maestro y la pantalla de validación con la tabla y el botón "Ver también confirmadas".

Hoy la validación funciona a medias: solo propone para la tienda, borra la cantidad sugerida al confirmar, no deja rastro de movimiento, no permite confirmar varias filas y no distingue pendientes / confirmadas / todas.

## Cambios

### 1. Proponer stock inicial
- Genera propuestas para **ambas ubicaciones** y para todas las variantes activas del catálogo que aún no estén confirmadas.
- Cantidad sugerida = unidades provenientes de compras ya recibidas para esa variante. Si no hay dato fiable, queda en 0 y la tabla muestra "Sin referencia".
- Nunca duplica: si ya existe propuesta para esa variante y ubicación, la actualiza; si está confirmada, no la toca.

### 2. Tabla de validación
Columnas: producto, variante, SKU, sugerido, stock web (solo si hay mapeo; si no, "—"), físico Barquicenter, físico Almacén, total físico, diferencia (total físico − sugerido), estado y acción.
Los conteos aceptan solo enteros mayores o iguales a cero. Total y diferencia se calculan al escribir.

### 3. Confirmar (individual y masivo)
- "Confirmar" en la fila y "Confirmar seleccionadas" para varias filas ya completadas, con casillas de selección.
- Al confirmar: se fija el stock oficial de esa variante en cada ubicación, se registra un movimiento auditable de validación inicial, la propuesta pasa a confirmada con usuario y fecha, y se conserva la cantidad sugerida original como histórico.
- Todo ocurre en una sola operación: si falla el stock o el movimiento, nada queda confirmado.
- Doble clic o reintento no vuelve a contar: una variante ya confirmada se rechaza con aviso claro.
- En masivo, las filas con datos inválidos se informan una a una sin detener las válidas.

### 4. Filtro de estado
El botón actual pasa a un selector de tres opciones: Pendientes / Confirmadas / Todas. Las confirmadas muestran conteos, diferencia, fecha, usuario y estado "Confirmado", y permanecen como histórico.

### 5. Inventario Maestro
Las unidades por variante y por ubicación se leen del stock oficial ya existente, que se actualiza al confirmar. Sin cantidades inventadas.

## Detalles técnicos

- Nueva tabla `sublime_inventory_movements` (variante, ubicación, tipo, cantidad delta, cantidad resultante, referencia a la propuesta, usuario, nota, fecha) con RLS y permisos iguales al resto del módulo Sublime. Tipo `initial_inventory_validation`.
- Nueva función de base de datos `sublime_confirm_initial_validation(variant_id, counts jsonb, note)`, `security definer`, que bloquea las filas de propuesta con `for update`, rechaza si ya están confirmadas, escribe existencias, inserta movimientos y marca la propuesta. Atómica por definición.
- `useConfirmProposal` pasa a llamar esa función; se añade `useConfirmProposalsBulk` que la invoca por variante y devuelve éxitos y errores por fila.
- `useProposeInitialStock` deja de recibir una sola ubicación y cubre las dos, incluyendo variantes sin lote recibido con sugerido 0.
- Archivos: `src/hooks/useSublimeInventory.ts`, `src/pages/sublime/SublimeInventarioValidacion.tsx`, `src/pages/sublime/SublimeInventarioMaestro.tsx`, `src/lib/sublimeInventory.ts` (tipos), más la migración.

## Prueba final

Con una variante real: proponer stock inicial, introducir 2 en tienda y 1 en almacén, confirmar y comprobar que el stock oficial queda en 3 (2 tienda / 1 almacén), que existen los movimientos auditables y que Inventario Maestro muestra 3.

## Fuera de alcance

POS, reglas y escritura de Woo, Cierres, Administración, Básico Core, España, Studio, diseño general y cualquier refactor.
