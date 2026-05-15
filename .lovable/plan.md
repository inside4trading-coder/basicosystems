## Sistema de PIN para Fichaje Sublime

Implementar el flujo completo de PIN temporal → PIN personal con bloqueo por intentos fallidos, sin exponer nunca el PIN personal al admin.

### 1. Cambios de base de datos

Migración sobre `sublime_clock_settings` (añadir columnas, no borrar nada):

- `pin_status` text — `not_configured` | `temp_generated` | `active` | `locked` | `requires_reset` (default `not_configured`)
- `temp_pin_hash` text nullable — hash del PIN temporal (4 dígitos)
- `temp_pin_expires_at` timestamptz nullable — expiración (24h tras generación)
- `failed_attempts` int default 0
- `locked_until` timestamptz nullable — bloqueo temporal por 5 fallos
- `last_pin_attempt_at` timestamptz nullable

`pin_hash` existente pasa a representar el PIN personal de 6 dígitos (hash SHA-256 con salt). Nunca se devuelve al cliente.

Nueva tabla `sublime_pin_audit` para trazabilidad (admin-only):
- `employee_id`, `action` (`temp_generated`, `personal_set`, `reset`, `blocked`, `unblocked`, `failed_attempt`, `locked_out`), `performed_by`, `created_at`, `metadata` jsonb

RLS: admin manage all; manager read.

### 2. Edge functions (verify_jwt = false para las públicas)

**`sublime-pin-admin`** (verify_jwt = true) — operaciones del admin:
- `action: "generate_temp"` → genera PIN 4 dígitos, hashea, guarda con expiración 24h, marca `pin_status=temp_generated`, limpia `pin_hash`/intentos. Devuelve el PIN en claro **una sola vez** (solo a admin autenticado).
- `action: "reset"` → limpia `pin_hash`, `temp_pin_hash`, intentos, marca `requires_reset`. No genera PIN nuevo automáticamente.
- `action: "block"` / `"unblock"` → setea `blocked` y `pin_status=locked` / restaura.
- Verifica rol admin vía `has_role`.

**`sublime-pin-public`** (verify_jwt = false) — usado en `/sublime/fichaje`:
- `action: "verify"` con `{ pin }` → busca empleado por hash (PIN personal o temporal). Si match temporal → devuelve `{ requires_personal_setup: true, session_token }` (token efímero firmado, 5 min). Si match personal → devuelve `{ employee_summary, session_token }` para fichar. Si no match → incrementa `failed_attempts`; al llegar a 5, setea `locked_until = now() + 30 min` y `pin_status=locked`. Mensajes claros: intentos restantes / bloqueado hasta hora X.
- `action: "set_personal_pin"` con `{ session_token, new_pin, confirm_pin }` → valida token temporal, valida 6 dígitos numéricos, ambos iguales, no trivial (no 000000/123456), hashea, guarda en `pin_hash`, limpia `temp_pin_hash`/expiración, `pin_status=active`, resetea intentos. Audit log.
- Cliente Supabase con service role; nunca devuelve hashes.

### 3. UI — Crew profile (`CrewSublimeClock.tsx`)

Reemplazar la sección actual de PIN por panel admin con:
- Badge de estado del PIN (5 estados con colores).
- Última actividad: `pin_set_at`, intentos fallidos, `locked_until` si aplica.
- Botones (admin only):
  - **Generar PIN temporal** → llama edge function, muestra PIN en `Dialog` con copy-to-clipboard, aviso "se mostrará solo una vez".
  - **Resetear PIN** (confirmación).
  - **Bloquear / Desbloquear fichaje**.
- Manager: solo lectura del estado.
- Eliminar el generador local actual (`generatePin`/`hashPin` en cliente) — todo va por edge function.
- **Nunca** mostrar hashes ni PIN personal.

### 4. UI — Vista pública (`/sublime/fichaje`)

Refactor de `SublimeFichajePublico.tsx` + `FichajeIdentify.tsx`:
- Input PIN con `InputOTP` 6 slots (acepta también 4 para temporal — detectar por longitud o intentar ambos en backend).
- Pantalla de error con mensajes: "PIN incorrecto. Te quedan N intentos", "Fichaje bloqueado hasta HH:MM. Contacta a tu supervisor".
- Si backend devuelve `requires_personal_setup`: pantalla nueva `FichajePersonalPinSetup` con dos `InputOTP` de 6 dígitos (nuevo + confirmación), validación en vivo, botón "Crear mi PIN".
- Tras éxito: pantalla de bienvenida y luego flujo normal de fichaje (entrada/salida) con el `session_token`.

### 5. Detalles técnicos

```text
PIN flow
─────────
admin → generate_temp → temp_pin (4 dígitos, mostrado 1 vez)
                                 ↓
empleado introduce temp_pin → verify → requires_personal_setup
                                 ↓
empleado crea PIN personal (6) → set_personal_pin → pin_status=active
                                 ↓
fichajes posteriores con PIN personal
```

- Hashing: SHA-256 con salt por proyecto en edge function (`SUBLIME_PIN_SALT` secret, se solicitará si falta).
- Lookup eficiente: al verificar, se itera sólo sobre empleados con `enabled=true` y hash no nulo. Para volumen actual (<100 empleados) es aceptable; índice en `pin_hash` y `temp_pin_hash`.
- Validación Zod en edge functions.
- Audit log en cada acción sensible.
- `pin_hash` y `temp_pin_hash` nunca se incluyen en `select` desde el cliente — RLS permite leerlos pero la UI evita exponerlos; el admin solo ve `pin_status`, `pin_set_at`, `failed_attempts`, `locked_until`.

### 6. Archivos afectados

Nuevos:
- `supabase/functions/sublime-pin-admin/index.ts`
- `supabase/functions/sublime-pin-public/index.ts`
- `src/components/sublime/FichajePersonalPinSetup.tsx`
- migración SQL

Editados:
- `src/components/crew/CrewSublimeClock.tsx` (panel PIN admin)
- `src/components/sublime/FichajeIdentify.tsx` (OTP 6 dígitos + manejo errores)
- `src/pages/SublimeFichajePublico.tsx` (estados: identify → setup → clock)
- `src/hooks/useSublimeClock.ts` (helpers para llamar edge functions, exponer estado PIN)
- `src/types/sublime.ts` (tipo `PinStatus`, campos nuevos)
- `src/lib/sublimeClock.ts` (eliminar `generatePin`/`hashPin` cliente)

Sin cambios destructivos en módulos existentes.
