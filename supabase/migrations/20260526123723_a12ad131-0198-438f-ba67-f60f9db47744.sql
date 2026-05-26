ALTER TABLE public.core_restock_control
  ADD COLUMN IF NOT EXISTS replacement_core_variant_id uuid,
  ADD COLUMN IF NOT EXISTS replacement_variant_label text;