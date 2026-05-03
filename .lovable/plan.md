## Objetivo

Cuando se edita una instancia (mes específico) de una obligación recurrente, permitir decidir si los cambios se aplican **solo a ese mes** o **también a los meses futuros** de la misma obligación.

## Cambio en la UI — `EditInstanceSheet.tsx`

Agregar un checkbox al final del formulario, justo antes de los botones:

> ☐ **Aplicar también a los meses futuros**
> Los cambios se replicarán en todas las instancias pendientes de esta obligación con vencimiento posterior a esta.

Por defecto **desactivado** (comportamiento actual: solo edita el mes seleccionado).

## Lógica de propagación

Cuando el checkbox está marcado, al guardar:

1. Se actualiza la instancia actual (igual que hoy).
2. Se actualizan **todas las instancias futuras** de la misma `obligation_id` que cumplan:
   - `due_date > due_date de la instancia actual`
   - `status IN ('pendiente', 'proximo_vencer', 'pausado')` — nunca tocamos pagadas, vencidas ni anuladas.
3. Campos que se propagan (los "estructurales", no los de pago):
   - `amount`
   - `currency`
   - `notes`
   - `status` (solo si el nuevo estado es `pendiente`, `proximo_vencer` o `pausado`)
4. Campos que **NO** se propagan (son específicos de cada mes):
   - `period_label`, `due_date`, `paid_at`, `paid_by`, `payment_reference`.
5. Si la obligación es de **monto variable** (amount = 0), el cambio de monto sí se propaga (vuelve a marcarlas como variables) — coherente con el comportamiento actual.

## Detalles técnicos

- Nuevo método en `useAdminData.ts`: `updateInstanceAndFuture(id, patch, obligationId, dueDate)` que hace dos updates: el de la instancia actual y un bulk update con `gt('due_date', dueDate)` + `in('status', [...])` + `eq('obligation_id', obligationId)`.
- Registra una entrada en `admin_audit_log` con `action = "update_instance_bulk"` indicando cuántas filas se actualizaron.
- En `EditInstanceSheet.tsx`: nuevo estado `applyToFuture`, y en `handleSave` se llama al método nuevo cuando esté marcado.

## Archivos a editar

- `src/hooks/useAdminData.ts` — añadir `updateInstanceAndFuture`.
- `src/components/admin/EditInstanceSheet.tsx` — checkbox + lógica de guardado.