ALTER TABLE public.core_replenishment_policies
  DROP CONSTRAINT IF EXISTS core_replenishment_policies_lifecycle_status_check;

ALTER TABLE public.core_replenishment_policies
  ADD CONSTRAINT core_replenishment_policies_lifecycle_status_check
  CHECK (lifecycle_status = ANY (ARRAY['active'::text,'no_restock'::text,'exit'::text,'replaced'::text,'archived'::text,'ignored'::text]));