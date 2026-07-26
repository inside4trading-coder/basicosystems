# Fase 2 — Sublime Mercancía: Envíos, Cajas y Asignación (aprobado)

Sin migración (tablas ya existen y confirmadas: `sublime_merch_shipments`, `sublime_merch_boxes`, `sublime_merch_items`). Sin storage, sin RPC, sin edge functions, sin recepción, sin CSV.

## Archivos a crear

1. **`src/components/sublime/mercancia/ShipmentEditorDialog.tsx`** — Dialog crear/editar envío. Campos: `shipment_number` (req), `sent_at`, `carrier`, `tracking_number`, `cost_per_kg_eur` (≥0), `status` (draft/in_transit/partially_received/received/cancelled), `notes`. Manejo de error de duplicado.

2. **`src/components/sublime/mercancia/BoxEditorDialog.tsx`** — Dialog crear/editar caja. Campos: `shipment_id` (req, selector; bloqueado en edición), `box_number` (req), `weight_kg` (≥0), `status` (pending/in_transit/received), `notes`. Acepta `defaultShipmentId`.

3. **`src/components/sublime/mercancia/AssignToShipmentDialog.tsx`** — Selector envío → selector caja filtrada por envío → confirmar. Si envío no tiene cajas: mensaje + botón "Crear caja" (abre `BoxEditorDialog` con envío prellenado). Valida en cliente antes de guardar.

4. **`src/components/sublime/mercancia/ItemsInTransitTab.tsx`** — Lista items con shipment+box y estado ≠ available/cancelled. Desktop: tabla completa (foto, nombre, envío/caja, fecha, compra, peso, €/kg, envío calc, total, PVP, margen, SKU, subido, estado, acciones). Mobile: cards. Acciones: Reasignar (abre AssignToShipment) y Editar (abre ItemEditorSheet). Botón "Marcar recibido" deshabilitado con tooltip "Recepción disponible en Fase 3."

5. **`src/components/sublime/mercancia/ShipmentsManagerDialog.tsx`** — Dialog compacto (no ruta nueva). Tabla envíos con expand para ver cajas. Acciones: nuevo envío, editar envío, crear caja, editar caja.

## Archivos a modificar

6. **`src/hooks/useSublimeMerch.ts`** — Añadir tipos `SublimeMerchShipment`, `ShipmentInput`, `SublimeMerchBox`, `BoxInput`. Queries: `useInTransitItems`, `useSublimeShipments`, `useSublimeBoxes(shipmentId?)`, `useShipmentBoxCounts`. Mutations: `createShipment`, `updateShipment`, `createBox`, `updateBox`, `assignItemToShipmentBox` (valida que la caja pertenezca al envío consultando DB; solo escribe `shipment_id`, `box_id`, `estado='in_transit'`; no toca precio/pvp/sku/fotos/subido/uploaded_*).

7. **`src/components/sublime/mercancia/ItemsUnassignedTab.tsx`** — Añadir botón/icono "Asignar a envío" (Truck) por fila y en card mobile → abre `AssignToShipmentDialog`.

8. **`src/components/sublime/mercancia/ItemEditorSheet.tsx`** — Reemplazar el placeholder "Asignación a envío/caja disponible en la siguiente fase." por bloque real (solo cuando el item ya existe): selectores shipment + box (filtrada), botón "Guardar asignación" que llama `assignItemToShipmentBox`. Cambio de shipment limpia boxId.

9. **`src/pages/sublime/SublimeMercancia.tsx`** — Header: botones "Nuevo envío" y "Gestionar envíos". Tab `in_transit` renderiza `<ItemsInTransitTab />` en lugar del placeholder. Tab `available` sin cambios (placeholder Fase 3).

## Validación esperada (ENV-2026-001, 8 €/kg → Caja 1 → Hoodie 20€/0.5kg/PVP 45)

- Sale de "Compras sin asignar" y aparece en "En camino".
- shipment y caja visibles.
- shipping_cost = 4 €, total = 24 €, margen = 21 €.
- Typecheck limpio (uso de `(supabase as any)` para las tablas nuevas, sin regeneración de types).
