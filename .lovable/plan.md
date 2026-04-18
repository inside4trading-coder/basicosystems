
## Contexto

El usuario pide dos mejoras en el módulo RRPP del perfil de contacto:

1. **Redes sociales**: ya se pueden agregar mediciones, pero quiere reforzar el flujo de "nuevo muestreo" y la visualización de crecimiento/decrecimiento vs medición anterior.
2. **Colaboraciones**: hoy el formulario pide todos los datos al crear. Necesita poder crear una colaboración con datos mínimos y luego **editarla** para ir agregando información (cupón, ingresos, fecha de post, etc.) a medida que avanza.

## Estado actual

- `RRPPSocialMedia.tsx` ya soporta agregar mediciones y muestra tendencia (TrendIcon ↑/↓/—) comparando última vs anterior por red. Funciona, pero:
  - El botón se llama "Agregar red social", confuso cuando ya existe esa red. Debe llamarse "Nuevo muestreo" cuando ya hay datos de esa red, y prefijar la red automáticamente.
  - El delta se muestra solo en valor absoluto. Falta el porcentaje (+12.5%) que es la métrica clave de crecimiento.
  - No hay un atajo "+ muestreo" por tarjeta de red existente.

- `RRPPCollaborations.tsx` (no mostrado pero referenciado): el Sheet exige todos los campos al crear. No hay flujo de edición posterior.

## Cambios

### 1. `src/components/rrpp/RRPPSocialMedia.tsx`

- Añadir botón **"+ Nuevo muestreo"** en cada tarjeta de red existente, que abre el Sheet con `network` preseleccionado y `handle` autocompletado del último muestreo (editable).
- Mantener "Agregar red social" en el header solo para redes nuevas.
- En el bloque de tendencia, añadir el **porcentaje** de variación junto al valor absoluto: `+1.2K (+12.5%)` o `−340 (−4.1%)`.
- Pequeño coloreo: verde para crecimiento, rojo para decrecimiento, gris si no hay anterior.

### 2. `src/components/rrpp/RRPPCollaborations.tsx`

- **Crear con datos mínimos**: hacer el Sheet de creación opcional en todos los campos excepto `send_date` (o ninguno; default hoy). El usuario puede crear la fila apenas con "products" y guardar.
- **Editar colaboración existente**: añadir botón ✏️ "Editar" en cada `kpi-card` de colaboración. Reutilizar el mismo Sheet en modo edición:
  - Si `editingId` está set, hace `update()` en lugar de `insert()`.
  - Pre-rellena el form con los valores actuales.
  - Audit log: registra el cambio como `collab_update` con resumen de campos modificados.
- **Eliminar colaboración**: añadir AlertDialog con botón de papelera (admin/rrpp/marketing).
- Mantener la lógica condicional de campos (cupón si `has_coupon`, post si `collab_done`) tanto en creación como en edición.

### 3. Permisos

Sin cambios en RLS — las policies ya permiten manage a admin/rrpp/marketing. El hook `useRRPPPermissions` ya cubre los gates de UI.

## Archivos a tocar

- `src/components/rrpp/RRPPSocialMedia.tsx` — preselección de red, botón por tarjeta, % de cambio.
- `src/components/rrpp/RRPPCollaborations.tsx` — modo edición + delete + campos opcionales.

Sin migraciones ni cambios en edge functions.
