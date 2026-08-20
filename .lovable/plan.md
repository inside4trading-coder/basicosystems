# Portal de Operario (BASICO CORE)

Nueva experiencia móvil e independiente para que cada operario entre con PIN, vea su producción y escanee prendas. Todo aditivo: no toca el escaneo admin, nóminas cerradas, inventario, OP, QR ni WooCommerce.

## Cómo funcionará

1. El operario abre `/operario` en su teléfono (ruta pública, sin sidebar admin).
2. Ve "Selecciona tu perfil" con las tarjetas de operarios activos que tengan el portal habilitado (nombre, alias, rol, avatar).
3. Introduce su PIN de 6 dígitos. Si es correcto, queda con sesión iniciada 7 días en ese dispositivo.
4. Encabezado permanente y grande: "Escaneando como — LUIS CIRA", con botones "Cambiar trabajador" y "Cerrar sesión".
5. Dashboard personal: procesos de hoy, prendas únicas de hoy, total generado hoy, hora del último escaneo, desglose por proceso (corte / costura / estampado / otros), acumulado de la semana de nómina vigente (viernes→jueves) con su estado, y lista de últimos escaneos.
6. Botón grande "Escanear prenda" → cámara QR (mismo lector `html5-qrcode` del escaneo admin) o código manual.
7. Pantalla de confirmación: unidad, producto, talla/color, OP, proceso disponible (preseleccionado si hay uno solo), tarifa y monto a generar → "Registrar proceso".
8. El proceso queda completado, con el operario asociado, y entra automáticamente en la nómina de la semana actual usando exactamente las mismas tablas que hoy usa el escaneo admin.

## Privacidad de montos

Todos los montos del dashboard (total de hoy, total de la semana, montos por proceso y montos de los últimos escaneos) aparecen **ocultos por defecto** como `******`, con el texto "Montos ocultos por privacidad" y un botón con ícono de ojo: "Mostrar montos" / "Ocultar montos".

Nunca se ocultan: nombre del operario, procesos permitidos, cantidad de prendas y procesos, fecha/hora, producto, OP, unidad ni estado.

La preferencia se guarda por dispositivo y por operario en `localStorage` con la clave `operator_amounts_visible_{operator_id}`, así que cambiar de trabajador no hereda la preferencia del anterior. Es puramente frontend: no cambia cálculos, work entries ni nómina.


## Seguridad y validaciones

Todo el registro pasa por una Edge Function con validación de token de sesión; el portal nunca escribe directo a la base de datos. Se rechaza:

- proceso ya completado ("Este proceso ya fue completado.")
- proceso no habilitado para el perfil ("Este proceso no está habilitado para tu perfil.")
- QR inexistente ("QR no reconocido.")
- unidad cancelada u OP cancelada
- orden de procesos: si hay un proceso anterior pendiente, se bloquea
- doble click / doble escaneo: idempotencia por unidad+proceso

Las correcciones siguen siendo exclusivas del admin. En el historial de la unidad se verá el evento con `source = portal_operario` y el nombre del operario.

## Detalles técnicos

### Base de datos (aditivo)

`core_factory_operators` — nuevas columnas:
- `portal_active boolean default false`
- `pin_hash text`
- `pin_set_at timestamptz`
- `pin_failed_attempts int default 0`, `pin_locked_until timestamptz`
- `portal_last_login_at timestamptz`
- `allowed_processes text[]` (vacío = se derivan de `core_factory_operator_roles`)

Nueva tabla `core_operator_portal_sessions`: `id`, `operator_id`, `session_token_hash`, `device_label`, `created_at`, `expires_at`, `revoked_at`. RLS activada, sin políticas para `anon`/`authenticated` (solo la accede `service_role`); grants a `service_role`, lectura a `authenticated` para el panel admin de sesiones.

`core_production_scan_events` y `core_production_work_entries`: columna `source text default 'admin'` para distinguir `portal_operario`.

El PIN se guarda solo como hash SHA-256 con sal de servidor (mismo patrón que `sublime-pin-public`); nunca se muestra ni se devuelve tras guardarlo.

### Edge function `core-operator-portal` (nueva, service role, sin JWT)

Acciones:
- `list_operators` → operarios activos con `portal_active` (id, nombre, alias, foto, roles). Sin datos sensibles.
- `login` → valida PIN, bloquea tras 5 intentos por 30 min, crea sesión (token aleatorio, hash en BD, 7 días) y devuelve token + perfil.
- `session` → valida token y devuelve perfil + dashboard (hoy, semana de nómina, últimos escaneos).
- `lookup_unit` → resuelve `qr_token` o `unit_code`, devuelve unidad, producto, talla/color, OP y procesos con su estado, tarifa y si están permitidos.
- `register_process` → replica la lógica de `CoreScanning.doRegister`: inserta en `core_production_scan_events`, marca `core_production_unit_processes` como `completed` con `completed_by_operator_id`, e inserta en `core_production_work_entries` con `rate_snapshot`, `payroll_multiplier_snapshot`, `payroll_amount`, `payroll_status` (`pending` o `missing_rate`) y `source = 'portal_operario'`, y actualiza contadores de la OP. Solo se bloquea si **ese proceso concreto** ya está registrado o ya entró en una nómina cerrada/pagada; nunca se bloquea la unidad entera por otros procesos suyos.
- `logout` → revoca la sesión.

Toda entrada validada con Zod; todas las respuestas con CORS.

### Nómina

No se crea lógica paralela: el registro escribe en `core_production_work_entries` con `payroll_status = 'pending'`, que es lo que ya recoge `CorePayroll` al generar la nómina semanal (viernes→jueves vía `getPayrollWeek`). El dashboard del operario lee esas mismas entradas filtradas por `operator_id` y rango de la semana vigente.

### Frontend

Archivos nuevos:
- `src/pages/operario/OperatorPortal.tsx` — shell del portal, gestiona sesión en `localStorage` y enruta entre selección / PIN / dashboard.
- `src/components/operario/OperatorPicker.tsx` — tarjetas de operarios.
- `src/components/operario/OperatorPinPad.tsx` — teclado numérico grande.
- `src/components/operario/OperatorDashboard.tsx` — encabezado "Escaneando como", KPIs de hoy, desglose por proceso, semana y últimos escaneos, con el toggle "Mostrar / Ocultar montos".
- `src/components/operario/OperatorScanSheet.tsx` — cámara QR + entrada manual + confirmación de proceso.
- `src/lib/operatorPortal.ts` — cliente tipado de la edge function, manejo del token y helpers de privacidad de montos por `operator_id`.

Archivos modificados:
- `src/App.tsx` — ruta pública `/operario` (fuera de `ProtectedRoute`).
- `src/pages/core/CoreFactoryOperators.tsx` — sección "Portal de operario" en el editor: activar portal, definir/cambiar PIN, procesos permitidos, copiar link de acceso, último acceso, producción de hoy y del periodo, y revocar sesiones.
- `src/pages/core/CoreScanning.tsx` — solo marca `source: 'admin'` y muestra el origen en el historial de la unidad.

Estética BASICO: blanco/negro/rojo con tokens existentes, tarjetas y botones grandes, alto contraste para taller.

### Verificación

- Typecheck con `tsgo`.
- Prueba end-to-end con Playwright sobre `/operario`: seleccionar a Luis Cira, PIN, dashboard con montos ocultos por defecto, mostrar/ocultar montos y persistencia en `localStorage`, escaneo manual de una unidad con proceso pendiente, confirmación y segundo intento rechazado por duplicado.
- Casos de error: PIN incorrecto con bloqueo tras 5 intentos, proceso no permitido, unidad cancelada, orden de procesos bloqueado y logout.
- Consulta de comprobación de que la work entry queda con `operator_id` correcto, `source = 'portal_operario'` y `payroll_status = 'pending'` dentro de la semana vigente.
