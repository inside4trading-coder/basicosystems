## Bugfix 1 — "Confirmar reemplazo" queda deshabilitado tras elegir talla

**Causa** (`ReplacementApplicationDialog.tsx`): `canConfirm` exige `preview != null`. El usuario debe pulsar manualmente **Generar preview** antes de que **Confirmar reemplazo** se habilite, pero nada en la UI lo comunica → parece un botón roto.

**Arreglo (mínimo, sólo UX)**:

- Auto-ejecutar `runPreview` cuando `canPreview` sea `true` y no haya `preview` ni `running`, con un `useEffect` debounced (~250 ms) que dispare al cambiar `allocations`, `confirmedQty`, `reason`, `effectiveBehavior`, `effectiveReplacementCoreId`.
- Mantener el botón **Generar preview** como refresh manual.
- El botón **Confirmar reemplazo** conserva su lógica (`canConfirm`); ahora se habilitará automáticamente cuando el preview termine sin error.
- Si `canPreview` pasa a `false` (cambia una cantidad, borra razón, etc.), seguir invalidando el preview como hoy.

No se toca `core_apply_replacement_event` ni el flujo de confirmación.

## Bugfix 2 — En "Configurar política", al pulsar "Cambiar" el producto reemplazo se vuelve a autoseleccionar

**Causa** (`NoRestockConfigDialog.tsx`, líneas 223-240): el efecto de rehidratación observa `replacement`. Cuando el usuario pulsa **Cambiar** → `setReplacement(null)`. El efecto se re-ejecuta, ve `replacement === null` y `selected.policy.replacement_product_id` sigue apuntando al mismo candidato → lo vuelve a fijar inmediatamente. Visualmente parece que el selector "abre y cierra rapidísimo" y no permite elegir otro producto.

**Arreglo (mínimo)**:

- Añadir `const hydratedForRef = useRef<string | null>(null)` que guarde el `selected.map.woo_product_id` (o `selected.core?.id`) para el que ya se hizo la rehidratación inicial.
- La rehidratación desde `selected.policy` sólo debe correr **una vez por `selected`**: si `hydratedForRef.current === identity`, no volver a autoseleccionar.
- Resetear `hydratedForRef.current = null` cuando cambie `selected` (en el mismo efecto que hoy resetea `status/behavior/reason/replacement`, líneas 210-221).
- Mantener el sub-efecto que refresca el objeto `replacement` si el mismo `core_id` viene actualizado desde `fabricableCandidates` (para que al arreglar la política del candidato bloqueado se refleje el nuevo estado). Ese refresh sólo se aplica si `replacement != null`.

Resultado: pulsar **Cambiar** limpia el selector y el usuario puede buscar/elegir otro candidato sin que la política previa lo restaure.

## Fuera de alcance

- Backend, migraciones, RPC.
- Cambios en la política guardada ni en `core_apply_replacement_event`.
- Cambios visuales fuera de estos dos comportamientos.

## Validación

- Typecheck.
- Flujo A: abrir "Aplicar reemplazo", asignar cantidad a una talla → tras ~250 ms aparece Preview → **Confirmar reemplazo** se habilita sin tocar "Generar preview".
- Flujo B: en "Configurar política" con estado **Reemplazado** y reemplazo ya guardado, pulsar **Cambiar** → el selector queda vacío, el buscador vuelve, se puede elegir otro producto sin que el original se re-inserte.
