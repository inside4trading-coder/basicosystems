

## Plan: Restaurar acceso completo al sidebar para `ugcbasico@gmail.com`

### Diagnóstico
- Sidebar oculta módulos cuando `userRole === "partner"` (solo deja Dashboard + Planning).
- Asignamos `admin` en `user_roles`, pero `profiles.role` sigue en `'partner'` (default).
- Probablemente `useAuth` resuelve el rol desde `profiles.role`, no desde `user_roles` → por eso el sidebar te trata como partner.

### Pasos

1. **Verificar fuente de verdad del rol** en `src/hooks/useAuth.tsx` (¿lee de `profiles.role` o de `user_roles`?).
2. **Sincronizar `profiles.role`** del usuario `d05b3726-8fc2-41bc-a99c-61548f9d9cd0` a `'admin'` vía migración (UPDATE en `profiles`).
3. **(Opcional, recomendado)** Migrar `useAuth` para leer rol desde `user_roles` (fuente correcta según RBAC del proyecto), evitando que vuelva a desincronizarse.
4. Pedirte cerrar sesión y entrar de nuevo para refrescar el rol en el cliente.

### Entregable
- Sidebar muestra los 8 ítems (Dashboard, Pedidos, CRM, Planning, Crew, Campaigns, Llamadas, Configuración).
- Rol admin consistente entre `profiles` y `user_roles`.

