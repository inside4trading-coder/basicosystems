ALTER TABLE public.core_production_units
  ADD COLUMN IF NOT EXISTS inventory_variant_override_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_override_variant_id uuid REFERENCES public.core_product_variants(id),
  ADD COLUMN IF NOT EXISTS inventory_override_variant_sku text,
  ADD COLUMN IF NOT EXISTS inventory_override_color text,
  ADD COLUMN IF NOT EXISTS inventory_override_size text,
  ADD COLUMN IF NOT EXISTS inventory_override_woo_variation_id bigint,
  ADD COLUMN IF NOT EXISTS inventory_override_reason text,
  ADD COLUMN IF NOT EXISTS inventory_override_by uuid,
  ADD COLUMN IF NOT EXISTS inventory_override_at timestamptz;