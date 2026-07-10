
-- 1. Add dedupe_key column and permanent unique index
ALTER TABLE public.core_replenishment_policy_events
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Backfill existing rows with a unique fallback so unique index can be created
UPDATE public.core_replenishment_policy_events
SET dedupe_key = 'legacy:' || id::text
WHERE dedupe_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS core_replenishment_policy_events_dedupe_key_uidx
  ON public.core_replenishment_policy_events(dedupe_key);

-- 2. Central routing engine
CREATE OR REPLACE FUNCTION public.route_core_replenishment_candidate(
  p_source_type text,
  p_source_key text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL,
  p_core_product_id uuid DEFAULT NULL,
  p_core_variant_id uuid DEFAULT NULL,
  p_woo_product_id bigint DEFAULT NULL,
  p_woo_variation_id bigint DEFAULT NULL,
  p_woo_order_id bigint DEFAULT NULL,
  p_woo_order_item_id bigint DEFAULT NULL,
  p_quantity numeric DEFAULT NULL,
  p_unit_cost numeric DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_cost_source text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_action text;
  v_severity text;
  v_allow boolean;
  v_dedupe text;
  v_event_id uuid;
  v_source_key text;
BEGIN
  -- Resolve policy action using existing resolver (single source of truth)
  SELECT * INTO v_row
  FROM public.resolve_core_replenishment_action(
    p_core_product_id,
    p_core_variant_id,
    p_woo_product_id,
    p_woo_variation_id
  )
  LIMIT 1;

  v_action := COALESCE(v_row.action, 'allow_internal_factory');
  v_severity := COALESCE(v_row.severity, 'allow');
  v_allow := v_action = 'allow_internal_factory';

  -- Build dedupe_key
  v_source_key := COALESCE(p_source_key, p_source_id::text, 'null');
  v_dedupe := p_source_type
    || ':' || v_source_key
    || ':' || COALESCE(p_core_product_id::text, '-')
    || ':' || COALESCE(p_core_variant_id::text, '-')
    || ':' || v_action;

  -- If routed to allow_internal_factory: no event, just return decision.
  -- Dry run: never write anything.
  IF v_allow OR p_dry_run THEN
    RETURN jsonb_build_object(
      'route_action', v_action,
      'severity', v_severity,
      'allow_internal_need', v_allow,
      'policy_id', v_row.policy_id,
      'replacement_product_id', v_row.replacement_product_id,
      'replacement_woo_product_id', v_row.replacement_woo_product_id,
      'replacement_behavior', v_row.replacement_behavior,
      'external_supplier_name', v_row.external_supplier_name,
      'external_supplier_unit_cost_usd', v_row.external_supplier_unit_cost_usd,
      'message', v_row.message,
      'warning', v_row.warning,
      'event_id', NULL,
      'dedupe_key', v_dedupe,
      'dry_run', p_dry_run
    );
  END IF;

  -- Idempotent upsert: never accumulate quantities, never revive resolved/ignored.
  INSERT INTO public.core_replenishment_policy_events (
    source_type, source_id, woo_order_id, woo_order_item_id,
    core_product_id, core_variant_id, woo_product_id, woo_variation_id,
    policy_id, action, severity, message, warning,
    quantity, unit_cost, amount, cost_source,
    replacement_product_id, replacement_woo_product_id, replacement_behavior,
    external_supplier_name, external_supplier_unit_cost_usd,
    status, created_by, dedupe_key
  ) VALUES (
    p_source_type, p_source_id, p_woo_order_id, p_woo_order_item_id,
    p_core_product_id, p_core_variant_id, p_woo_product_id, p_woo_variation_id,
    v_row.policy_id, v_action, v_severity, v_row.message, v_row.warning,
    p_quantity, p_unit_cost, p_amount, p_cost_source,
    v_row.replacement_product_id, v_row.replacement_woo_product_id, v_row.replacement_behavior,
    v_row.external_supplier_name, v_row.external_supplier_unit_cost_usd,
    'open', p_created_by, v_dedupe
  )
  ON CONFLICT (dedupe_key) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    unit_cost = EXCLUDED.unit_cost,
    amount = EXCLUDED.amount,
    cost_source = EXCLUDED.cost_source,
    message = EXCLUDED.message,
    warning = EXCLUDED.warning,
    policy_id = EXCLUDED.policy_id,
    severity = EXCLUDED.severity,
    replacement_product_id = EXCLUDED.replacement_product_id,
    replacement_woo_product_id = EXCLUDED.replacement_woo_product_id,
    replacement_behavior = EXCLUDED.replacement_behavior,
    external_supplier_name = EXCLUDED.external_supplier_name,
    external_supplier_unit_cost_usd = EXCLUDED.external_supplier_unit_cost_usd,
    woo_order_id = EXCLUDED.woo_order_id,
    woo_order_item_id = EXCLUDED.woo_order_item_id,
    source_id = EXCLUDED.source_id
    -- deliberately DO NOT touch: status, resolved_at, resolved_by, resolution_notes, created_at, created_by
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'route_action', v_action,
    'severity', v_severity,
    'allow_internal_need', false,
    'policy_id', v_row.policy_id,
    'replacement_product_id', v_row.replacement_product_id,
    'replacement_woo_product_id', v_row.replacement_woo_product_id,
    'replacement_behavior', v_row.replacement_behavior,
    'external_supplier_name', v_row.external_supplier_name,
    'external_supplier_unit_cost_usd', v_row.external_supplier_unit_cost_usd,
    'message', v_row.message,
    'warning', v_row.warning,
    'event_id', v_event_id,
    'dedupe_key', v_dedupe,
    'dry_run', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.route_core_replenishment_candidate(
  text, text, uuid, uuid, uuid, bigint, bigint, bigint, bigint,
  numeric, numeric, numeric, text, uuid, boolean
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.route_core_replenishment_candidate(
  text, text, uuid, uuid, uuid, bigint, bigint, bigint, bigint,
  numeric, numeric, numeric, text, uuid, boolean
) TO authenticated, service_role;
