
El usuario pide dos features para el módulo Administración:

## Feature 1: Obligaciones recurrentes "siempre" con día exacto

Ya existe la frecuencia `mensual` con `due_day` en `admin_obligations`. Lo que falta es la **generación automática de instancias futuras** mes a mes (perpetua) hasta que se elimine la obligación.

**Opciones de implementación:**

**A) Generación on-demand al cargar el calendario/lista** (cliente o edge function): cuando el usuario navega a un mes, se asegura que existan instancias para todas las obligaciones activas con `frequency` recurrente cuyo `due_day` cae en ese mes. Si no existe, se crea.

**B) Cron job diario** que genera instancias para los próximos N meses (3-6).

**C) Generar al crear la obligación** un buffer de N meses por adelantado, y refrescar al marcar pagada.

Recomiendo **A + C** (combinado): al crear obligación recurrente generamos 12 meses por adelantado; y al cargar un mes, si falta alguna instancia, se crea on-the-fly. Sin cron, sin edge function nueva.

**Cambios:**
- `CreateObligationSheet.tsx`: tras crear obligación con `frequency` ∈ {mensual, bimestral, trimestral, semestral, anual, semanal, quincenal} y `due_day` definido, generar las próximas 12 instancias.
- `useAdminData.ts` → `fetchInstances(filters)`: tras cargar, si `filters.month` está, asegurar que existen instancias para todas las obligaciones recurrentes activas en ese mes (idempotente, evita duplicados con check por `obligation_id + period_label`).
- Helper `generateInstancesForObligation(obligation, monthsAhead)` reutilizable.

No requiere cambios de schema — `admin_obligations.frequency` ya soporta los valores y `due_day` ya existe.

## Feature 2: Adjuntar captura/comprobante al marcar como pagada

Necesita:
1. **Storage bucket** `admin-payments` (privado, solo authenticated).
2. **Columna** `payment_proof_url` en `admin_instances`.
3. **MarkPaidDialog**: añadir input file (image/pdf), subir a storage, guardar URL.
4. **Vista** del comprobante en el detalle de la instancia (link/preview).

## Migración necesaria

```sql
ALTER TABLE admin_instances ADD COLUMN payment_proof_url text;

INSERT INTO storage.buckets (id, name, public) VALUES ('admin-payments', 'admin-payments', false);

CREATE POLICY "Authenticated read admin-payments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'admin-payments');

CREATE POLICY "Authenticated upload admin-payments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'admin-payments');

CREATE POLICY "Authenticated update admin-payments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'admin-payments');

CREATE POLICY "Authenticated delete admin-payments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'admin-payments');
```

## Pasos de implementación (tras aprobar)

1. Migración: añadir `payment_proof_url` + bucket + policies.
2. Helper `generateRecurringInstances(obligation, monthsAhead = 12)` en `useAdminData.ts`.
3. Llamar al helper en `createObligation` y en `fetchInstances` (cuando hay filtro mensual).
4. `markAsPaid(id, paidBy, ref, proofUrl?)` — añadir parámetro.
5. `MarkPaidDialog`: input file + upload + pasar URL.
6. Mostrar el link del comprobante en `AdminInstanceSheet` (vista del detalle).

## Fuera de alcance
- UI para gestionar/eliminar pagos pasados.
- Exportación de comprobantes.
- Cron jobs.
- OCR del comprobante.

¿Apruebas?
