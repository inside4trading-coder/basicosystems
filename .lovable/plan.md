
## Diagnóstico (read-only)

**Pedido 34222 / FRANELA LA GRAN FUGA XL (pending `63c08840`)**
- Reemplazado por Franela Negra "WANTED – La Gran Fuga" (Woo #30833).
- 1 event `suggest_replacement` **resolved** (`4b6b3d44`), 1 movimiento base `sale_generated` (bucket `pending_classification`) + 3 movimientos de reclasificación (`replacement_reclassification_out/in`, `replacement_cost_adjustment`).
- 1 need `pending` creada (`0ca92897`, "Franela Negra WANTED", Talla M / Negro). Pending item status = **resolved**. Sin duplicado.
- Además: FRANELA OLYMPIC XL (`26f44565`) sigue `pending`, no ha sido tocada.

**Pedido 34233 / gora nautica (pending `9e9ac229`)**
- Pending item status = **resolved**.
- Movimiento base `sale_generated` (`ac700ae9`, bucket `pending_classification`, `manual_missing_sku_resolution=true`).
- **DUPLICADO histórico**: 2 events `suggest_replacement` resolved sobre el MISMO movimiento base:
  - `a9542d04` → Basico Jogger "For Daily Use" L / Negro → need `cd45aae6` (status `ignored`)
  - `47f1c122` → Basico T-Shirt Canserbero M / Negro → need `cd7fa160` (status `pending`)
- Ambos generaron sets completos de movimientos de reclasificación (6 filas negativas/positivas). No se borra nada por consigna.

## Por qué el usuario ve el problema

1. **"missing_sku sigue apareciendo"**: el pending está `resolved` y se oculta por el filtro. Lo que sigue visible en Requieren atención es el **movimiento base `sale_generated`** (bucket `pending_classification`, `status='posted'`) — el hook `useReplenishmentPolicyEvents` no lo excluye aunque su `manual_missing_sku_resolution='true'` ya fue procesado.
2. **"aparecen movimientos contables negativos"**: los `replacement_reclassification_out` tienen `fund_bucket='pending_classification'` y `status='posted'`, por lo que la query los levanta como sintéticos "Partida sin clasificar" y piden Definir política. Nunca deberían ser tareas.
3. **"no aparece en Fabricación interna → Abiertas"**: las needs SÍ se crean con `status='pending'`, `need_type='inventory_restock'` (el RPC ya reconoce `allow_internal_factory`). El bug es de UI: `CoreProductionNeeds.tsx` carga needs con `useState`+`load()` en mount y **no** se refresca cuando `MissingSkuResolveDialog` / `ReplacementApplicationDialog` invalidan React Query. El usuario necesita recargar la página para verlas.

## Alcance del fix (compacto, sin tocar Woo / OP / inventario / catálogo / costos / Sublime, sin borrar datos)

### Fix A — Ocultar movimientos ya resueltos y reclasificaciones del panel "Requieren atención"
Archivo: `src/hooks/useReplenishmentPolicyEvents.ts`, query `pendingClassMovsQuery`.
- Añadir al filtro post-fetch:
  - Excluir `movement_type IN ('replacement_reclassification_out','replacement_reclassification_in','replacement_cost_adjustment')`.
  - Excluir movimientos cuyo `cost_snapshot_data->>'manual_missing_sku_resolution' = 'true'` y su `pending_item_id` esté `resolved/processed/ignored/cancelled` — se detecta con una segunda query ligera a `core_fabrication_fund_pending_items` (solo los ids referenciados; ya se lee esa tabla arriba, reutilizamos ese mapa).
- No tocar la lógica de `pending_classification_resolution` existente.

### Fix B — Refrescar la lista de necesidades tras resolver missing_sku
Archivo: `src/pages/core/CoreProductionNeeds.tsx`.
- Escuchar un evento global `window.addEventListener('core-needs-refresh', load)` en un `useEffect`.
Archivos: `src/components/core/needs/MissingSkuResolveDialog.tsx` y `src/components/core/woocore/ReplacementApplicationDialog.tsx` (solo el punto donde postean el reemplazo con éxito).
- Tras `invalidateAll()` disparar `window.dispatchEvent(new Event('core-needs-refresh'))`.
- Reutiliza el flujo existente; no cambia contratos.

### Fix C — Reconciliar el cierre del pending y evitar duplicados (endurecer lo ya existente)
Archivo: `src/components/core/needs/MissingSkuResolveDialog.tsx`.
- `handlePickCandidate` ya busca un event `resolved` y cierra; añadir el mismo cierre defensivo cuando existe un event `open/reviewed` cuyo pending sigue abierto tras aplicar (en el retorno de `handleApplyClose` releer también estado `resolved` como ya hace y forzar `closeMissingSkuPendingItem`).
- `handlePickCandidate`: antes de crear un nuevo event, buscar también movimientos base previos con `manual_missing_sku_resolution='true' AND pending_item_id = pendingItemId` y **reutilizar** ese `movement_id` (ya lo garantiza el RPC vía `SELECT ... FOR UPDATE`, pero validamos en cliente para no crear un segundo event si por alguna razón el pending vuelve a mostrarse). Idempotente.

### Fix D — (validación, no requiere cambios)
El RPC `core_apply_replacement_event` ya acepta `route_action ∈ ('internal_factory','allow_internal_factory')` (líneas 254-255, 389 del cuerpo actual) y crea `core_production_needs(need_type='inventory_restock', status='pending', priority='media')`. Confirmado por SQL: las 3 needs recientes existen. No se modifica la función.

## Datos existentes (no se borran)
- Pedido 34233: quedan 2 replacement events `resolved` (`a9542d04`, `47f1c122`) y 2 needs (`cd45aae6` ignored, `cd7fa160` pending). Se dejan intactos.
- Movimientos de reclasificación (6 filas) permanecen en libros; solo se ocultan del panel de atención.
- FRANELA OLYMPIC XL (`26f44565`) sigue pending y se podrá resolver normalmente.

## Validación
- Typecheck (`tsgo`).
- SQL: confirmar que las 3 needs siguen visibles con `status='pending'` y que el filtro de `pending_classification` deja de traer `ac700ae9` y `d8d71b80` cuando su pending está `resolved`.
- Manual (usuario): resolver missing_sku por interno → aparece en Abiertas sin recargar; los movimientos de reclasificación no aparecen en Requieren atención; reintentar resolver el mismo pending no crea un segundo event.

## Detalles técnicos

Archivos tocados (3):
- `src/hooks/useReplenishmentPolicyEvents.ts` — filtro `pendingClassMovsQuery`.
- `src/pages/core/CoreProductionNeeds.tsx` — listener `core-needs-refresh`.
- `src/components/core/needs/MissingSkuResolveDialog.tsx` — dispatch del evento + reuso de movement base.
- `src/components/core/woocore/ReplacementApplicationDialog.tsx` — dispatch del evento en el post-success (una línea).

Sin migraciones. Sin cambios en RPCs. Sin cambios en `core-generate-production-needs` ni en `core-process-fabrication-funds`. Sin Woo. Sin OP. Sin inventario. Sin Sublime.
