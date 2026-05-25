
-- ============== core_products ==============
CREATE TABLE public.core_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  core_sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  product_type text,
  color text,
  image_url text,
  commercial_status text NOT NULL DEFAULT 'draft',
  is_restockable boolean NOT NULL DEFAULT true,
  cost_structure_id uuid,
  cost_template_id uuid,
  cost_snapshot jsonb,
  unit_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  estimated_sale_price numeric,
  gross_margin numeric,
  gross_margin_percent numeric,
  suggested_fabrication_fund numeric NOT NULL DEFAULT 0,
  woo_product_id bigint,
  woo_product_name text,
  woo_sku text,
  woo_permalink text,
  woo_status text,
  woo_stock_quantity integer,
  woo_regular_price numeric,
  woo_sale_price numeric,
  woo_last_sync_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

ALTER TABLE public.core_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_products_admin_manager_all
ON public.core_products FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_core_products_updated_at
BEFORE UPDATE ON public.core_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_core_products_status ON public.core_products(commercial_status);
CREATE INDEX idx_core_products_type ON public.core_products(product_type);
CREATE INDEX idx_core_products_woo ON public.core_products(woo_product_id);

-- ============== core_product_variants ==============
CREATE TABLE public.core_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  core_product_id uuid NOT NULL REFERENCES public.core_products(id) ON DELETE CASCADE,
  size text NOT NULL,
  variant_label text,
  status text NOT NULL DEFAULT 'active',
  woo_variation_id bigint,
  woo_sku text,
  woo_stock_quantity integer,
  woo_regular_price numeric,
  woo_sale_price numeric,
  woo_last_sync_at timestamptz,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (core_product_id, size)
);

ALTER TABLE public.core_product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_pv_admin_manager_all
ON public.core_product_variants FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_core_product_variants_updated_at
BEFORE UPDATE ON public.core_product_variants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== core_product_cost_snapshots ==============
CREATE TABLE public.core_product_cost_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  core_product_id uuid NOT NULL REFERENCES public.core_products(id) ON DELETE CASCADE,
  cost_structure_id uuid,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.core_product_cost_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_pcs_admin_manager_all
ON public.core_product_cost_snapshots FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
