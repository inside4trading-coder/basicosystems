# Unificar “Unidades listas” y “Entradas preparadas” en /core/inventario

## Estado actual (verificado en el código)

- `src/pages/core/CoreInventory.tsx` calcula `readyUnits` y **excluye explícitamente** toda unidad que ya tenga entrada preparada activa (`if (previewByUnit.has(u.id)) continue;`). Por eso el contador muestra 1 en lugar de 27.
- La pestaña “Entradas preparadas” lista los logs `status = 'preview'` con sus acciones (Confirmar, Actualizar stock esperado, Descartar, Ver).
- La acción de la fila en “Unidades listas” hoy es “Preparar entrada” (solo crea preview, no confirma).
- El vencimiento ya está centralizado en `src/lib/coreInventoryPreview.ts` (TTL 15 min) y el backend `core-woo-stock-write` ya bloquea confirmaciones vencidas.

## Cambios (solo UI de /core/inventario)

Archivo único: `src/pages/core/CoreInventory.tsx`.

### 1. Lista unificada

- Quitar la exclusión por preview: cada unidad elegible (procesos completados, no ingresada, no cancelada, no bloqueada) aparece una sola vez en “Unidades listas”, con o sin entrada preparada.
- Se le adjunta su preview activo (si existe) para derivar el estado de entrada:
  - sin preview → **Sin entrada**
  - preview vigente → **Vigente**
  - preview con más de 15 min → **Desactualizada**
  - preview con `status = 'failed'` o error → **Error**
- Sin duplicados: una fila por unidad; si hubiera más de un preview se usa el más reciente (lógica ya existente en `previewByUnit`).

### 2. Pestañas

- Nuevas pestañas: **Unidades listas**, **Historial de entradas**, **Errores / bloqueadas**.
- Se elimina “Entradas preparadas” como pestaña principal. Sus datos técnicos quedan accesibles desde “Ver entrada” en cada fila (mismo diálogo de detalle) y desde el Historial.

### 3. Columnas de Unidades listas

Unidad · OP · Producto · SKU variante · Talla · Stock Woo (actual/último leído) · Estado entrada · Edad entrada · Stock esperado · Acción.

### 4. Acciones por fila

- **Sin entrada**: “Agregar a inventario” — genera preview fresco contra Woo, confirma, verifica y muestra el banner de éxito o la alerta de discrepancia (reutiliza el flujo de confirmación que ya existe en la página, igual que Escaneo).
- **Vigente**: “Agregar a inventario” + “Ver entrada”.
- **Desactualizada**: “Actualizar stock esperado” + “Ver entrada”. El botón de agregar queda deshabilitado hasta refrescar; tras refrescar pasa a Vigente.
- **Error**: “Ver error” y, si aplica, “Reintentar” (regenerar preview).
- En modo `dry_run` la acción sigue siendo solo preparar la entrada, con el aviso actual.

### 5. Contadores

El badge de “Unidades listas” cuenta todas las unidades pendientes de ingreso (con y sin entrada). En el caso actual: 27.

## No se toca

Backend Woo (`core-woo-stock-write` sin cambios), OP, QR, procesos, nómina, partidas, costos, despachos, generación de unidades, y la sección de Escaneo.

## Validación

Contador de Unidades listas = 27; cada fila con su estado correcto; desactualizadas sin poder confirmar hasta actualizar; sin filas duplicadas; typecheck 0 errores.
