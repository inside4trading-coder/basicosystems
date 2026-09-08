# Inventario Maestro Sublime — Mapeo Woo, Pendientes y Costos

## Principio

WooCommerce no es fuente de verdad. La cadena es:

```text
ABASTECIMIENTO / PREPARACION
        |
INVENTARIO MAESTRO SUBLIME  (sublime_products -> sublime_variants -> sublime_stocks)
        |
   +----+----+
   |         |
  POS   WooCommerce (solo mapping de canal en esta fase)
```

Ya existe V1 (tablas, pantallas Inventario Maestro / Validacion inicial / Pendientes, POS leyendo datos reales). Este plan lo extiende sin crear un segundo catalogo. La sincronizacion Hub -> Woo, el webhook de pedidos y la reconciliacion quedan para una fase posterior; aqui solo se deja el modelo preparado.

## 1. Conexion a la tienda Woo de Sublime

- Nuevas claves secretas: `WC_SUBLIME_BASE_URL`, `WC_SUBLIME_CONSUMER_KEY`, `WC_SUBLIME_CONSUMER_SECRET` (se piden de forma segura antes de programar).
- Nueva funcion `sublime-woo-catalog-read` (solo lectura): trae todos los productos y variaciones de Woo con paginacion completa y los guarda en una tabla espejo `sublime_woo_catalog` (id Woo, padre, tipo, nombre, SKU, atributos talla/color, precio, stock Woo, imagen, estado, permalink, ultima lectura). Nunca escribe en Woo.

## 2. Modelo de datos (una migracion)

- `sublime_woo_catalog`: espejo del catalogo Woo (arriba). Sirve para clasificar y para comparar stock.
- `sublime_channel_mappings`: canal (`woo`), `product_id`/`variant_id` del Hub, `external_product_id`, `external_variation_id`, `status` (`mapped | ignored`), `match_method` (`saved_id | sku | reference | manual`), `mapped_by`, `mapped_at`. Unico por canal + id externo. Sustituye a los campos sueltos `woo_product_id` / `woo_variation_id` (se mantienen como espejo de lectura para no romper V1).
- `sublime_variants` gana: `cost_ref` (numeric), `cost_source` (`abastecimiento | historico_manual | estimado | consignacion | otro`), `cost_note`.
- `sublime_stock_intake_proposals` gana `woo_qty` (stock Woo al momento de la propuesta, solo comparativo).
- RLS igual que V1: lectura autenticados, escritura con acceso al modulo `/sublime`.

## 3. Herramienta "Mapeo Woo <-> Hub" (nueva pantalla en Sublime)

Boton "Leer catalogo Woo" y una tabla con cada producto/variacion Woo clasificado como:

- **Mapeado**: ya existe mapping.
- **Posible coincidencia**: hubo candidato por SKU/referencia/nombre pero requiere confirmacion.
- **Sin mapear**: ningun candidato.
- **Incompleto**: mapeado pero la variante del Hub no cumple minimos.

Prioridad de matching (automatica solo para 1 y 2; 3 y 4 son sugerencias):

1. `woo_product_id` / `woo_variation_id` ya guardados.
2. SKU exacto contra `sublime_variants.sku`.
3. Codigo/referencia conocida (barcode, `manufacturerCode` del articulo de Abastecimiento vinculado).
4. Nombre + talla + color normalizados -> solo sugiere, nunca fusiona.

Acciones por fila:

- **Vincular** a producto/variante existente (buscador).
- **Crear producto maestro** desde los datos Woo: nombre, imagen, talla/color si vienen en atributos, precio como precio vigente REF, SKU solo si Woo lo trae; color/categoria/costo quedan en pendiente. Se guarda el mapping en el mismo paso.
- **Completar informacion** (abre la ficha del Hub).
- **Ignorar** (status `ignored`, reversible).

Un producto Woo sin SKU se recupera igual por su ID de Woo y recibe el SKU despues desde el Hub.

## 4. Pendientes de completar (ampliar pantalla existente)

Se agregan a `posBlockers` / `missingFields` los chequeos: sin costo, sin talla/variante clara, sin ubicacion, sin stock validado (sin propuesta confirmada), sin mapeo Woo. Cada fila permite editar en linea SKU, color, categoria, talla, precio, costo + origen del costo. Filtros por tipo de falta.

## 5. Estados de completitud

En `sublimeInventory.ts`:

- **Operativamente completa**: producto + variante + SKU + precio valido + al menos una ubicacion con stock confirmado.
- **Financieramente completa**: lo anterior + `cost_ref` valido con `cost_source`.

Badges en Inventario Maestro y Pendientes. El POS sigue exigiendo solo la completitud operativa + `pos_enabled`; "Habilitar en POS" se deshabilita si la variante no es operativamente completa.

## 6. Costos

- Importacion desde Abastecimiento (ya existe) rellena `cost_ref` desde el lote con `cost_source = abastecimiento` (o `consignacion` si el articulo es consignacion).
- Productos creados desde Mapeo Woo quedan con costo nulo; se asigna a mano con origen `historico_manual` / `estimado` / `otro`.
- Woo nunca escribe costo.

## 7. Validacion inicial con Woo como comparativo

La pantalla de Validacion inicial gana la columna **Woo** (leida del espejo por el mapping) junto a Sugerido Abastecimiento, Fisico Barquicenter, Fisico Almacen y Diferencia. Confirmar sigue fijando el stock oficial del Hub; Woo no se copia nunca automaticamente.

## 8. Fuera de alcance (fase siguiente)

Envio de disponibilidad Hub -> Woo, webhook de pedidos Woo -> Hub con `woo_order_id` idempotente, reconciliacion "Reparar Woo desde Hub", RFID, unidades fisicas, ventas reales.

## Detalles tecnicos

- Funcion nueva: `supabase/functions/sublime-woo-catalog-read/index.ts` (auth con `_shared/authz.ts`, modulo `/sublime`, paginacion `per_page=100` con `X-WP-TotalPages`).
- Libreria nueva: `src/lib/sublimeWooMatch.ts` (clasificacion y prioridad de matching, funciones puras testeables).
- Hooks nuevos en `src/hooks/useSublimeInventory.ts`: `useSublimeWooCatalog`, `useSublimeMappings`, `useLinkWooToVariant`, `useCreateProductFromWoo`, `useIgnoreWooItem`, `useUpdateVariantCost`.
- Pagina nueva: `src/pages/sublime/SublimeMapeoWoo.tsx`; ruta `/sublime/mapeo-woo` en `src/App.tsx` y entrada en el menu de `SublimeLayout.tsx`.
- Modificados: `sublimeInventory.ts` (tipos, blockers, completitud), `SublimeInventarioPendientes.tsx`, `SublimeInventarioValidacion.tsx`, `SublimeInventarioMaestro.tsx` (badges), `useImportSublimeCatalog` (cost_source).
- No se tocan: POS de Sublime salvo la regla de habilitacion, Abastecimiento, Core, Espana, ni las funciones Woo existentes de otras tiendas.
