
-- 1) Funds
CREATE TABLE IF NOT EXISTS public.core_fabrication_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_type text NOT NULL CHECK (fund_type IN ('general','non_restockable','product_specific','replacement','pending')),
  core_product_id uuid,
  core_variant_id uuid,
  sku text,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  available_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','review')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
CREATE INDEX IF NOT EXISTS idx_cff_type ON public.core_fabrication_funds(fund_type);
CREATE INDEX IF NOT EXISTS idx_cff_product ON public.core_fabrication_funds(core_product_id);
CREATE INDEX IF NOT EXISTS idx_cff_sku ON public.core_fabrication_funds(sku);

ALTER TABLE public.core_fabrication_funds ENABLE ROW LEVEL SECURITY;
CREATE POLICY cff_admin_manager_all ON public.core_fabrication_funds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_cff_updated_at BEFORE UPDATE ON public.core_fabrication_funds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed singleton funds (general + non_restockable + pending) in USD
INSERT INTO public.core_fabrication_funds (fund_type, name, currency)
SELECT 'general','Partida general de fabricación','USD'
WHERE NOT EXISTS (SELECT 1 FROM public.core_fabrication_funds WHERE fund_type='general' AND currency='USD' AND core_product_id IS NULL);

INSERT INTO public.core_fabrication_funds (fund_type, name, currency)
SELECT 'non_restockable','Partida no restockeable','USD'
WHERE NOT EXISTS (SELECT 1 FROM public.core_fabrication_funds WHERE fund_type='non_restockable' AND currency='USD' AND core_product_id IS NULL);

INSERT INTO public.core_fabrication_funds (fund_type, name, currency)
SELECT 'pending','Partida pendiente por resolver','USD'
WHERE NOT EXISTS (SELECT 1 FROM public.core_fabrication_funds WHERE fund_type='pending' AND currency='USD' AND core_product_id IS NULL);

-- 2) Movements
CREATE TABLE IF NOT EXISTS public.core_fabrication_fund_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.core_fabrication_funds(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN (
    'sale_generated','sale_generated_non_restockable',
    'manual_increase','manual_decrease','transfer','reversal','close','correction'
  )),
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('woocommerce','manual','system')),
  source_order_id bigint,
  source_order_item_id bigint,
  woo_product_id bigint,
  woo_variation_id bigint,
  core_product_id uuid,
  core_variant_id uuid,
  sku text,
  product_name text,
  quantity numeric,
  unit_cost_snapshot numeric,
  cost_snapshot_data jsonb,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  related_movement_id uuid REFERENCES public.core_fabrication_fund_movements(id) ON DELETE SET NULL,
  reason text,
  notes text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Anti-duplicate: one sale_generated* per order_item
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cffm_sale
  ON public.core_fabrication_fund_movements(source_order_id, source_order_item_id, movement_type)
  WHERE movement_type IN ('sale_generated','sale_generated_non_restockable')
    AND source_order_item_id IS NOT NULL;

-- Anti-duplicate: one reversal per order_item
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cffm_reversal
  ON public.core_fabrication_fund_movements(source_order_id, source_order_item_id, movement_type)
  WHERE movement_type = 'reversal' AND source_order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cffm_fund ON public.core_fabrication_fund_movements(fund_id);
CREATE INDEX IF NOT EXISTS idx_cffm_order ON public.core_fabrication_fund_movements(source_order_id);
CREATE INDEX IF NOT EXISTS idx_cffm_sku ON public.core_fabrication_fund_movements(sku);
CREATE INDEX IF NOT EXISTS idx_cffm_core_product ON public.core_fabrication_fund_movements(core_product_id);
CREATE INDEX IF NOT EXISTS idx_cffm_type ON public.core_fabrication_fund_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_cffm_created ON public.core_fabrication_fund_movements(created_at DESC);

ALTER TABLE public.core_fabrication_fund_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY cffm_admin_manager_all ON public.core_fabrication_fund_movements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

-- 3) Pending items
CREATE TABLE IF NOT EXISTS public.core_fabrication_fund_pending_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_order_id bigint NOT NULL,
  source_order_item_id bigint,
  woo_product_id bigint,
  woo_variation_id bigint,
  woo_sku text,
  product_name text,
  quantity numeric,
  revenue numeric,
  order_status text,
  reason text NOT NULL CHECK (reason IN (
    'product_not_in_core','missing_cost','missing_sku','sku_conflict',
    'not_fabricable','missing_restock_decision','sync_error'
  )),
  suggested_action text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','ignored','review')),
  resolved_at timestamptz,
  resolved_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cffp_order_item
  ON public.core_fabrication_fund_pending_items(source_order_id, source_order_item_id)
  WHERE source_order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cffp_status ON public.core_fabrication_fund_pending_items(status);
CREATE INDEX IF NOT EXISTS idx_cffp_sku ON public.core_fabrication_fund_pending_items(woo_sku);

ALTER TABLE public.core_fabrication_fund_pending_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cffp_admin_manager_all ON public.core_fabrication_fund_pending_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_cffp_updated_at BEFORE UPDATE ON public.core_fabrication_fund_pending_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Runs
CREATE TABLE IF NOT EXISTS public.core_fabrication_fund_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL DEFAULT 'process_sales',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','completed_warnings','failed')),
  period_start timestamptz,
  period_end timestamptz,
  orders_checked integer NOT NULL DEFAULT 0,
  items_checked integer NOT NULL DEFAULT 0,
  movements_created integer NOT NULL DEFAULT 0,
  pending_items_created integer NOT NULL DEFAULT 0,
  reversals_created integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_cffr_created ON public.core_fabrication_fund_runs(created_at DESC);

ALTER TABLE public.core_fabrication_fund_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY cffr_admin_manager_all ON public.core_fabrication_fund_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
