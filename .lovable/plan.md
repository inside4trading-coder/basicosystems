## Causa del bloqueo

En `src/components/core/woocore/ReplacementApplicationDialog.tsx` (líneas 70–101), el diálogo lee la política global del producto (`core_replenishment_policies`) y le da **prioridad sobre el evento**:

```
effectiveBehavior = effectivePolicy?.replacement_behavior ?? event?.replacement_behavior
behaviorBlocked  = !APPLY_BEHAVIORS.has(effectiveBehavior)
```

Como la política global del producto origen es `suggest_only`, el diálogo bloquea aunque el evento puente creado por “Decidir reserva” ya trae `use_on_restock_with_confirmation`.

## Cambios

### 1. `src/components/core/needs/UnlinkedCoreReserveDialog.tsx`

- Al insertar el evento puente: mantener `replacement_behavior: 'use_on_restock_with_confirmation'` y ampliar `resolution_data` con `bridge_source: "unlinked_core_reserve"`, `origin_movement_id`, `forced_behavior: "use_on_restock_with_confirmation"` (hoy usa `bridge_source: "unlinked_core_manual_resolution"`, sin `forced_behavior`).
- Al **reutilizar** un evento existente (`open`/`reviewed`): si su `replacement_behavior` no es `use_on_restock_with_confirmation`, o le falta el marcador en `resolution_data`, hacer un `update` solo de ese evento (behavior + merge de `resolution_data`) antes de abrir el diálogo de aplicación. Aceptar también el `bridge_source` antiguo para eventos ya creados.

### 2. `src/components/core/woocore/ReplacementApplicationDialog.tsx`

- Calcular `isBridgeEvent` = `event.source_type === 'fabrication_fund_movement'` y `resolution_data.bridge_source` ∈ {`unlinked_core_reserve`, `unlinked_core_manual_resolution`}.
- Si `isBridgeEvent`: `effectiveBehavior = resolution_data.forced_behavior ?? event.replacement_behavior ?? 'use_on_restock_with_confirmation'` (ignorar la política global para el behavior) → `behaviorBlocked = false`, se muestra la matriz de variantes, preview y botón Confirmar; no se muestra el bloque “Solo sugerir / Editar política”.
- El producto de reemplazo (`effectiveReplacementCoreId/WooId`) para eventos puente se toma primero del evento (que es el elegido en el picker), y solo después de la política.
- Para eventos no puente: sin cambios, la política global sigue mandando.

## Lo que no se toca

- No se escribe en `core_replenishment_policies` ni en el Mapa Woo/Core.
- No se toca “No restock” (`resolveUnlinkedCoreMovement` con `action: 'no_restock'`), ni Woo, OP, inventario, catálogo, costos ni Sublime.
- Sin migraciones de base de datos.

## Validación

- Fila “Sin vínculo Core” MF21 XL (6.50): Decidir reserva → Reemplazar → Basico Club Jersey Soccer → debe aparecer la matriz de tallas, permitir cantidad, preview y confirmar, sin aviso “Solo sugerir”.
- Un evento de reemplazo normal con política `suggest_only` sigue mostrando el bloqueo.
- Typecheck con `tsgo`.