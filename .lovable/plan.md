## Objetivo

Eliminar la duplicidad entre el botón "Reemplazo" del Mapa Woo/Core y la política estratégica. `core_replenishment_policies` queda como única fuente de verdad. Sin migraciones, sin RPC nuevas, sin tocar reservas/costos/necesidades.

## Cambios

### 1. Botón "Reemplazo" → acceso directo al editor central
Archivo: `src/pages/core/CoreWooCoreMap.tsx`

- Eliminar el estado `{ kind: "replacement" }` y la renderización de `ReplacementPickerDialog`.
- El botón "Reemplazo" (línea 361) abre `NoRestockConfigDialog` con:
  - `initialCtx = ctx` (producto actual)
  - nueva prop `initialStatus = "replaced"` para preseleccionar Estado = Reemplazado.
- Eliminar el import de `ReplacementPickerDialog`. Archivo del dialog queda huérfano (no borrar en este bloque para minimizar alcance; el import desaparece).

### 2. `NoRestockConfigDialog` acepta preselección de estado
Archivo: `src/components/core/woocore/NoRestockConfigDialog.tsx`

- Añadir prop opcional `initialStatus?: LifecycleChoice`.
- En el `useEffect` que hidrata desde la política: si hay `initialStatus` y la política actual no está en `no_restock/exit/replaced`, usar `initialStatus` en vez del default `"no_restock"`. Si ya hay lifecycle definido, respetar el guardado.
- No se toca el guardado: sigue usando `upsertPolicy` con `lifecycle_status`, `restock_enabled=false`, `replacement_product_id`, `replacement_woo_product_id`, `replacement_behavior`. Ya cubre el requisito.

### 3. Lectura de la columna "Reemplazo"
Ya lee sólo de `core_replenishment_policies` (líneas 349–351). No se cambia.

### 4. Badge "Reemplazo sin activar"
Archivo: `src/pages/core/CoreWooCoreMap.tsx`

- En la fila del Mapa, detectar inconsistencia:
  ```
  hasReplacementRef = !!(p?.replacement_product_id || p?.replacement_woo_product_id)
  needsActivation  = hasReplacementRef && p?.lifecycle_status !== "replaced"
  ```
- Si `needsActivation`: mostrar `<Badge variant="destructive">Reemplazo sin activar</Badge>` junto al valor de la columna "Reemplazo", y añadir botón `Completar política` que abre `NoRestockConfigDialog` con `initialCtx=ctx` e `initialStatus="replaced"`. El reemplazo ya seleccionado se carga solo (el dialog ya lee `p.replacement_product_id` / `p.replacement_woo_product_id`).
- Contar estas filas y sumarlas al indicador de la pestaña, o mostrar contador aparte: `"No restock / Reemplazos (X) · Y sin activar"`.

### 5. Filtro de la pestaña "No restock / Reemplazos"
Archivo: `src/pages/core/CoreWooCoreMap.tsx`

- Mantener el filtro actual por `lifecycle_status IN ('no_restock','exit','replaced')`.
- Ampliar para incluir también filas con `hasReplacementRef` aunque el lifecycle no esté todavía en `replaced`, marcadas con el badge "Reemplazo sin activar" y misma acción "Completar política". Así SHM019 aparece hasta que se resuelva.

### 6. Invalidación
Al guardar desde `NoRestockConfigDialog` (`onDone`): ya se invalidan las políticas vía queryClient donde corresponde. Verificar en la página que ambos usos disparen:
```
qc.invalidateQueries({ queryKey: ["replenishment-policies"] });
qc.invalidateQueries({ queryKey: ["strategy-audit"] });
```
Sin recargar página.

## Fuera de alcance
No tablas, no migraciones, no RPC, no cambios de costos, reservas financieras, Necesidades, WooCommerce, ni aplicación automática de reemplazos. `ReplacementPickerDialog.tsx` queda sin uso (no se borra en este bloque).

## Resultado
- El botón "Reemplazo" abre el editor central con Estado = Reemplazado preseleccionado.
- Guardar deja `lifecycle_status='replaced'`, `restock_enabled=false`, y el producto aparece de inmediato en "No restock / Reemplazos".
- SHM019 y similares aparecen marcados "Reemplazo sin activar" con acción "Completar política" hasta que se confirme la política.
- Única fuente de verdad: `core_replenishment_policies`.
