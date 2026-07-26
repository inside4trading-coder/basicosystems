
# Fase 1 — Sublime Mercancía MVP

Aprobar este plan para pasar a build mode y aplicar la migración + código.

## 1. Migración (una sola)

Función reusable `public.set_updated_at()` + 3 tablas con GRANTs + RLS + triggers `updated_at`.

**`public.sublime_merch_shipments`**
shipment_number (unique), sent_at, received_at, carrier, tracking_number, cost_per_kg_eur (default 0), status CHECK (draft/in_transit/partially_received/received/cancelled), notes, created_by.

**`public.sublime_merch_boxes`**
shipment_id (fk cascade), box_number, weight_kg (default 0), status CHECK (pending/in_transit/received), received_at, received_by, notes. UNIQUE(shipment_id, box_number). Índice por shipment_id.

**`public.sublime_merch_items`**
name, precio_compra, codigo_fabricante, peso_kg, pvp, sku_web (unique), fotos_origen text[], fotos_web text[], shipment_id (fk set null), box_id (fk set null), estado CHECK (purchased/in_transit/received/available/cancelled), subido_al_sistema, uploaded_at, uploaded_by, received_at, received_by, tax_enabled, tax_amount, tax_note, notas, created_by. Índices en shipment_id, box_id, estado, sku_web.

**RLS**: en las 3 tablas, una policy `FOR ALL TO authenticated` con `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')` en USING y WITH CHECK.
**GRANTs**: SELECT/INSERT/UPDATE/DELETE a `authenticated`; ALL a `service_role`.

## 2. Ruta

- `src/App.tsx`: `<Route path="/sublime/mercancia" element={<SublimeMercancia />} />` dentro del bloque protegido.
- `src/pages/Sublime.tsx`: nueva card "Mercancía" (icono Package) enlazando a `/sublime/mercancia`.

## 3. Archivos nuevos

- `src/pages/sublime/SublimeMercancia.tsx` — header + 3 Tabs. Tabs 2 y 3 son placeholders con contador y texto "Disponible en la siguiente fase".
- `src/components/sublime/mercancia/ItemsUnassignedTab.tsx` — tabla desktop / cards móvil (usa `useIsMobile`), botón "Agregar producto", acción "Editar".
- `src/components/sublime/mercancia/ItemEditorSheet.tsx` — Sheet lateral. Campos: name, precio_compra, codigo_fabricante, peso_kg, pvp, sku_web, notas + checkbox "Subido al sistema" con validaciones. Bloque colapsado "Impuestos preparados para fase posterior…" y bloque disabled "Asignación a envío/caja disponible en la siguiente fase".
- `src/hooks/useSublimeMerch.ts` — `useUnassignedItems`, `useItemsCounts`, `createItem`, `updateItem`.
- `src/lib/sublimeMerch.ts` — `calculateShippingCost`, `calculateTotalCost`, `calculateMargin`, `canMarkUploaded` + mensajes de error.

## 4. Validaciones del editor

- `name` requerido; `precio_compra`, `peso_kg` >= 0; `pvp` >= 0 si presente.
- `sku_web` opcional, único por constraint.
- Toggle "Subido al sistema":
  - Sin sku_web → "Debes asignar un SKU web antes de marcar este producto como subido al sistema."
  - Sin pvp → "Debes asignar un PVP antes de marcar este producto como subido al sistema."
  - Activar: `subido_al_sistema=true, uploaded_at=now(), uploaded_by=auth.uid()`.
  - Desactivar: solo `subido_al_sistema=false` (mantener trazabilidad).

## 5. Cálculos derivados

```
shipping = peso_kg * (shipment?.cost_per_kg_eur ?? 0)
total    = precio_compra + shipping
margin   = (pvp ?? 0) - total
```
Fase 1: sin shipment → "costo total estimado" = `precio_compra`.

## 6. Fuera de alcance

Fotos, CSV, storage bucket, CRUD envíos/cajas, marcar recibido, tab Disponible operativo, Woo, POS. No se toca Fichaje, Administración, Core.

## 7. Orden al pasar a build mode

1. Aplicar migración.
2. Regenerar types.
3. Crear helpers + hook.
4. Crear editor y tab de compras sin asignar.
5. Crear página con tabs + registrar ruta + card en `/sublime`.
6. Typecheck.
