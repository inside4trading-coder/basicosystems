## Objetivo
Cerrar el sidebar principal automáticamente al seleccionar un módulo, solo cuando está en modo overlay móvil.

## Archivo único
`src/components/AppSidebar.tsx`

## Cambios
1. Extraer `isMobile` y `setOpenMobile` del hook `useSidebar()` (ya importado).
2. Crear `handleNavClick = () => { if (isMobile) setOpenMobile(false); }`.
3. Añadir `onClick={handleNavClick}` a cada `NavLink` de:
   - `visibleItems` (Dashboard, Pedidos, Administración, Crew, Planificación, RRPP, Llamadas, Campañas, CRM, Sublime, Basico Core, Basico España, Fondo Transparente)
   - `adminItems` (Configuración)
4. La navegación, rutas, títulos e íconos quedan exactamente igual.

## Comportamiento
- **Móvil**: navega y cierra el drawer; ya no hace falta la X (la X sigue funcionando).
- **Desktop**: `isMobile` es false, no se cierra nada; el colapso por icono sigue igual.

## Validación
- Tocar Basico Core / Basico España / Sublime en móvil: navega y cierra.
- Desktop sin cambios.
- Typecheck.
