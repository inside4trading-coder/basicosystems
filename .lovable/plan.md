## Diagnóstico

El error no viene de la selección de talla ni del preview automático.

La causa real está en la función `core_apply_replacement_event`: aunque la UI lee la política efectiva actual y muestra `Usar en reposición (confirmar)`, la función prioriza el snapshot guardado en el evento:

```sql
v_behavior := COALESCE(v_event.replacement_behavior, v_policy.replacement_behavior, NULL);
```

Si el evento fue creado cuando la política estaba en `suggest_only`, ese valor queda guardado en `core_replenishment_policy_events.replacement_behavior`. Luego, aunque el usuario cambie la política a `use_on_restock_with_confirmation`, la función sigue usando el valor viejo del evento y devuelve `behavior_suggest_only`.

## Plan de arreglo

1. **Actualizar la función de aplicación de reemplazos**
   - Cambiar la prioridad para que la política actual sea la fuente de verdad:
     ```sql
     COALESCE(v_policy.replacement_behavior, v_event.replacement_behavior, NULL)
     ```
   - Hacer lo mismo con `replacement_product_id` y `replacement_woo_product_id`, para que si se cambia el producto reemplazo desde la política, la función use el reemplazo actual y no el snapshot viejo del evento.

2. **Mantener compatibilidad**
   - Si por algún motivo no existe política actual, usar el snapshot del evento como fallback.
   - No tocar WooCommerce.
   - No tocar reservas.
   - No modificar reemplazos/eventos existentes automáticamente.

3. **Alinear frontend con backend**
   - Mantener la UI usando `effectivePolicy` como ya hace.
   - Quitar la dependencia problemática del preview automático si hace falta, o dejarlo solo cuando el comportamiento efectivo sea aplicable.
   - Mostrar el mensaje bloqueado solo cuando la función/backend realmente siga bloqueando.

4. **Validación**
   - Ejecutar typecheck.
   - Verificar que un evento viejo con snapshot `suggest_only` pueda previsualizar/confirmar después de cambiar la política actual a `use_on_restock_with_confirmation`.
   - Confirmar que si la política actual sigue en `suggest_only`, el botón no intente aplicar y se mantenga bloqueado con mensaje claro.