
-- ============ esp_sales: campos de origen externo ============
ALTER TABLE public.esp_sales
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pos',
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id text,
  ADD COLUMN IF NOT EXISTS external_order_number text,
  ADD COLUMN IF NOT EXISTS customer_name_snapshot text,
  ADD COLUMN IF NOT EXISTS customer_email_snapshot text,
  ADD COLUMN IF NOT EXISTS shipping_total_eur numeric NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_esp_sales_reference
  ON public.esp_sales (reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

-- ============ esp_sale_items: permitir items sin mapeo ============
ALTER TABLE public.esp_sale_items
  ALTER COLUMN product_id DROP NOT NULL,
  ALTER COLUMN variant_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pos',
  ADD COLUMN IF NOT EXISTS woo_order_item_id bigint;

-- ============ esp_woo_orders ============
CREATE TABLE IF NOT EXISTS public.esp_woo_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_order_id bigint UNIQUE NOT NULL,
  order_number text,
  status text NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  total_eur numeric NOT NULL DEFAULT 0,
  subtotal_eur numeric NOT NULL DEFAULT 0,
  discount_eur numeric NOT NULL DEFAULT 0,
  shipping_total_eur numeric NOT NULL DEFAULT 0,
  total_tax_eur numeric NOT NULL DEFAULT 0,
  payment_method text,
  payment_method_title text,
  customer_id bigint,
  customer_name text,
  customer_email text,
  customer_phone text,
  billing_city text,
  billing_country text,
  shipping_city text,
  shipping_country text,
  shipping_address_snapshot jsonb,
  billing_address_snapshot jsonb,
  date_created timestamptz,
  date_paid timestamptz,
  date_modified timestamptz,
  source text NOT NULL DEFAULT 'woocommerce_es',
  esp_sale_id uuid REFERENCES public.esp_sales(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_woo_orders TO authenticated;
GRANT ALL ON public.esp_woo_orders TO service_role;

ALTER TABLE public.esp_woo_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esp_woo_orders read auth" ON public.esp_woo_orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_woo_orders write admin/manager" ON public.esp_woo_orders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_esp_woo_orders_status ON public.esp_woo_orders(status);
CREATE INDEX IF NOT EXISTS idx_esp_woo_orders_date_created ON public.esp_woo_orders(date_created DESC);

CREATE TRIGGER trg_esp_woo_orders_updated BEFORE UPDATE ON public.esp_woo_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ esp_woo_order_items ============
CREATE TABLE IF NOT EXISTS public.esp_woo_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  esp_woo_order_id uuid NOT NULL REFERENCES public.esp_woo_orders(id) ON DELETE CASCADE,
  woo_order_id bigint NOT NULL,
  woo_order_item_id bigint NOT NULL,
  product_id uuid REFERENCES public.esp_products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.esp_product_variants(id) ON DELETE SET NULL,
  woo_product_id bigint,
  woo_variation_id bigint,
  sku text,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  subtotal_eur numeric NOT NULL DEFAULT 0,
  total_eur numeric NOT NULL DEFAULT 0,
  unit_price_eur numeric,
  needs_fabrication boolean NOT NULL DEFAULT false,
  fabrication_request_id uuid,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (woo_order_id, woo_order_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_woo_order_items TO authenticated;
GRANT ALL ON public.esp_woo_order_items TO service_role;
ALTER TABLE public.esp_woo_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_woo_order_items read auth" ON public.esp_woo_order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_woo_order_items write admin/manager" ON public.esp_woo_order_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_esp_woo_order_items_order ON public.esp_woo_order_items(esp_woo_order_id);

-- ============ esp_woo_order_sync_runs ============
CREATE TABLE IF NOT EXISTS public.esp_woo_order_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL DEFAULT 'orders',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  orders_checked integer NOT NULL DEFAULT 0,
  orders_created integer NOT NULL DEFAULT 0,
  orders_updated integer NOT NULL DEFAULT 0,
  items_checked integer NOT NULL DEFAULT 0,
  items_created integer NOT NULL DEFAULT 0,
  items_updated integer NOT NULL DEFAULT 0,
  sales_created integer NOT NULL DEFAULT 0,
  sales_updated integer NOT NULL DEFAULT 0,
  fabrication_requests_created integer NOT NULL DEFAULT 0,
  unmapped_items integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  summary jsonb,
  params jsonb,
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.esp_woo_order_sync_runs TO authenticated;
GRANT ALL ON public.esp_woo_order_sync_runs TO service_role;
ALTER TABLE public.esp_woo_order_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_woo_order_sync_runs read auth" ON public.esp_woo_order_sync_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_woo_order_sync_runs write admin/manager" ON public.esp_woo_order_sync_runs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

-- ============ esp_fabrication_requests ============
CREATE TABLE IF NOT EXISTS public.esp_fabrication_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL DEFAULT 'woocommerce_order',
  source_order_id uuid REFERENCES public.esp_woo_orders(id) ON DELETE SET NULL,
  source_order_item_id uuid UNIQUE REFERENCES public.esp_woo_order_items(id) ON DELETE CASCADE,
  woo_order_id bigint,
  woo_order_item_id bigint,
  product_id uuid REFERENCES public.esp_products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.esp_product_variants(id) ON DELETE SET NULL,
  sku text,
  product_name text,
  variant_label text,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',
  due_date date,
  notes text,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_fabrication_requests TO authenticated;
GRANT ALL ON public.esp_fabrication_requests TO service_role;
ALTER TABLE public.esp_fabrication_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_fabrication_requests read auth" ON public.esp_fabrication_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_fabrication_requests write admin/manager" ON public.esp_fabrication_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_esp_fabrication_status ON public.esp_fabrication_requests(status);

CREATE TRIGGER trg_esp_fabrication_updated BEFORE UPDATE ON public.esp_fabrication_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
