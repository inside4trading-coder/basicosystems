# Resolver pendientes de proveedor externo sin exigir vínculo Core

## Qué está pasando (verificado)

La venta de la Gorra (Woo #33910 / var 33911, pedido #34786) se reservó el día que se procesó con la ruta que la política tenía **en ese momento**: el movimiento quedó guardado con `fund_bucket = internal_factory` y `replenishment_route = internal_factory` en su snapshot, con costo 5.34.

La política actual de ese producto (`core_replenishment_policies`, Woo 33910) ya dice:
- ruta: `external_supplier`
- proveedor: China
- costo proveedor: 5.34 USD

Pero el listado de Necesidades arma la fila "Sin vínculo Core" mirando **solo** el movimiento: bucket `internal_factory` + `core_product_id`/`core_variant_id` nulos. Nunca consulta la política vigente, así que exige vínculo Core interno para algo que ya está clasificado como compra externa.

## Qué se va a cambiar

### 1. Clasificación de pendientes (solo vista)

En el hook que arma las filas de "Requieren atención", cruzar cada movimiento sin vínculo Core con su política vigente por `woo_product_id` y aplicar esta prioridad:

1. Política con ruta `external_supplier` y costo válido (> 0, del proveedor o del movimiento) → fila **"Proveedor externo"**, con proveedor y costo, sin pedir vínculo Core.
2. Política no restock / `restock_enabled = false` → **"No restock"**.
3. Política con reemplazo definido → **"Reemplazo"**.
4. Solo si no hay ninguna de las anteriores → **"Sin vínculo Core"**.

Esto es únicamente cómo se muestra y qué acciones se ofrecen; no se reprocesa nada en lote.

### 2. Acciones en la fila "Proveedor externo"

Sustituir "Decidir reserva" (que hoy obliga a elegir producto Core fabricable) por un diálogo corto con el texto:

"Esta venta ya tiene ruta proveedor externo y costo operativo. Puedes resolverla como reposición externa sin vincularla a fabricación interna."

y dos acciones:
- **Confirmar como reposición externa**: mueve la reserva de partida fabricación interna → partida proveedores (par de movimientos out/in, igual que hace hoy el caso "no restock"), marca el movimiento como resuelto y lo deja disponible en el listado de reposición externa.
- **Marcar revisado**: solo cierra el pendiente, sin mover dinero (para casos ya comprados por fuera).

Además, botón **"Abrir reposición externa"** que lleva al listado de compras externas filtrado por ese producto.

### 3. Mapa Woo/Core

En las filas con ruta proveedor externo y sin vínculo Core, mostrar la nota: "Proveedor externo sin vínculo Core interno. No requiere fabricación interna." — el estado "sin conexión + con costo" deja de leerse como error bloqueante.

### 4. Regla de vínculo obligatorio

El vínculo Core se exige solo en rutas de fabricación interna / reposición interna. Rutas proveedor externo, no restock y reemplazo quedan resolubles sin producto Core.

## Detalles técnicos

- `src/hooks/useReplenishmentPolicyEvents.ts`: al construir las filas `internal_missing_core`, hacer un lookup de `core_replenishment_policies` por los `woo_product_id` presentes y derivar `_kind` / `action` / `external_supplier_name` / `external_supplier_unit_cost_usd` según la prioridad descrita.
- `src/components/core/woocore/PolicyEventsAttentionPanel.tsx`: etiqueta "Proveedor externo", costo y reservado visibles, botones "Confirmar reposición externa" / "Marcar revisado" / "Abrir reposición externa".
- Nuevo diálogo ligero (o rama dentro de `UnlinkedCoreReserveDialog.tsx`) para el caso externo.
- Migración: extender `public.core_resolve_unlinked_core_movement` con la acción `external_supplier`, que reclasifica el importe de la partida `internal_factory` a la partida `external_supplier` (out/in, con `related_movement_id` y sello `unlinked_core_resolution` = `corrected` / `action: external_supplier`), respetando `p_dry_run` e idempotencia. Se conservan las acciones actuales.
- `src/pages/core/CoreWooCoreMap.tsx`: nota informativa para ruta externa sin vínculo Core.

## Validación

Con Woo #33910 / var 33911, pedido #34786:
- deja de aparecer como "Sin vínculo Core" y aparece como "Proveedor externo" con costo 5.34 y reservado 5.34;
- "Confirmar reposición externa" mueve los 5.34 a la partida de proveedores y el ítem queda visible en reposición externa;
- no se crea orden de producción interna;
- typecheck en 0 errores.

## No se toca

Ventas históricas, WooCommerce remoto, órdenes de producción existentes, nómina, inventario, QR ni productos internos ya vinculados. No hay backfill masivo: cada pendiente se reclasifica solo al pulsar Resolver.
