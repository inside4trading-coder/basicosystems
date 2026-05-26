ALTER TABLE public.core_cost_structures
  ADD COLUMN IF NOT EXISTS woo_product_id BIGINT,
  ADD COLUMN IF NOT EXISTS woo_variation_id BIGINT,
  ADD COLUMN IF NOT EXISTS woo_product_name TEXT,
  ADD COLUMN IF NOT EXISTS woo_permalink TEXT;

CREATE INDEX IF NOT EXISTS idx_core_cost_structures_woo_product_id
  ON public.core_cost_structures(woo_product_id);