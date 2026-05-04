# Problema

Los comprobantes (capturas) no aparecen en el sidebar de la obligación aunque ya estén subidos. El sidebar (`AdminInstanceSheet`) sí tiene la sección "Comprobantes" y la sección "Información de pago" implementadas, pero siempre llegan vacías.

**Causa raíz:** Toda la app lee las instancias desde la vista de Postgres `admin_instances_view`, y esa vista **no incluye la columna `payment_proof_url`**. Por eso `instance.payment_proof_urls` siempre es `null` y la sección de comprobantes nunca se renderiza.

```sql
-- Vista actual (faltan campos):
SELECT i.id, i.obligation_id, ..., i.notes, i.created_at, i.updated_at, ...
FROM admin_instances i JOIN admin_obligations o ...
-- ❌ Falta: payment_proof_url
```

# Solución

## 1. Migración SQL — recrear `admin_instances_view`

`CREATE OR REPLACE VIEW admin_instances_view` agregando la columna que falta:

```sql
DROP VIEW IF EXISTS public.admin_instances_view;
CREATE VIEW public.admin_instances_view AS
SELECT
  i.id, i.obligation_id, i.period_label, i.due_date,
  i.amount, i.currency, i.status,
  i.paid_at, i.paid_by, i.payment_reference,
  i.payment_proof_url,         -- <-- nuevo
  i.notes, i.created_at, i.updated_at,
  o.name AS obligation_name, o.category, o.provider,
  o.frequency, o.importance, o.responsible, o.payment_method,
  get_urgency(i.due_date) AS urgency
FROM admin_instances i
JOIN admin_obligations o ON o.id = i.obligation_id;
```

Con esto, `mapInstance()` en `useAdminData.ts` (que ya lee `row.payment_proof_url`) llenará correctamente `payment_proof_urls`, y el sidebar mostrará automáticamente:
- La sección **Información de pago** (fecha, pagado por, referencia) cuando el estado sea `pagado`.
- La lista de **Comprobantes (N)** con botones "Ver comprobante 1, 2…" que abren la URL firmada del bucket `admin-payments`.

## 2. Reforzar el acceso directo en el sidebar

`src/components/admin/AdminInstanceSheet.tsx`:
- Mover la sección **Información de pago** y **Comprobantes** al inicio del contenido (justo debajo del header) cuando la instancia esté pagada o tenga comprobantes, para que sea lo primero que el usuario vea.
- Mostrar la sección **Información de pago** también cuando haya algún dato de pago aunque el estado no sea `pagado` (por ejemplo, en estados intermedios), revisando `paid_at || paid_by || payment_reference || proofs.length`.
- Mantener los botones existentes "Marcar como pagada" y "Editar info de pago / agregar comprobante".

# Archivos afectados

- Nueva migración SQL en `supabase/migrations/` recreando `admin_instances_view`.
- `src/components/admin/AdminInstanceSheet.tsx` — reordenar bloques y ampliar la condición de visibilidad de la info de pago.

No se requieren cambios en `MarkPaidDialog`, `useAdminData` ni en los tipos.
