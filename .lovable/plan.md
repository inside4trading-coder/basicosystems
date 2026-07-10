## Objetivo

Convertir `/core/necesidades` en la bandeja operativa principal de reposición, integrando los eventos de política (bloqueos, reemplazos, externos, costo manual) junto a las necesidades internas — sin tocar backend, sin crear tablas/RPCs/edge functions y sin mezclar datos entre `core_production_needs` y `core_replenishment_policy_events`.

## Alcance

- Solo frontend.
- Reutilizar `core_replenishment_policy_events`, `ReplacementApplicationDialog`, y la lógica/queries ya presentes en `PolicyReviewPanel`.
- Extraer un hook compartido pequeño `useReplenishmentPolicyEvents` si evita duplicar queries.
- Ningún cambio en `core-generate-production-needs`, `core-create-production-order`, ni en el motor central.

## Cambios de código

### 1. Nuevo hook compartido
`src/hooks/useReplenishmentPolicyEvents.ts`
- Extrae la query actual de `PolicyReviewPanel` a un hook reutilizable:
  - lista de eventos con `status IN ('open','reviewed')`
  - resolvers de nombre Woo/Core, SKU, variante ya existentes
  - contadores agrupados por `action`
  - mutations reutilizables: `markReviewed`, `resolve`, `ignore`
- `PolicyReviewPanel` se refactoriza mínimamente para consumir el hook (sin cambiar su UI/comportamiento).

### 2. Nuevo componente
`src/components/core/woocore/PolicyEventsAttentionPanel.tsx`
- Panel embebible que renderiza la pestaña "Requieren atención" dentro de Necesidades.
- Filtros rápidos: Todos · Reemplazos · Proveedor externo · Costo manual · No restock/En salida · Ignorados.
- Búsqueda por nombre / SKU / Woo Product ID / variante.
- Tabla con columnas: Fecha · Producto · Variante · Cantidad · Ruta/Motivo · Reemplazo o proveedor · Estado · Acción.
- Acciones por tipo:
  - `suggest_replacement` → abre `ReplacementApplicationDialog` (reutilizado tal cual).
  - `external_supplier_review` → navega a `/core/mapa-woo-core?tab=external` (Reposición externa existente).
  - `manual_cost_review` → "Ver política" + "Abrir revisión".
  - `block_no_restock` / `block_exit` / `block_ignored` → "Ver política" + "Marcar revisado".
- Link "Ver historial completo" → `/core/mapa-woo-core?tab=policy-review`.
- Ningún evento es seleccionable; nunca activa "Crear OP".

### 3. Modificación de `src/pages/core/CoreProductionNeeds.tsx`
- Añadir bloque superior siempre visible:
  - Cards/botones-resumen compactos con contadores:
    Fabricación interna · Reemplazos · Proveedor externo · Costo manual · Bloqueadas.
  - Alerta operativa (si hay eventos activos):
    "Hay X reposiciones que requieren atención o fueron desviadas por política" + desglose + botón "Revisar ahora".
- Envolver el contenido actual dentro de dos pestañas principales nuevas:
  1. **Fabricación interna** — la UI actual íntegra (tabs internas de Runs/Historial se mantienen tal cual). Cero cambios de lógica ni de selección/creación de OP.
  2. **Requieren atención** — renderiza `PolicyEventsAttentionPanel`.
- Estados vacíos:
  - Fabricación interna vacía + eventos existentes → mostrar CTA "Ver Requieren atención".
  - Requieren atención vacía → mensaje neutro.
- Invalidación de queries tras acciones (aplicar reemplazo, revisar, resolver, ignorar): invalidar `policy_events`, `policy_events_summary` y `production_needs` (sin recarga).

### 4. Reutilización estricta
- Badges/mensajes de `src/lib/policyBlocked.ts`.
- Labels de `src/lib/coreReplenishment.ts`.
- `ReplacementApplicationDialog` sin cambios.
- Navegación a Reposición externa vía la ruta/tab existente de `CoreWooCoreMap`.

## Fuera de alcance (no hacer)

- No crear tablas, migraciones, RPCs ni edge functions.
- No modificar `route_core_replenishment_candidate`, `core-generate-production-needs`, `core-create-production-order`.
- No insertar eventos en `core_production_needs`.
- No aplicar reemplazos ni crear órdenes externas automáticamente.
- No tocar WooCommerce, stock, QR, nómina ni BASICO ESPAÑA.

## Archivos afectados

- Nuevo: `src/hooks/useReplenishmentPolicyEvents.ts`
- Nuevo: `src/components/core/woocore/PolicyEventsAttentionPanel.tsx`
- Editado: `src/pages/core/CoreProductionNeeds.tsx` (envoltorio de tabs + resumen + alerta; no se cambia la lógica interna de la vista actual)
- Editado (mínimo): `src/components/core/woocore/PolicyReviewPanel.tsx` para consumir el hook compartido (sin cambios visibles)
