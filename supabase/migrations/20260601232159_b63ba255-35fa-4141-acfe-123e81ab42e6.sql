
ALTER TABLE public.esp_products
  ADD COLUMN IF NOT EXISTS woo_permalink text,
  ADD COLUMN IF NOT EXISTS woo_status text,
  ADD COLUMN IF NOT EXISTS woo_type text,
  ADD COLUMN IF NOT EXISTS woo_image_url text,
  ADD COLUMN IF NOT EXISTS woo_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.esp_product_variants
  ADD COLUMN IF NOT EXISTS woo_product_id bigint,
  ADD COLUMN IF NOT EXISTS woo_status text,
  ADD COLUMN IF NOT EXISTS woo_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS woo_stock_quantity integer,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_esp_products_woo_product_id ON public.esp_products(woo_product_id);
CREATE INDEX IF NOT EXISTS idx_esp_variants_woo_variation_id ON public.esp_product_variants(woo_variation_id);
CREATE INDEX IF NOT EXISTS idx_esp_variants_woo_product_id ON public.esp_product_variants(woo_product_id);

CREATE TABLE IF NOT EXISTS public.esp_woo_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL DEFAULT 'catalog',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  products_checked int NOT NULL DEFAULT 0,
  products_created int NOT NULL DEFAULT 0,
  products_updated int NOT NULL DEFAULT 0,
  variants_checked int NOT NULL DEFAULT 0,
  variants_created int NOT NULL DEFAULT 0,
  variants_updated int NOT NULL DEFAULT 0,
  skipped_no_sku int NOT NULL DEFAULT 0,
  errors_count int NOT NULL DEFAULT 0,
  summary jsonb,
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.esp_woo_sync_runs TO authenticated;
GRANT ALL ON public.esp_woo_sync_runs TO service_role;

ALTER TABLE public.esp_woo_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esp_woo_sync_runs read admin/manager"
  ON public.esp_woo_sync_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "esp_woo_sync_runs write admin/manager"
  ON public.esp_woo_sync_runs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_esp_woo_sync_runs_started ON public.esp_woo_sync_runs(started_at DESC);
