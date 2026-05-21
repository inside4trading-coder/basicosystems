# Por qué no se guardan los cambios desde escalonamzair@gmail.com

## Diagnóstico

Las tablas del módulo Crew (`employees`, `recurring_tasks`, `sublime_clock_settings`, `crew_audit_log`, etc.) tienen reglas de acceso (RLS) que solo permiten **escribir** a usuarios con rol **admin**. Los usuarios con rol **manager** solo pueden **leer**, y los usuarios sin rol asignado no ven nada.

La cuenta `escalonamzair@gmail.com` no aparece como admin, por eso cualquier cambio que intenta hacer en Crew se ignora silenciosamente (la UI parece guardar pero el backend rechaza la actualización).

Además, esa cuenta tampoco existe aún en la tabla de perfiles del sistema (puede que nunca haya iniciado sesión, o que el correo registrado sea ligeramente distinto).

## Pregunta antes de actuar

Necesito que me confirmes qué rol debe tener `escalonamzair@gmail.com`:

- **Opción A — Hacerla admin.** Podrá editar Crew, Administración, RRPP, Sublime, configuración, etc. (acceso total).
- **Opción B — Mantenerla como manager pero permitir editar Crew.** Ampliamos las reglas para que los managers también puedan crear/editar empleados, tareas recurrentes y horarios Sublime. Otros módulos sensibles (sueldos, roles) siguen restringidos a admin.
- **Opción C — Otro alcance específico** (por ejemplo: solo editar ciertas pestañas).

## Pasos según la opción elegida

### Si eliges A (admin)
1. Verificar que la cuenta haya iniciado sesión al menos una vez (si no, pedirle que entre).
2. Asignarle el rol `admin` en la tabla `user_roles`.
3. Probar guardado en Crew.

### Si eliges B (manager con permiso de edición en Crew)
1. Crear migración que añada políticas de escritura para managers en:
   - `employees` (sin permitir cambiar `current_salary`)
   - `recurring_tasks`
   - `sublime_clock_settings`
   - `crew_documents`, `crew_incidents`, `crew_private_notes`
2. Mantener `current_salary` y `crew_salary_history` solo para admin.
3. Asignar rol `manager` a la cuenta si aún no lo tiene.
4. Probar guardado.

## Detalles técnicos

- Tabla de roles: `public.user_roles (user_id, role)` con enum `app_role = {admin, manager, partner}`.
- Helper: `public.has_role(_user_id, _role)`.
- Políticas actuales relevantes (todas con `USING has_role(auth.uid(),'admin')` para escritura):
  - `employees`, `recurring_tasks`, `sublime_clock_settings`, `crew_audit_log`.
- En la opción B, las nuevas políticas usarían `has_role(auth.uid(),'manager') OR has_role(auth.uid(),'admin')` para `INSERT/UPDATE/DELETE`, con un `WITH CHECK` que impida modificar `current_salary` cuando el usuario es manager.
