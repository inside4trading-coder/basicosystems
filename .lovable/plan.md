## Error exacto (confirmado en base de datos)

La venta pública falla con **`No autorizado`**.

Causa: la edge function `esp-public-pos-sale` llama al RPC `public.esp_register_pos_sale`, y ese RPC empieza con:

```text
v_uid := auth.uid();
v_is_priv := has_role(v_uid,'admin') OR has_role(v_uid,'manager');
IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;
```

Como la edge function usa service role sin sesión de usuario, `auth.uid()` es NULL → excepción. El POS móvil normal sí pasa porque va autenticado como admin/manager.

## Fix mínimo

No se toca `esp_register_pos_sale` (el POS móvil sigue igual). Se crea un RPC hermano solo para el flujo público.

### 1. Migración: nuevo RPC `public.esp_register_public_pos_sale`

- Misma lógica de venta que `esp_register_pos_sale` (numeración, validación de variantes/producto, descuento atómico de stock con `FOR UPDATE`, movimientos de inventario `sale_pos`, líneas de venta, pago).
- Diferencias:
  - Sin chequeo de `auth.uid()` / `has_role`; en su lugar recibe `p_location_id` ya validado por la edge function.
  - `user_id` y `created_by` quedan NULL.
  - `source = 'public_pos'` en `esp_sales` (la columna existe y no tiene check constraint).
- `SECURITY DEFINER`, `SET search_path = public`.
- `REVOKE ALL ... FROM anon, authenticated` y `GRANT EXECUTE ... TO service_role` — solo invocable desde la edge function.
- Mantiene `p_allow_negative = false` → stock insuficiente lanza error claro.

### 2. `supabase/functions/esp-public-pos-sale/index.ts`

- Cambiar la llamada de `esp_register_pos_sale` a `esp_register_public_pos_sale`.
- Mapear errores a mensajes claros: token inválido/desactivado (401 `invalid`), PIN incorrecto (401 `invalid_pin`), stock insuficiente (400 con el texto del RPC), y fallback "No se pudo registrar la venta pública".
- Mantener la validación ya existente: slug + token activo + PIN + resolución de `location_id` y canal.
- Respuesta incluye `sale_id`, `sale_number`, `total_eur`, `location_id`.

### 3. `src/pages/pos-publico/PosPublico.tsx`

- Solo ajuste de mensajes de error (mostrar el texto del backend en el toast: stock insuficiente, PIN, token). Sin cambios de lógica de carrito.

## Fuera de alcance

Core, Sublime, Woo, reportes, y el POS móvil autenticado (`EspanaPOS.tsx`) no se modifican.

## Validación

1. Typecheck.
2. Llamada a la edge function con token válido de Pop Up Ibiza → venta registrada, stock descontado solo en esa sede.
3. Token inválido → bloqueado. PIN incorrecto → bloqueado. Stock insuficiente → bloqueado.
4. Verificar por consulta que el POS móvil normal sigue usando el RPC autenticado sin cambios.
