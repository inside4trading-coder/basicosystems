
-- 1. core_production_needs
CREATE TABLE public.core_production_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_type text NOT NULL DEFAULT 'sale_generated',
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'media',
  core_product_id uuid,
  core_variant_id uuid,
  sku text,
  variant_sku text,
  product_name text,
  variant_label text,
  size text,
  quantity_needed numeric NOT NULL DEFAULT 0,
  quantity_approved numeric NOT NULL DEFAULT 0,
  quantity_converted_to_order numeric NOT NULL DEFAULT 0,
  quantity_pending numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'auto',
  last_sale_at timestamptz,
  desired_date date,
  reason text,
  notes text,
  is_overproduction boolean NOT NULL DEFAULT false,
  generation_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT chk_need_type CHECK (need_type IN ('sale_generated','manual_restock','adjustment','inventory_restock')),
  CONSTRAINT chk_need_status CHECK (status IN ('pending','review','approved','partially_converted','converted_to_order','ignored','cancelled','blocked')),
  CONSTRAINT chk_need_priority CHECK (priority IN ('alta','media','baja')),
  CONSTRAINT chk_qty_needed CHECK (quantity_needed >= 0),
  CONSTRAINT chk_qty_approved CHECK (quantity_approved >= 0),
  CONSTRAINT chk_qty_converted CHECK (quantity_converted_to_order >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_production_needs TO authenticated;
GRANT ALL ON public.core_production_needs TO service_role;

ALTER TABLE public.core_production_needs ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_needs_admin_manager_all ON public.core_production_needs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX idx_cpn_core_product ON public.core_production_needs(core_product_id);
CREATE INDEX idx_cpn_core_variant ON public.core_production_needs(core_variant_id);
CREATE INDEX idx_cpn_status ON public.core_production_needs(status);
CREATE INDEX idx_cpn_need_type ON public.core_production_needs(need_type);
CREATE INDEX idx_cpn_priority ON public.core_production_needs(priority);
CREATE UNIQUE INDEX uq_cpn_open_auto_variant
  ON public.core_production_needs(core_variant_id, need_type)
  WHERE need_type = 'sale_generated' AND status IN ('pending','review','approved','partially_converted');

CREATE TRIGGER trg_cpn_set_updated_at
  BEFORE UPDATE ON public.core_production_needs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. core_production_need_sources
CREATE TABLE public.core_production_need_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_need_id uuid NOT NULL REFERENCES public.core_production_needs(id) ON DELETE CASCADE,
  fabrication_fund_movement_id uuid,
  source_order_id bigint,
  source_order_item_id bigint,
  quantity numeric NOT NULL DEFAULT 0,
  amount numeric,
  currency text DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_production_need_sources TO authenticated;
GRANT ALL ON public.core_production_need_sources TO service_role;

ALTER TABLE public.core_production_need_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_need_sources_admin_manager_all ON public.core_production_need_sources
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX idx_cpns_need ON public.core_production_need_sources(production_need_id);
CREATE UNIQUE INDEX uq_cpns_movement ON public.core_production_need_sources(fabrication_fund_movement_id)
  WHERE fabrication_fund_movement_id IS NOT NULL;
CREATE INDEX idx_cpns_order ON public.core_production_need_sources(source_order_id);

-- 3. core_production_need_runs
CREATE TABLE public.core_production_need_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL DEFAULT 'generate_from_movements',
  status text NOT NULL DEFAULT 'completed',
  movements_checked integer NOT NULL DEFAULT 0,
  needs_created integer NOT NULL DEFAULT 0,
  needs_updated integer NOT NULL DEFAULT 0,
  movements_linked integer NOT NULL DEFAULT 0,
  reversals_detected integer NOT NULL DEFAULT 0,
  skipped_existing integer NOT NULL DEFAULT 0,
  blocked_count integer NOT NULL DEFAULT 0,
  non_restockable_skipped integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_production_need_runs TO authenticated;
GRANT ALL ON public.core_production_need_runs TO service_role;

ALTER TABLE public.core_production_need_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_need_runs_admin_manager_all ON public.core_production_need_runs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
