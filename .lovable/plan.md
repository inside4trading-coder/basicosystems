## Gestión completa de usuarios del Hub

Ampliar el panel **Usuarios del hub** (en Configuración) para que un admin pueda crear, eliminar y reenviar invitaciones a usuarios, además de asignar rol.

### Funcionalidades nuevas

1. **Crear usuario** (botón "Nuevo usuario" arriba del listado)
   - Diálogo con: email, contraseña, nombre completo, rol (admin/manager/partner/rrpp/marketing)
   - Crea el usuario directamente con email confirmado (sin necesidad de verificación)
   - Asigna el rol elegido inmediatamente
   - Aparece en el listado al instante

2. **Eliminar usuario** (botón rojo por fila, con confirmación)
   - Borra el usuario de auth + sus roles + su profile
   - Protección: no permite eliminar al admin que está logueado (autoeliminación)
   - Diálogo de confirmación antes de borrar

3. **Reenviar invitación / resetear contraseña** (acción secundaria por fila)
   - Envía email de recuperación de contraseña al usuario
   - Útil cuando alguien olvida su clave

4. **Validaciones**
   - Email válido, contraseña mínimo 8 caracteres
   - Solo admin puede crear/eliminar (verificado en edge function)
   - Todas las acciones quedan registradas

### Cambios técnicos

**Nueva edge function `admin-manage-users`** (`supabase/functions/admin-manage-users/index.ts`)
- Verifica que el caller sea admin (usando service role)
- Acciones soportadas vía body `{ action, ...params }`:
  - `create`: crea user en `auth.users` con `email_confirm: true`, inserta profile, inserta user_role
  - `delete`: valida que no sea self-delete, borra de auth (cascade limpia profile y user_roles)
  - `reset_password`: genera link de recovery y lo envía por email
- CORS habilitado, retorna errores claros

**Actualizar `src/components/configuracion/UserRolesPanel.tsx`**
- Botón "Nuevo usuario" arriba a la derecha → abre `Dialog` con form
- Por fila: menú con "Resetear contraseña" y "Eliminar usuario" (icono trash rojo)
- AlertDialog de confirmación para eliminar
- Toasts de éxito/error
- Refresca el listado tras cada acción

**Sin cambios de BD ni de RLS** — todo se hace vía edge function con service role.

### Archivos afectados

- `supabase/functions/admin-manage-users/index.ts` (nuevo)
- `src/components/configuracion/UserRolesPanel.tsx` (editar)
