## Problema

En iPhone aparece "Permiso de ubicación denegado. No es posible fichar sin GPS." aunque el usuario haya autorizado el GPS. Esto pasa por cómo iOS Safari/Chrome maneja `getCurrentPosition`:

1. Con `enableHighAccuracy: true` + `timeout: 15s` + `maximumAge: 0`, iOS a veces devuelve `code 1` (PERMISSION_DENIED) cuando en realidad es un timeout interno o el usuario aún no respondió al prompt.
2. iOS reserva el permiso por sesión Safari — si el usuario lo dio "Permitir una vez" hace rato, el siguiente intento vuelve a pedirlo y si se tarda, falla.
3. No se distinguen los códigos `1` (denied), `2` (unavailable) y `3` (timeout), ni se diferencia denied del navegador vs denied del sistema iOS.
4. No hay reintento con configuración más permisiva (low-accuracy fallback).

## Plan

### 1. Mejorar `handleAction` en `src/components/sublime/FichajeClock.tsx`
- **Pre-check de permisos** vía `navigator.permissions.query({ name: 'geolocation' })` cuando esté disponible. Si está `denied`, mostrar mensaje específico con instrucciones para iOS.
- **Estrategia de doble intento**:
  - Intento 1: `enableHighAccuracy: true, timeout: 12s, maximumAge: 0`.
  - Si falla con `code 3` (timeout) o `code 2`: reintento automático con `enableHighAccuracy: false, timeout: 20s, maximumAge: 30000`.
- **Mensajes de error diferenciados**:
  - `code 1` denied: mensaje claro con instrucciones iOS ("Ajustes → Safari → Ubicación → Permitir" o "Ajustes → Privacidad → Localización → Safari").
  - `code 2` unavailable: "GPS no disponible. Sal al exterior o activa la localización del sistema."
  - `code 3` timeout: "No se obtuvo señal GPS a tiempo. Reintenta cerca de una ventana o al exterior."
- **Detección de iOS** (`/iPad|iPhone|iPod/.test(navigator.userAgent)`) para mostrar el panel de ayuda específico solo en iOS.

### 2. UI del estado `error`
- Cuando el error sea `permission_denied` en iOS, añadir un bloque expandible con pasos numerados:
  1. Abre Ajustes del iPhone.
  2. Ve a Safari → Ubicación → selecciona "Preguntar" o "Permitir".
  3. También: Ajustes → Privacidad y seguridad → Localización → activa "Servicios de localización" y permite Safari.
  4. Cierra todas las pestañas de Safari y vuelve a abrir el enlace.
- Botón "Reintentar" como ya existe.

### 3. Verificación
- Build TypeScript.
- (No reproducible desde sandbox sin iPhone real — pedir al usuario que pruebe).

## Archivos a editar
- `src/components/sublime/FichajeClock.tsx`: lógica de geolocalización con retry + mensajes específicos + panel de ayuda iOS.

Sin cambios en backend ni en otras pantallas.
