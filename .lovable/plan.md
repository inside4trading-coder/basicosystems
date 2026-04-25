## Objetivo

1. Permitir crear cuentas desde `/login` (sin rol por defecto → sin acceso al sistema).
2. Convertir la sección "Usuarios del hub" en `/configuracion` (hoy mockup) en un **panel real de gestión de roles** para admins.
3. Documentar la lógica de roles existente.

---

## Lógica actual de roles

Definida en `src/hooks/useAuth.tsx` (`ROLE_ROUTES`) + RLS en DB usando `has_role(auth.uid(), '<rol>'::app_role)` sobre la tabla `user_roles`.

| Rol | Rutas UI | Capabilities (lectura/escritura en DB) |
|---|---|---|
| **admin** | dashboard, pedidos, crm, planning, crew, rrpp, campaigns, llamadas, configuracion, administracion | Acceso total a todas las tablas. Único que gestiona `employees`, `user_roles`, `crew_*`, `admin_*`, notas privadas, leads, recurring tasks, salary history. |
| **manager** | dashboard, pedidos, crm, planning, campaigns, llamadas | RW en `orders`, `order_items`, `payments`, `customers_cache`, `campaigns`, `campaign_stats`, `calls_cache`, `product_costs`, `segments`, `sip_agents`. Solo lectura en `employee_documents`, `incidents`. |
| **partner** | dashboard, planning | Solo lectura en `orders`, `order_items`, `payments`. Vista mínima para socios externos. |
| **rrpp** | dashboard, rrpp | Gestiona `rrpp_contacts`, `rrpp_collaborations`, `rrpp_interactions`, `rrpp_social_media`, notas privadas RRPP, audit log. |
| **marketing** | dashboard, rrpp, campaigns | Igual que rrpp pero **sin** notas privadas RRPP + acceso a campañas. |
| **(sin rol)** ← nuevo | ninguna | Pantalla "Cuenta pendiente de aprobación" con botón cerrar sesión. |

Doble capa de seguridad: `ProtectedRoute` (frontend) + RLS por tabla (backend).

---

## Cambios a implementar

### 1. Login con registro — `src/pages/Login.tsx`
- Toggle `mode: "login" | "signup"` con link "¿No tienes cuenta? Crear una" / "Ya tengo cuenta".
- En signup: campos **Nombre completo**, email, password (mín. 6).
- Llamar `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: ${origin}/ } })`.
- Tras éxito: toast claro **"Cuenta creada. Verifica tu email. Un administrador debe asignarte permisos para acceder al sistema."**

### 2. Hook de auth — `src/hooks/useAuth.tsx`
- `fetchRole`: si no hay fila en `user_roles` y `profiles.role` es null → `setRole(null)` (NO caer a `"partner"`).

### 3. Pantalla "Sin acceso" — `src/components/ProtectedRoute.tsx`
- Si `user` existe pero `role === null`: renderizar pantalla con logo, email del usuario, mensaje **"Tu cuenta está pendiente de aprobación. Contacta a un administrador."** y botón **Cerrar sesión**.
- Sin esta pantalla habría loop de redirects.

### 4. Migración DB
- `ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT, ALTER COLUMN role DROP NOT NULL;`
- Modificar trigger `handle_new_user()` para insertar `role = NULL`.
- Añadir policy en `user_roles` para que **admins puedan SELECT/INSERT/DELETE** (ya existe "Admins can manage all roles" — verificar y dejar tal cual).
- Añadir policy en `profiles`: **admins pueden SELECT todos los profiles** (ya existe "Admins can read all profiles" ✓).
- Crear edge function `admin-list-users` (service role) que devuelve la lista combinada `auth.users + profiles + user_roles` para mostrar en Configuración (porque `auth.users` no es accesible desde el cliente). Validar JWT + `has_role(uid, 'admin')` en código.

### 5. Sección "Usuarios del hub" en `/configuracion` — gestión real
Reemplazar el mockup `mockUsers` por componente conectado a datos reales:

- **Listado**: invocar edge function `admin-list-users` → tabla con columnas:
  - Nombre + email
  - Estado: `Pendiente` (sin rol), `Activo` (con rol), `Email no verificado`
  - Selector de rol: `— Sin rol —` / Admin / Manager / Partner / RRPP / Marketing
  - Botón eliminar rol (vuelve a "sin rol" → bloquea acceso)
  
- **Cambio de rol**: al cambiar selector → `DELETE FROM user_roles WHERE user_id = X` + si rol nuevo ≠ "sin rol" → `INSERT INTO user_roles (user_id, role) VALUES (X, nuevo)`. Toast de confirmación.

- **Diálogo "Invitar usuario"** (botón existente): formulario con email + rol inicial. Llamar otra edge function `admin-invite-user` que usa `supabase.auth.admin.inviteUserByEmail(email)` (service role) y crea fila en `user_roles` con el rol elegido. Alternativa más simple si no quieres edge function: solo mostrar instrucción "Pídele al usuario que se registre en /login y luego asígnale rol aquí" — **prefiero esta opción** para mantener el plan compacto. ¿Confirmas?

- **Tarjeta de leyenda**: panel pequeño con la tabla de roles → capabilities (resumen visual de la sección anterior de este plan), para que el admin entienda qué le da a cada usuario.

- **Protección UI**: solo se renderiza si `useAuth().role === "admin"` (ya está protegido por ruta, pero doble check).

---

## Detalles técnicos

**Archivos a modificar:**
- `src/pages/Login.tsx` — añadir flujo signup
- `src/hooks/useAuth.tsx` — permitir `role = null`
- `src/components/ProtectedRoute.tsx` — pantalla pendiente
- `src/pages/Configuracion.tsx` — reemplazar `mockUsers` por componente real `<UserRolesPanel />`
- Nuevo: `src/components/configuracion/UserRolesPanel.tsx`
- Nuevo: `supabase/functions/admin-list-users/index.ts` (service role + valida admin)

**Migración SQL:**
```sql
ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN role DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NULL);
  RETURN NEW;
END; $$;
```

**Seguridad:** 
- Email verification activada (default) → el usuario no puede loguearse sin confirmar email.
- RLS bloquea cualquier dato a usuarios sin rol aunque burlen el frontend.
- Edge function `admin-list-users` valida JWT + verifica `has_role(uid, 'admin')` antes de devolver datos.
- Cambios de `user_roles` desde el cliente están protegidos por RLS "Admins can manage all roles".
