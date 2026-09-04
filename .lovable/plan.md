# Mercancía en Tránsito (BASICO CORE)

Duplicar el módulo de Sublime Mercancía dentro de Basico Core, con la misma interfaz y los mismos cálculos, pero con datos completamente separados.

## Qué verás al terminar

- Nueva opción en el menú de Basico Core: **Mercancía en Tránsito** (ruta `/core/mercancia-transito`).
- La misma pantalla que hoy existe en Sublime Mercancía: tarjetas de stock comprado y en camino, pestañas Compras sin asignar / En camino / Disponible, Exportar CSV, Configurar precios, Gestionar envíos, Nuevo envío, misma tabla, mismos cálculos de peso, €/kg, coste de envío, coste total, PVP, margen, comisión, SKU, estados y botón Recibido.
- Los productos, envíos, cajas y reglas de precio de Basico son independientes: nada de lo que se cree ahí aparece en Sublime, y viceversa.
- Donde hoy dice "SUBLIME" en textos y en la etiqueta de consignación ("CONSIGNACIÓN · 20% SUBLIME"), en el módulo nuevo dirá "BASICO". Los porcentajes y reglas no se inventan: se configuran desde "Configurar precios" del propio módulo Basico, que arranca vacío.

## Enfoque

Reutilizar los componentes existentes en vez de copiarlos, añadiendo un identificador de marca. Sublime sigue funcionando exactamente igual (por defecto marca `sublime`).

## Detalles técnicos

1. **Base de datos (una migración)**
   - Añadir `brand text NOT NULL DEFAULT 'sublime'` con CHECK (`sublime`, `basico`) a `sublime_merch_items`, `sublime_merch_shipments`, `sublime_merch_boxes`, `sublime_merch_pricing_rules`.
   - Índices por `brand` en items y shipments; ajustar cualquier unicidad de `sublime_merch_pricing_rules.product_type` para que sea única por (`brand`, `product_type`).
   - Las políticas RLS actuales se mantienen (mismos roles internos); no se crean tablas nuevas.
   - No se renombran tablas: son nombres técnicos internos ya en uso.

2. **Contexto de marca en el frontend**
   - Nuevo `MerchBrandContext` (`src/components/sublime/mercancia/brand.tsx`) con `{ brand, label, basePath }`; hook `useMerchBrand()` con valor por defecto `sublime` para no alterar la página actual.
   - `src/hooks/useSublimeMerch.ts`: cada consulta añade `.eq("brand", brand)`, cada inserción escribe `brand`, y las claves de React Query incluyen la marca para no mezclar cachés.
   - `src/lib/sublimeMerch.ts`: la etiqueta de comisión pasa a usar el nombre de marca recibido en lugar del literal "SUBLIME"; misma fórmula de consignación, IVA y neto propietario. Igual en `ConsignmentBadge`, `ItemEditorSheet` y las cabeceras del CSV.
   - Las fotos siguen en el mismo bucket, con las rutas nuevas bajo prefijo por marca.

3. **Nueva página y menú**
   - `src/pages/core/CoreMercanciaTransito.tsx`: envuelve el mismo contenido de `SublimeMercancia` (extraído a un componente compartido `MercanciaModule`) dentro del proveedor con `brand="basico"` y título "Mercancía en Tránsito".
   - Ruta hija en `/core` en `src/App.tsx` y entrada en el menú de `CoreLayout.tsx` (bloque logístico, junto a Despachos/Inventario).
   - Añadir `/core/mercancia-transito` al listado de rutas de permisos (`src/hooks/useAuth.tsx`) siguiendo la convención de las demás rutas Core.

4. **Sin tocar**: `/sublime/mercancia` mantiene su ruta, su página y su comportamiento actual; no se modifican inventario Sublime, pedidos, Studio, fabricación, QR, nómina, WooCommerce ni OP.

## Verificación

- Typecheck y build.
- Comprobar en la vista previa que Sublime Mercancía sigue mostrando sus datos y que Mercancía en Tránsito arranca vacía y permite crear producto → envío → caja → recibido.
