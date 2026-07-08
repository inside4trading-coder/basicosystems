
-- 1) Events table
CREATE TABLE IF NOT EXISTS public.core_replenishment_policy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id uuid,
  woo_order_id bigint,
  woo_order_item_id bigint,
  core_product_id uuid,
  core_variant_id uuid,
  woo_product_id bigint,
  woo_variation_id bigint,
  policy_id uuid,
  action text NOT NULL,
  severity text NOT NULL,
  message text,
  warning text,
  quantity numeric,
  unit_cost numeric,
  amount numeric,
  cost_source text,
  replacement_product_id uuid,
  replacement_woo_product_id bigint,
  replacement_behavior text,
  external_supplier_name text,
  external_supplier_unit_cost_usd numeric,
  status text NOT NULL DEFAULT 'open',
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_replenishment_policy_events TO authenticated;
GRANT ALL ON public.core_replenishment_policy_events TO service_role;

ALTER TABLE public.core_replenishment_policy_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_events_admin_manager_all" ON public.core_replenishment_policy_events;
CREATE POLICY "policy_events_admin_manager_all"
ON public.core_replenishment_policy_events
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_policy_events_status ON public.core_replenishment_policy_events(status);
CREATE INDEX IF NOT EXISTS idx_policy_events_action ON public.core_replenishment_policy_events(action);
CREATE INDEX IF NOT EXISTS idx_policy_events_core_product ON public.core_replenishment_policy_events(core_product_id);
CREATE INDEX IF NOT EXISTS idx_policy_events_woo_product ON public.core_replenishment_policy_events(woo_product_id);
CREATE INDEX IF NOT EXISTS idx_policy_events_created_at ON public.core_replenishment_policy_events(created_at DESC);

-- 2) RPC: resolve_core_replenishment_action
CREATE OR REPLACE FUNCTION public.resolve_core_replenishment_action(
  p_core_product_id uuid DEFAULT NULL,
  p_core_variant_id uuid DEFAULT NULL,
  p_woo_product_id bigint DEFAULT NULL,
  p_woo_variation_id bigint DEFAULT NULL
)
RETURNS TABLE(
  action text,
  severity text,
  policy_id uuid,
  core_product_id uuid,
  core_variant_id uuid,
  woo_product_id bigint,
  woo_variation_id bigint,
  brand_role text,
  lifecycle_status text,
  replenishment_route text,
  restock_enabled boolean,
  replacement_product_id uuid,
  replacement_woo_product_id bigint,
  replacement_behavior text,
  external_supplier_name text,
  external_supplier_unit_cost_usd numeric,
  message text,
  warning text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_core_product_id uuid := p_core_product_id;
  v_core_variant_id uuid := p_core_variant_id;
  v_woo_product_id bigint := p_woo_product_id;
  v_woo_variation_id bigint := p_woo_variation_id;
  v_policy record;
  v_action text;
  v_severity text;
  v_message text;
  v_warning text;
  v_lifecycle text;
  v_route text;
BEGIN
  -- Resolve identity (same as resolve_core_operational_unit_cost)
  IF v_core_variant_id IS NULL AND v_woo_variation_id IS NOT NULL THEN
    SELECT core_variant_id INTO v_core_variant_id
      FROM public.core_woo_variant_map
     WHERE woo_variation_id = v_woo_variation_id AND core_variant_id IS NOT NULL
     LIMIT 1;
    IF v_core_variant_id IS NULL THEN
      SELECT id INTO v_core_variant_id
        FROM public.core_product_variants
       WHERE woo_variation_id = v_woo_variation_id
       LIMIT 1;
    END IF;
  END IF;

  IF v_core_product_id IS NULL AND v_core_variant_id IS NOT NULL THEN
    SELECT core_product_id INTO v_core_product_id
      FROM public.core_product_variants WHERE id = v_core_variant_id LIMIT 1;
  END IF;

  IF v_core_product_id IS NULL AND v_woo_product_id IS NOT NULL THEN
    SELECT core_product_id INTO v_core_product_id
      FROM public.core_woo_product_map
     WHERE woo_product_id = v_woo_product_id AND core_product_id IS NOT NULL
     LIMIT 1;
    IF v_core_product_id IS NULL THEN
      SELECT id INTO v_core_product_id
        FROM public.core_products WHERE woo_product_id = v_woo_product_id LIMIT 1;
    END IF;
  END IF;

  IF v_core_product_id IS NOT NULL AND v_woo_product_id IS NULL THEN
    SELECT woo_product_id INTO v_woo_product_id FROM public.core_products WHERE id = v_core_product_id;
  END IF;
  IF v_core_variant_id IS NOT NULL AND v_woo_variation_id IS NULL THEN
    SELECT woo_variation_id INTO v_woo_variation_id FROM public.core_product_variants WHERE id = v_core_variant_id;
  END IF;

  -- Load policy
  IF v_core_product_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.core_replenishment_policies WHERE core_product_id = v_core_product_id LIMIT 1;
  END IF;
  IF v_policy.id IS NULL AND v_woo_product_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.core_replenishment_policies WHERE woo_product_id = v_woo_product_id LIMIT 1;
  END IF;

  -- No policy → legacy allow
  IF v_policy.id IS NULL THEN
    RETURN QUERY SELECT
      'allow_internal_factory'::text, 'allow'::text,
      NULL::uuid, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id,
      NULL::text, NULL::text, NULL::text, NULL::boolean,
      NULL::uuid, NULL::bigint, NULL::text, NULL::text, NULL::numeric,
      NULL::text,
      'Producto sin política definida. Se usa comportamiento legacy/internal_factory.'::text;
    RETURN;
  END IF;

  v_lifecycle := COALESCE(v_policy.lifecycle_status, 'active');
  v_route := COALESCE(v_policy.replenishment_route, 'internal_factory');

  -- Priority: lifecycle blocks first, then route
  IF v_lifecycle = 'ignored' THEN
    v_action := 'block_ignored'; v_severity := 'block';
    v_message := 'Producto ignorado por política de Core.';
  ELSIF v_lifecycle = 'no_restock' THEN
    v_action := 'block_no_restock'; v_severity := 'block';
    v_message := 'Producto marcado como no restock. No debe reponerse.';
  ELSIF v_lifecycle = 'exit' THEN
    IF v_policy.replacement_product_id IS NOT NULL OR v_policy.replacement_woo_product_id IS NOT NULL THEN
      v_action := 'suggest_replacement'; v_severity := 'review';
      v_message := 'Producto en salida con reemplazo sugerido.';
    ELSE
      v_action := 'block_exit'; v_severity := 'block';
      v_message := 'Producto en salida. No debe fabricarse ni reponerse.';
    END IF;
  ELSIF v_lifecycle = 'replaced' OR v_policy.replacement_product_id IS NOT NULL OR v_policy.replacement_woo_product_id IS NOT NULL THEN
    -- replacement behavior can be suggest_only / use_on_restock_with_confirmation / block_and_suggest / ignore
    IF COALESCE(v_policy.replacement_behavior,'suggest_only') = 'ignore' THEN
      v_action := 'allow_internal_factory'; v_severity := 'allow';
    ELSIF v_lifecycle = 'replaced' OR COALESCE(v_policy.replacement_behavior,'') = 'block_and_suggest' THEN
      v_action := 'suggest_replacement'; v_severity := 'block';
      v_message := 'Producto reemplazado. Revisar producto sustituto.';
    ELSE
      v_action := 'suggest_replacement'; v_severity := 'review';
      v_message := 'Producto con reemplazo sugerido.';
    END IF;
  ELSIF v_route = 'external_supplier' THEN
    v_action := 'external_supplier_review'; v_severity := 'review';
    v_message := 'Producto marcado como proveedor externo. No se fabrica internamente.';
  ELSIF v_route = 'manual_cost_only' THEN
    v_action := 'manual_cost_review'; v_severity := 'review';
    v_message := 'Producto con costo manual únicamente. Tiene monto de referencia, pero no estructura de fabricación.';
  ELSIF v_route IN ('no_restock','none','ignored') THEN
    v_action := 'block_no_restock'; v_severity := 'block';
    v_message := 'Ruta de reposición bloqueada.';
  ELSE
    -- internal_factory (default)
    IF COALESCE(v_policy.restock_enabled, true) = false THEN
      v_action := 'block_no_restock'; v_severity := 'block';
      v_message := 'restock_enabled=false en política.';
    ELSE
      v_action := 'allow_internal_factory'; v_severity := 'allow';
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_action, v_severity,
    v_policy.id, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id,
    v_policy.brand_role, v_lifecycle, v_route, v_policy.restock_enabled,
    v_policy.replacement_product_id, v_policy.replacement_woo_product_id, v_policy.replacement_behavior,
    v_policy.external_supplier_name, v_policy.external_supplier_unit_cost_usd,
    v_message, v_warning;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_core_replenishment_action(uuid, uuid, bigint, bigint) TO authenticated, service_role;
