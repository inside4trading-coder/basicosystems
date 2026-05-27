
ALTER TABLE public.core_production_units
  ADD COLUMN IF NOT EXISTS entered_inventory_at timestamptz,
  ADD COLUMN IF NOT EXISTS entered_inventory_by uuid,
  ADD COLUMN IF NOT EXISTS inventory_entry_source text;
