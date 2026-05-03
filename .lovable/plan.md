## Objetivo

Permitir marcar una obligación / instancia de pago como **"Sin monto fijo"** (variable), útil para casos como impuestos donde el monto no se conoce de antemano.

## Cambios

### 1. UI — Checkbox "Sin monto fijo (variable)"

Agregar un checkbox arriba del campo "Monto" en los tres sheets donde se ingresa monto:

- **`CreateObligationSheet.tsx`** (paso 2 — primera instancia)
- **`NewInstanceSheet.tsx`** (nueva instancia de obligación existente)
- **`EditInstanceSheet.tsx`** (editar instancia)

Cuando el checkbox está marcado:
- El input de monto se deshabilita y el valor se fuerza a `0`.
- Al guardar, el monto se persiste como `0` (no requerimos columna nueva — `amount = 0` ya representa "sin monto").

### 2. Visualización — mostrar "Variable" en vez de `$0`

En las vistas, cuando `amount === 0` mostrar la etiqueta **"Variable"** en lugar de `$0`:

- **`AdminCalendar.tsx`** — chip del calendario (ya oculta el monto si es 0; añadiremos un pequeño texto "Variable").
- **`AdminListView.tsx`** — celda de monto en la tabla.
- **`AdminInstanceSheet.tsx`** — encabezado del detalle.
- **`AdminKPIs.tsx`** — el "Próximo importante" mostrará "Variable" si amount=0; las sumas seguirán contando 0 (no afectan los totales).

### 3. Al marcar como pagado

En **`MarkPaidDialog.tsx`** (si pide monto), el usuario podrá ingresar el monto real cobrado en ese momento, sobrescribiendo el `0` original. Reviso ese archivo y, si ya pide monto, no requiere cambios; si no lo pide y el monto era 0, agrego un campo para capturar el monto real al pagar.

## Detalles técnicos

- **No requiere migración de base de datos.** Convención: `amount = 0` en `admin_instances` / `admin_obligations` significa "sin monto fijo".
- Validación Zod: cambiar `min(0)` se mantiene; el checkbox simplemente fuerza el valor a 0.
- Helper compartido en componentes: `const isVariable = (n: number) => !n || n <= 0;`

## Archivos a editar

- `src/components/admin/CreateObligationSheet.tsx`
- `src/components/admin/NewInstanceSheet.tsx`
- `src/components/admin/EditInstanceSheet.tsx`
- `src/components/admin/AdminCalendar.tsx`
- `src/components/admin/AdminListView.tsx`
- `src/components/admin/AdminInstanceSheet.tsx`
- `src/components/admin/AdminKPIs.tsx`
- `src/components/admin/MarkPaidDialog.tsx` (revisar; editar solo si hace falta capturar monto al pagar)