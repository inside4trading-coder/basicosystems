## Objetivo

En el módulo **Crew**, restringir el acceso del rol **manager** (y cualquier rol distinto de admin) a información sensible: salarios e historial salarial deben mostrarse como `—`, y la pestaña de notas privadas debe ocultarse por completo.

## Cambios

### 1. `src/pages/CrewProfile.tsx`
- Importar `useAuth` y leer `role`.
- Calcular `isAdmin = role === "admin"`.
- En el `TabsList`:
  - Ocultar el `<TabsTrigger value="notes">` cuando no es admin.
  - Cambiar la etiqueta de la pestaña de salario a "Sueldo" y ocultar el `<TabsTrigger value="salary">` por completo si no es admin (no la dejamos vacía; el sueldo aún sale en "Datos generales" como `—`).
- Eliminar/condicionar `<TabsContent value="salary">` y `<TabsContent value="notes">` cuando no es admin.
- Si la URL anterior hace que `activeTab` quede en "salary" o "notes" sin permiso, forzar reset a `"general"` con un `useEffect`.

### 2. `src/components/crew/CrewGeneralData.tsx`
- Aceptar nuevo prop `canViewSalary: boolean` (o leer rol con `useAuth` directamente, más simple).
- En el campo "Sueldo actual":
  - Si `!isAdmin`: mostrar siempre `<Placeholder />` (`—`), sin importar el valor real.
  - En `editMode`, no mostrar el input de sueldo a no-admin (mantener `—`).

### 3. Ocultar también el botón "Cambiar sueldo" / acceso al historial
- Como ya quitamos la pestaña "Historial salarial", `CrewSalaryHistory` no se renderiza para manager → no se hacen queries a `salary_history`. No se requieren cambios en ese componente.

### 4. RLS (defensa en profundidad)
Las políticas actuales ya son seguras:
- `salary_history`: solo admin puede gestionar (no hay policy de SELECT para manager → no puede leer). ✅
- `private_notes`: solo admin. ✅
- `employees.current_salary`: la tabla `employees` solo es accesible por admin a nivel RLS. Manager no la lee directamente — pero el módulo Crew usa el cliente con sesión de manager, por lo que `useCrewData` probablemente ya falla para manager.

> **Verificación pendiente**: confirmar cómo `useCrewData` está obteniendo empleados para manager (si pasa por edge function con service role o usa el cliente directo). Si pasa por el cliente directo, manager no puede leer `employees` actualmente. Esto se revisa en la implementación; si hace falta, se añade una policy SELECT para manager sobre `employees` excluyendo `current_salary` (vía vista) — pero el enfoque más simple es **mantener RLS estricta y ocultar el campo en UI**, asumiendo que la lectura de empleados funciona vía el flujo existente.

### Resultado esperado para manager
- Pestaña "Datos generales": ve todo excepto el sueldo, que aparece como `—` y no es editable.
- Pestaña "Historial salarial": **no aparece**.
- Pestaña "Notas privadas": **no aparece**.
- Las pestañas restantes (tareas recurrentes, incidencias, documentos) siguen disponibles según RLS existentes.

Admin no se ve afectado: sigue viendo todo.

## Archivos modificados
- `src/pages/CrewProfile.tsx`
- `src/components/crew/CrewGeneralData.tsx`
