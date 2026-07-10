## Problema

`core_replenishment_policies_lifecycle_status_check` sólo permite `'active','no_restock','exit','archived','ignored'`. El botón "Reemplazo" ahora guarda `lifecycle_status='replaced'`, valor no incluido en el CHECK → violación.

## Corrección (una migración)

Reemplazar el CHECK para incluir `'replaced'`:

```sql
ALTER TABLE public.core_replenishment_policies
  DROP CONSTRAINT core_replenishment_policies_lifecycle_status_check;

ALTER TABLE public.core_replenishment_policies
  ADD CONSTRAINT core_replenishment_policies_lifecycle_status_check
  CHECK (lifecycle_status = ANY (ARRAY['active','no_restock','exit','replaced','archived','ignored']));
```

Sin cambios de tabla, columnas, RLS, RPC ni código. Sólo amplía el conjunto permitido para incluir el estado que ya usan `NoRestockConfigDialog` y `LifecycleStatusDialog`.
