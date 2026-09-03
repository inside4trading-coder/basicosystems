# BASICO CORE — Separar Lifecycle de política de reposición

## Estado actual confirmado

- `core_replenishment_policies` ya modela por separado `lifecycle_status`, `replenishment_route` y `restock_enabled`.
- El resolver `resolve_core_replenishment_action` prioriza Lifecycle (`ignored`, `no_restock`, `exit`, `replaced`) y después evalúa la ruta (`external_supplier`, `manual_cost_only` o fabricación interna).
- La configuración actual no expone una opción explícita de “Restock / Reposición” en el diálogo principal.
- `LifecycleStatusDialog` calcula `restock_enabled` directamente desde Lifecycle (`active` = true), acoplando ambos conceptos.
- `NoRestockConfigDialog` guarda `restock_enabled = false` para cualquier selección, incluso cuando la intención debe expresarse mediante otra política.
- `ReplenishmentRouteDialog` cambia la ruta, pero no deja visible ni ajusta de forma explícita la política de reposición.
- La base actualmente contiene políticas activas con reposición habilitada, activas con ruta de proveedor externo, y políticas explícitas de no restock/archivadas; no se modificarán esos registros automáticamente.

## Cambio propuesto

1. **Separar la UI en dos decisiones visibles** dentro de “Configurar política”:
   - **Estado comercial / Lifecycle:** Activo, No restock, En salida, Reemplazado y los estados históricos que ya admite el modelo.
   - **Política de reposición:** Restock / Reposición, No restock, En salida, Reemplazado, o las rutas operativas existentes según corresponda.
2. Añadir una opción explícita **“Restock / Reposición”** que represente un producto comercialmente activo y habilitado para generar reposición normal, sin crear un nuevo valor incompatible con el modelo.
3. Mantener `replenishment_route` con sus valores existentes: `internal_factory`, `external_supplier`, `manual_cost_only`, `no_restock`, `exit`, `ignored` y `replaced`. La opción “Restock / Reposición” usará la ruta operativa adecuada, normalmente `internal_factory`, y conservará `restock_enabled = true`.
4. Ajustar el guardado para que:
   - Lifecycle se persista únicamente desde el selector de Lifecycle.
   - La política/ruta y `restock_enabled` se persistan desde la decisión de reposición.
   - Lifecycle `active` no fuerce por sí solo una política concreta.
   - `no_restock`, `exit`, `ignored` y `replaced` mantengan sus bloqueos y requisitos actuales.
   - `external_supplier` continúe siendo reposición válida por compra externa, sin convertirlo en fabricación interna.
5. Revisar `use on restock with confirmation` para que únicamente opere cuando la política permita reposición y exista un reemplazo configurado; no habilitarlo para `no_restock`, `exit`, `ignored` ni reemplazos bloqueados.
6. Actualizar etiquetas, badges, filtros y textos de la fila para mostrar siempre por separado:
   - `Lifecycle: Activo` / `En salida` / etc.
   - `Reposición: Restock` / `Proveedor externo` / `No restock` / etc.
   Esto evita que “Activo” se interprete como “Restock” o que una ruta se interprete como Lifecycle.
7. No realizar migración de datos ni modificar resoluciones históricas. Solo se actualizará el esquema de lectura/guardado de la UI y, si la validación demuestra una dependencia, el resolver para respetar ambos campos sin alterar registros existentes.

## Archivos previstos

- `src/components/core/woocore/NoRestockConfigDialog.tsx`
- `src/components/core/woocore/LifecycleStatusDialog.tsx`
- `src/components/core/woocore/ReplenishmentRouteDialog.tsx`
- `src/pages/core/CoreWooCoreMap.tsx`
- `src/lib/coreReplenishment.ts`
- Solo si es necesario para que el motor use correctamente la separación: función de resolución de política mediante una migración aprobada; sin backfill ni cambios de datos históricos.

## Verificación

- Producto con `Lifecycle = active` puede guardar `Política = Restock / Reposición`.
- Producto activo puede elegir `internal_factory` y generar la acción normal de reposición.
- Producto activo con `external_supplier` sigue siendo compra externa.
- `no_restock`, `exit`, `ignored` y `replaced` conservan sus bloqueos, reemplazos y rutas actuales.
- `use_on_restock_with_confirmation` solo aparece/funciona en una política de reposición permitida.
- Las resoluciones históricas no se eliminan ni se reescriben.
- No se tocan Woo write, inventario, QR, escaneo, OP, nómina, costos, movimientos financieros, despachos ni unidades.
- Typecheck con 0 errores y revisión del flujo visual en Mapa Woo / Core.
