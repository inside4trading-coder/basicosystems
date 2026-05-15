## Problema detectado

La pantalla `/sublime/fichaje` muestra los botones Entrada/Salida pero **no registra nada**: solo dispara un `toast`. Nunca pide ubicación, nunca compara contra la tienda, nunca inserta en `sublime_clock_events`. Por eso:

- El fichaje de Ediana no aparece en ningún registro (nunca se guardó).
- Se pudo "fichar" fuera del radio porque no existe validación todavía.

Configuración actual de la única tienda activa:

- **Sublime - C.C. Barquicenter** · centro `10.067667, -69.313389` · radio **75 m**
- La precisión GPS no se está usando — el navegador ni siquiera la solicita en el momento del fichaje.

## Qué construir

### 1. Edge function `sublime-clock-event` (nueva, pública con sesión)

Recibe del cliente: `session_token`, `event_type` (entrada / salida / inicio_descanso / fin_descanso), `latitude`, `longitude`, `accuracy`, `device_user_agent`.

Lógica server-side:

1. Validar `session_token` (mismo HMAC ya usado por `sublime-pin-public`).
2. Cargar `sublime_clock_settings` del empleado y la `sublime_stores` asignada.
3. Calcular distancia Haversine al centro de la tienda.
4. Determinar `location_state`:
   - `dentro_rango` si `distance ≤ radius`
   - `fuera_rango` si `distance > radius`
   - `ubicacion_no_disponible` si no llegan coordenadas
   - `precision_baja` si `accuracy > 100 m` (se acepta pero se marca)
5. Determinar `clock_state`:
   - `valido` si dentro de rango (o sin coords pero permitido manualmente — por ahora no)
   - `pendiente_revision` si fuera de rango → **bloquea el fichaje automático** y deja la solicitud lista para que admin apruebe/rechace
6. Calcular `punctuality_state` para entradas (a tiempo / tarde según `entry_time` + tolerancia).
7. Insertar en `sublime_clock_events` con todos los campos de trazabilidad (lat, lng, distance_meters, allowed_radius_meters, device_user_agent, source = "pin").
8. Devolver al cliente: `ok`, `clock_state`, `distance`, `radius`, `location_state` y mensaje claro.

### 2. Cliente `/sublime/fichaje`

Reemplazar el `handleAction` placeholder por un flujo real:

1. Al pulsar Entrada/Salida, mostrar estado "Obteniendo ubicación…".
2. Llamar `getCurrentPosition` con `enableHighAccuracy: true`, `timeout: 15s`, `maximumAge: 0`.
3. Si el usuario niega el permiso → mostrar mensaje y bloquear (no permitir fichar sin GPS).
4. Enviar lat/lng/accuracy + user-agent a la edge function.
5. Mostrar el resultado:
   - Éxito dentro del rango → confirmación verde con distancia ("a X m de la tienda").
   - Fuera del rango → tarjeta de aviso roja con la distancia real, el radio permitido (75 m) y botón "Solicitar revisión manual" que crea el evento como `pendiente_revision` con una observación opcional.
   - Sin GPS / permiso denegado → mensaje claro, sin registro.
6. Refrescar el estado del empleado tras un fichaje exitoso.

### 3. UI de descansos

Añadir botones `Inicio descanso` y `Fin descanso` cuando el estado actual lo permita (ya están los `event_type` soportados en la BD).

### 4. Panel admin — solicitudes pendientes

En `/sublime/admin/fichaje` añadir una pestaña "Pendientes de revisión" que liste eventos con `clock_state = 'pendiente_revision'` y permita Aprobar / Rechazar (rellena `approved_by`, `approved_at` y cambia `clock_state`).

## Aclaraciones técnicas sobre GPS

- El navegador devuelve `coords.accuracy` en metros (radio de confianza al 68%). En móvil con GPS suele ser 5-30 m, en wifi/IP puede ser 100-2000 m.
- La validación se hace contra la **distancia al centro de la tienda**, no contra accuracy. Pero si `accuracy > 100 m` el evento se marca `precision_baja` para que admin lo revise aunque caiga dentro del radio.
- `maximumAge: 0` fuerza una lectura nueva cada fichaje (no caché).
- `timeout: 15s` evita que el usuario quede colgado si el GPS tarda.

## Archivos a tocar

- **Crear**: `supabase/functions/sublime-clock-event/index.ts`
- **Editar**: `src/pages/SublimeFichajePublico.tsx`, `src/components/sublime/FichajeClock.tsx`, `src/pages/SublimeAdminFichaje.tsx` (pestaña pendientes)
- **Migración**: ninguna nueva, las columnas ya existen en `sublime_clock_events`.
