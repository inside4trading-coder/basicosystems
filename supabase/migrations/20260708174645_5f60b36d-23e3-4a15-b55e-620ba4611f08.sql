
-- ============================================================
-- core_woo_product_map
-- ============================================================
CREATE TABLE IF NOT EXISTS public.core_woo_product_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_product_id bigint NOT NULL UNIQUE,
  woo_product_name text,
  woo_product_sku text,
  woo_product_type text,
  woo_status text,
  woo_permalink text,
  woo_parent_id bigint,
  woo_variations_count int NOT NULL DEFAULT 0,
  woo_raw_payload jsonb,
  core_product_id uuid REFERENCES public.core_products(id) ON DELETE SET NULL,
  mapping_status text NOT NULL DEFAULT 'unmapped' CHECK (mapping_status IN ('unmapped','mapped','ignored','needs_review')),
  variants_sync_status text NOT NULL DEFAULT 'not_synced' CHECK (variants_sync_status IN ('not_synced','synced','partial','not_applicable')),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
CREATE INDEX IF NOT EXISTS idx_cwpm_core_product ON public.core_woo_product_map(core_product_id);
CREATE INDEX IF NOT EXISTS idx_cwpm_status ON public.core_woo_product_map(mapping_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_woo_product_map TO authenticated;
GRANT ALL ON public.core_woo_product_map TO service_role;
ALTER TABLE public.core_woo_product_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cwpm read authenticated"
  ON public.core_woo_product_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "cwpm write admin/manager"
  ON public.core_woo_product_map FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "cwpm update admin/manager"
  ON public.core_woo_product_map FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "cwpm delete admin"
  ON public.core_woo_product_map FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER cwpm_set_updated_at BEFORE UPDATE ON public.core_woo_product_map
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- core_woo_variant_map
-- ============================================================
CREATE TABLE IF NOT EXISTS public.core_woo_variant_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_product_id bigint NOT NULL,
  woo_variation_id bigint NOT NULL UNIQUE,
  woo_variant_sku text,
  woo_attributes jsonb,
  size_label text,
  normalized_size text,
  color_label text,
  normalized_color text,
  woo_price numeric,
  woo_stock_quantity numeric,
  woo_raw_payload jsonb,
  core_product_id uuid REFERENCES public.core_products(id) ON DELETE SET NULL,
  core_variant_id uuid REFERENCES public.core_product_variants(id) ON DELETE SET NULL,
  mapping_status text NOT NULL DEFAULT 'unmapped' CHECK (mapping_status IN ('unmapped','mapped','ignored','needs_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cwvm_woo_product ON public.core_woo_variant_map(woo_product_id);
CREATE INDEX IF NOT EXISTS idx_cwvm_core_product ON public.core_woo_variant_map(core_product_id);
CREATE INDEX IF NOT EXISTS idx_cwvm_core_variant ON public.core_woo_variant_map(core_variant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_woo_variant_map TO authenticated;
GRANT ALL ON public.core_woo_variant_map TO service_role;
ALTER TABLE public.core_woo_variant_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cwvm read authenticated"
  ON public.core_woo_variant_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "cwvm insert admin/manager"
  ON public.core_woo_variant_map FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "cwvm update admin/manager"
  ON public.core_woo_variant_map FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "cwvm delete admin"
  ON public.core_woo_variant_map FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER cwvm_set_updated_at BEFORE UPDATE ON public.core_woo_variant_map
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- core_replenishment_policies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.core_replenishment_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_product_id bigint,
  core_product_id uuid REFERENCES public.core_products(id) ON DELETE SET NULL,
  product_name_snapshot text,
  sku_snapshot text,
  brand_role text NOT NULL DEFAULT 'regular' CHECK (brand_role IN ('core','regular','candidate')),
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active','no_restock','exit','archived','ignored')),
  replenishment_route text NOT NULL DEFAULT 'internal_factory' CHECK (replenishment_route IN ('internal_factory','external_supplier','manual_cost_only','none')),
  restock_enabled boolean NOT NULL DEFAULT true,
  manual_unit_cost_usd numeric,
  manual_cost_reason text,
  manual_cost_updated_at timestamptz,
  manual_cost_updated_by uuid,
  external_supplier_id uuid,
  external_supplier_name text,
  external_supplier_unit_cost_usd numeric,
  external_supplier_min_qty numeric,
  external_supplier_lead_time_days int,
  external_supplier_notes text,
  replacement_product_id uuid REFERENCES public.core_products(id) ON DELETE SET NULL,
  replacement_woo_product_id bigint,
  replacement_behavior text NOT NULL DEFAULT 'suggest_only' CHECK (replacement_behavior IN ('suggest_only','use_on_restock_with_confirmation','block_and_suggest','ignore')),
  decision_reason text,
  last_reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT crp_has_reference CHECK (woo_product_id IS NOT NULL OR core_product_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crp_woo ON public.core_replenishment_policies(woo_product_id) WHERE woo_product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_crp_core ON public.core_replenishment_policies(core_product_id) WHERE core_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crp_lifecycle ON public.core_replenishment_policies(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_crp_route ON public.core_replenishment_policies(replenishment_route);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_replenishment_policies TO authenticated;
GRANT ALL ON public.core_replenishment_policies TO service_role;
ALTER TABLE public.core_replenishment_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crp read authenticated"
  ON public.core_replenishment_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "crp insert admin/manager"
  ON public.core_replenishment_policies FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "crp update admin/manager"
  ON public.core_replenishment_policies FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "crp delete admin"
  ON public.core_replenishment_policies FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER crp_set_updated_at BEFORE UPDATE ON public.core_replenishment_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- core_product_strategy_decisions (audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.core_product_strategy_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_product_id bigint,
  core_product_id uuid REFERENCES public.core_products(id) ON DELETE SET NULL,
  policy_id uuid REFERENCES public.core_replenishment_policies(id) ON DELETE SET NULL,
  decision_type text NOT NULL,
  previous_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_cpsd_woo ON public.core_product_strategy_decisions(woo_product_id);
CREATE INDEX IF NOT EXISTS idx_cpsd_core ON public.core_product_strategy_decisions(core_product_id);
CREATE INDEX IF NOT EXISTS idx_cpsd_policy ON public.core_product_strategy_decisions(policy_id);
CREATE INDEX IF NOT EXISTS idx_cpsd_created ON public.core_product_strategy_decisions(created_at DESC);

GRANT SELECT, INSERT ON public.core_product_strategy_decisions TO authenticated;
GRANT ALL ON public.core_product_strategy_decisions TO service_role;
ALTER TABLE public.core_product_strategy_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpsd read authenticated"
  ON public.core_product_strategy_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpsd insert admin/manager"
  ON public.core_product_strategy_decisions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

-- ============================================================
-- core_products: mirror-only compatibility fields
-- ============================================================
ALTER TABLE public.core_products
  ADD COLUMN IF NOT EXISTS manual_unit_cost_usd numeric,
  ADD COLUMN IF NOT EXISTS manual_cost_reason text,
  ADD COLUMN IF NOT EXISTS replenishment_policy_id uuid REFERENCES public.core_replenishment_policies(id) ON DELETE SET NULL;
