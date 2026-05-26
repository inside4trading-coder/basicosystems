
ALTER TABLE public.core_products
  ADD COLUMN IF NOT EXISTS sku_source text NOT NULL DEFAULT 'core_generated',
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'manual_only';

CREATE INDEX IF NOT EXISTS idx_core_products_sync_status ON public.core_products(sync_status);
CREATE INDEX IF NOT EXISTS idx_core_products_woo_sku ON public.core_products(woo_sku);

ALTER TABLE public.core_product_variants
  ADD COLUMN IF NOT EXISTS variant_sku text;

CREATE INDEX IF NOT EXISTS idx_core_pv_variant_sku ON public.core_product_variants(variant_sku);

CREATE TABLE IF NOT EXISTS public.core_woo_product_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_product_id bigint NOT NULL,
  woo_variation_id bigint,
  woo_product_name text,
  woo_sku text,
  woo_status text,
  woo_stock_quantity integer,
  woo_regular_price numeric,
  woo_sale_price numeric,
  woo_permalink text,
  woo_variations jsonb,
  source_order_id bigint,
  source_order_item_id bigint,
  detected_from text NOT NULL DEFAULT 'catalog',
  status text NOT NULL DEFAULT 'pendiente',
  matched_core_product_id uuid,
  matched_core_variant_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_core_woo_cand_product
  ON public.core_woo_product_candidates(woo_product_id)
  WHERE woo_variation_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_core_woo_cand_variation
  ON public.core_woo_product_candidates(woo_product_id, woo_variation_id)
  WHERE woo_variation_id IS NOT NULL;

ALTER TABLE public.core_woo_product_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_woo_cand_admin_manager_all
ON public.core_woo_product_candidates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_core_woo_cand_updated_at
BEFORE UPDATE ON public.core_woo_product_candidates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_core_woo_cand_status ON public.core_woo_product_candidates(status);
CREATE INDEX IF NOT EXISTS idx_core_woo_cand_sku ON public.core_woo_product_candidates(woo_sku);
