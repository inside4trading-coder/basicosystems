CREATE OR REPLACE FUNCTION public.core_apply_replacement_event(
  p_event_id uuid,
  p_allocations jsonb,
  p_confirmed_quantity numeric DEFAULT NULL,
  p_adjustment_reason text DEFAULT NULL,
  p_dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_event record;
  v_policy public.core_replenishment_policies%ROWTYPE;
  v_behavior text;
  v_replacement_product_id uuid;
  v_replacement_woo_product_id bigint;
  v_replacement_has_variants boolean := false;
  v_suggested numeric;
  v_confirmed numeric;
  v_alloc jsonb;
  v_alloc_arr jsonb := '[]'::jsonb;
  v_sum numeric := 0;
  v_seen jsonb := '{}'::jsonb;
  v_canon_key text;
  v_core_variant_id uuid;
  v_woo_variation_id bigint;
  v_route jsonb;
  v_route_arr jsonb := '[]'::jsonb;
  v_route_summary jsonb := jsonb_build_object(
    'internal_factory', 0,
    'external_supplier_review', 0,
    'manual_cost_review', 0
  );
  v_final_action text;
  v_distinct_actions int := 0;
  v_estimated_total numeric := 0;
  v_created_needs uuid[] := ARRAY[]::uuid[];
  v_created_events uuid[] := ARRAY[]::uuid[];
  v_need_id uuid;
  v_evt_id uuid;
  v_unit_cost numeric;
  v_line_qty numeric;
  v_line_action text;
  v_cost_source text;
  v_cycle_hit boolean;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','unauthenticated');
  END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'manager')) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) = 0 THEN
    RETURN jsonb_build_object('error','allocations_required');
  END IF;

  SELECT * INTO v_event FROM public.core_replenishment_policy_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','event_not_found');
  END IF;

  IF v_event.status = 'resolved' AND v_event.resolution_data ? 'applied_at' THEN
    RETURN v_event.resolution_data || jsonb_build_object('already_applied', true);
  END IF;

  IF v_event.action <> 'suggest_replacement' THEN
    RETURN jsonb_build_object('error','not_a_replacement_event','action',v_event.action);
  END IF;
  IF v_event.status NOT IN ('open','reviewed') THEN
    RETURN jsonb_build_object('error','event_not_actionable','status',v_event.status);
  END IF;

  IF v_event.policy_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.core_replenishment_policies WHERE id = v_event.policy_id;
  END IF;
  IF v_policy.id IS NULL AND v_event.core_product_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.core_replenishment_policies
    WHERE core_product_id = v_event.core_product_id ORDER BY updated_at DESC LIMIT 1;
  END IF;
  IF v_policy.id IS NULL AND v_event.woo_product_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.core_replenishment_policies
    WHERE woo_product_id = v_event.woo_product_id ORDER BY updated_at DESC LIMIT 1;
  END IF;

  v_behavior := COALESCE(v_policy.replacement_behavior, v_event.replacement_behavior, NULL);
  IF v_behavior IS NULL OR v_behavior IN ('suggest_only') THEN
    RETURN jsonb_build_object('error','behavior_suggest_only','replacement_behavior',v_behavior);
  END IF;
  IF v_behavior = 'ignore' THEN
    RETURN jsonb_build_object('error','behavior_ignore');
  END IF;
  IF v_behavior NOT IN ('use_on_restock_with_confirmation','block_and_suggest') THEN
    RETURN jsonb_build_object('error','behavior_not_applicable','replacement_behavior',v_behavior);
  END IF;

  v_replacement_product_id := COALESCE(v_policy.replacement_product_id, v_event.replacement_product_id);
  v_replacement_woo_product_id := COALESCE(v_policy.replacement_woo_product_id, v_event.replacement_woo_product_id);

  IF v_replacement_product_id IS NULL AND v_replacement_woo_product_id IS NOT NULL THEN
    SELECT cp.id INTO v_replacement_product_id FROM public.core_products cp
    WHERE cp.woo_product_id = v_replacement_woo_product_id LIMIT 1;
  END IF;
  IF v_replacement_product_id IS NULL AND v_replacement_woo_product_id IS NULL THEN
    RETURN jsonb_build_object('error','replacement_not_defined');
  END IF;
  IF v_replacement_product_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.core_product_variants WHERE core_product_id = v_replacement_product_id)
      INTO v_replacement_has_variants;
    IF v_replacement_woo_product_id IS NULL THEN
      SELECT woo_product_id INTO v_replacement_woo_product_id FROM public.core_products WHERE id = v_replacement_product_id;
    END IF;
  END IF;

  WITH RECURSIVE chain AS (
    SELECT v_replacement_product_id AS pid, 1 AS depth, ARRAY[v_replacement_product_id] AS path
    UNION ALL
    SELECT p.replacement_product_id, c.depth + 1, c.path || p.replacement_product_id
    FROM chain c
    JOIN public.core_replenishment_policies p ON p.core_product_id = c.pid
    WHERE c.depth < 20
      AND p.replacement_product_id IS NOT NULL
      AND NOT (p.replacement_product_id = ANY(c.path))
  )
  SELECT EXISTS(
    SELECT 1 FROM chain
    WHERE pid = v_event.core_product_id
       OR (array_length(path,1) > 1 AND path[array_length(path,1)] = ANY(path[1:array_length(path,1)-1]))
  ) INTO v_cycle_hit;
  IF v_cycle_hit THEN
    RETURN jsonb_build_object('error','replacement_cycle');
  END IF;

  v_suggested := COALESCE(v_event.quantity, 0);
  v_confirmed := COALESCE(p_confirmed_quantity, v_suggested);
  IF v_confirmed IS NULL OR v_confirmed <= 0 THEN
    RETURN jsonb_build_object('error','invalid_confirmed_quantity');
  END IF;
  IF v_confirmed <> v_suggested AND (p_adjustment_reason IS NULL OR btrim(p_adjustment_reason) = '') THEN
    RETURN jsonb_build_object('error','adjustment_reason_required');
  END IF;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_core_variant_id := NULLIF(v_alloc->>'core_variant_id','')::uuid;
    v_woo_variation_id := NULLIF(v_alloc->>'woo_variation_id','')::bigint;
    v_line_qty := COALESCE((v_alloc->>'quantity')::numeric, 0);
    IF v_line_qty <= 0 THEN
      RETURN jsonb_build_object('error','allocation_invalid_quantity');
    END IF;
    IF v_core_variant_id IS NOT NULL AND v_woo_variation_id IS NULL THEN
      SELECT woo_variation_id INTO v_woo_variation_id FROM public.core_product_variants WHERE id = v_core_variant_id;
    ELSIF v_woo_variation_id IS NOT NULL AND v_core_variant_id IS NULL THEN
      SELECT cpv.id INTO v_core_variant_id FROM public.core_product_variants cpv
      WHERE cpv.woo_variation_id = v_woo_variation_id LIMIT 1;
      IF v_core_variant_id IS NULL THEN
        SELECT wvm.core_variant_id INTO v_core_variant_id FROM public.core_woo_variant_map wvm
        WHERE wvm.woo_variation_id = v_woo_variation_id LIMIT 1;
      END IF;
    END IF;
    IF v_core_variant_id IS NOT NULL AND v_replacement_product_id IS NOT NULL THEN
      IF NOT EXISTS(SELECT 1 FROM public.core_product_variants WHERE id = v_core_variant_id AND core_product_id = v_replacement_product_id) THEN
        RETURN jsonb_build_object('error','allocation_variant_not_in_replacement','core_variant_id',v_core_variant_id);
      END IF;
    END IF;
    IF v_core_variant_id IS NOT NULL AND v_event.core_variant_id IS NOT NULL AND v_core_variant_id = v_event.core_variant_id THEN
      RETURN jsonb_build_object('error','allocation_points_to_original');
    END IF;
    IF v_core_variant_id IS NOT NULL THEN
      v_canon_key := 'core:' || v_core_variant_id::text;
    ELSIF v_woo_variation_id IS NOT NULL THEN
      v_canon_key := 'woo:' || v_woo_variation_id::text;
    ELSE
      v_canon_key := 'product:no_variant';
    END IF;
    IF v_seen ? v_canon_key THEN
      RETURN jsonb_build_object('error','allocation_duplicate','canonical_key',v_canon_key);
    END IF;
    v_seen := v_seen || jsonb_build_object(v_canon_key, true);
    v_sum := v_sum + v_line_qty;
    v_alloc_arr := v_alloc_arr || jsonb_build_array(jsonb_build_object(
      'core_variant_id', v_core_variant_id,
      'woo_variation_id', v_woo_variation_id,
      'canonical_key', v_canon_key,
      'quantity', v_line_qty,
      'notes', v_alloc->>'notes'
    ));
  END LOOP;

  IF v_sum <> v_confirmed THEN
    RETURN jsonb_build_object('error','allocations_sum_mismatch','sum',v_sum,'confirmed',v_confirmed);
  END IF;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_alloc_arr)
  LOOP
    v_core_variant_id := NULLIF(v_alloc->>'core_variant_id','')::uuid;
    v_woo_variation_id := NULLIF(v_alloc->>'woo_variation_id','')::bigint;
    v_line_qty := (v_alloc->>'quantity')::numeric;
    BEGIN
      SELECT unit_cost, cost_source INTO v_unit_cost, v_cost_source
      FROM public.resolve_core_operational_unit_cost(
        v_replacement_product_id, v_core_variant_id,
        v_replacement_woo_product_id, v_woo_variation_id
      ) LIMIT 1;
    EXCEPTION WHEN undefined_function OR undefined_column THEN
      v_unit_cost := NULL; v_cost_source := NULL;
    END;

    v_route := public.route_core_replenishment_candidate(
      p_source_type := 'replacement_policy_event',
      p_source_key := p_event_id::text || ':' || (v_alloc->>'canonical_key'),
      p_source_id := p_event_id,
      p_core_product_id := v_replacement_product_id,
      p_core_variant_id := v_core_variant_id,
      p_woo_product_id := v_replacement_woo_product_id,
      p_woo_variation_id := v_woo_variation_id,
      p_woo_order_id := v_event.woo_order_id,
      p_woo_order_item_id := v_event.woo_order_item_id,
      p_quantity := v_line_qty,
      p_unit_cost := v_unit_cost,
      p_amount := CASE WHEN v_unit_cost IS NOT NULL THEN v_unit_cost * v_line_qty ELSE NULL END,
      p_cost_source := v_cost_source,
      p_created_by := v_uid,
      p_dry_run := true
    );

    v_line_action := v_route->>'route_action';

    IF v_line_action IN ('block_no_restock','block_exit','block_ignored','suggest_replacement') THEN
      RETURN jsonb_build_object(
        'error','replacement_blocked',
        'blocked_action', v_line_action,
        'canonical_key', v_alloc->>'canonical_key',
        'message', v_route->>'message'
      );
    END IF;

    IF v_line_action = 'allow_internal_factory' THEN
      v_line_action := 'internal_factory';
      IF v_replacement_product_id IS NULL THEN
        RETURN jsonb_build_object('error','replacement_not_mapped','message','El reemplazo debe estar conectado a Core para entrar a fabricación interna.');
      END IF;
      IF v_replacement_has_variants AND v_core_variant_id IS NULL THEN
        RETURN jsonb_build_object('error','replacement_not_mapped','message','El reemplazo debe estar conectado a Core para entrar a fabricación interna.','canonical_key',v_alloc->>'canonical_key');
      END IF;
    ELSIF v_line_action = 'external_supplier_review' THEN
      NULL;
    ELSIF v_line_action = 'manual_cost_review' THEN
      NULL;
    ELSE
      RETURN jsonb_build_object('error','unexpected_route_action','action',v_line_action);
    END IF;

    v_estimated_total := v_estimated_total + COALESCE(v_unit_cost,0) * v_line_qty;
    v_route_summary := jsonb_set(
      v_route_summary,
      ARRAY[v_line_action],
      to_jsonb( COALESCE((v_route_summary->>v_line_action)::numeric,0) + v_line_qty )
    );

    v_route_arr := v_route_arr || jsonb_build_array(jsonb_build_object(
      'canonical_key', v_alloc->>'canonical_key',
      'core_variant_id', v_core_variant_id,
      'woo_variation_id', v_woo_variation_id,
      'quantity', v_line_qty,
      'route_action', v_line_action,
      'unit_cost', v_unit_cost,
      'cost_source', v_cost_source,
      'subtotal', COALESCE(v_unit_cost,0) * v_line_qty
    ));
  END LOOP;

  SELECT count(DISTINCT k) INTO v_distinct_actions
  FROM jsonb_each(v_route_summary) AS t(k,v)
  WHERE (v)::text::numeric > 0;

  IF v_distinct_actions <= 1 THEN
    SELECT k INTO v_final_action
    FROM jsonb_each(v_route_summary) AS t(k,v)
    WHERE (v)::text::numeric > 0 LIMIT 1;
    v_final_action := COALESCE(v_final_action, 'internal_factory');
  ELSE
    v_final_action := 'mixed';
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'already_applied', false,
      'original_event_id', p_event_id,
      'original_product_id', v_event.core_product_id,
      'original_variant_id', v_event.core_variant_id,
      'original_suggested_quantity', v_suggested,
      'confirmed_quantity', v_confirmed,
      'adjustment_reason', p_adjustment_reason,
      'replacement_product_id', v_replacement_product_id,
      'replacement_woo_product_id', v_replacement_woo_product_id,
      'replacement_has_variants', v_replacement_has_variants,
      'allocations', v_route_arr,
      'route_summary', v_route_summary,
      'final_route_action', v_final_action,
      'estimated_total', v_estimated_total
    );
  END IF;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_route_arr)
  LOOP
    v_core_variant_id := NULLIF(v_alloc->>'core_variant_id','')::uuid;
    v_woo_variation_id := NULLIF(v_alloc->>'woo_variation_id','')::bigint;
    v_line_qty := (v_alloc->>'quantity')::numeric;
    v_line_action := v_alloc->>'route_action';
    v_unit_cost := NULLIF(v_alloc->>'unit_cost','')::numeric;
    v_cost_source := v_alloc->>'cost_source';

    IF v_line_action = 'internal_factory' THEN
      SELECT id INTO v_need_id FROM public.core_production_needs
      WHERE core_product_id = v_replacement_product_id
        AND core_variant_id IS NOT DISTINCT FROM v_core_variant_id
        AND source = 'replacement_policy_event:' || p_event_id::text
      LIMIT 1;

      IF v_need_id IS NULL THEN
        INSERT INTO public.core_production_needs(
          need_type, status, priority,
          core_product_id, core_variant_id,
          quantity_needed, quantity_pending,
          source, reason, notes, created_by
        ) VALUES (
          'restock', 'pending', 'media',
          v_replacement_product_id, v_core_variant_id,
          v_line_qty, v_line_qty,
          'replacement_policy_event:' || p_event_id::text,
          'Reemplazo confirmado desde evento de política',
          COALESCE(p_adjustment_reason, NULL),
          v_uid
        ) RETURNING id INTO v_need_id;
      ELSE
        UPDATE public.core_production_needs
           SET quantity_needed = v_line_qty,
               quantity_pending = GREATEST(v_line_qty - COALESCE(quantity_converted_to_order,0), 0),
               updated_at = now(),
               updated_by = v_uid
         WHERE id = v_need_id;
      END IF;
      v_created_needs := v_created_needs || v_need_id;

    ELSE
      v_route := public.route_core_replenishment_candidate(
        p_source_type := 'replacement_policy_event',
        p_source_key := p_event_id::text || ':' || (v_alloc->>'canonical_key'),
        p_source_id := p_event_id,
        p_core_product_id := v_replacement_product_id,
        p_core_variant_id := v_core_variant_id,
        p_woo_product_id := v_replacement_woo_product_id,
        p_woo_variation_id := v_woo_variation_id,
        p_woo_order_id := v_event.woo_order_id,
        p_woo_order_item_id := v_event.woo_order_item_id,
        p_quantity := v_line_qty,
        p_unit_cost := v_unit_cost,
        p_amount := CASE WHEN v_unit_cost IS NOT NULL THEN v_unit_cost * v_line_qty ELSE NULL END,
        p_cost_source := v_cost_source,
        p_created_by := v_uid,
        p_dry_run := false
      );
      v_evt_id := NULLIF(v_route->>'event_id','')::uuid;
      IF v_evt_id IS NOT NULL THEN
        v_created_events := v_created_events || v_evt_id;
      END IF;
    END IF;
  END LOOP;

  v_result := jsonb_build_object(
    'dry_run', false,
    'already_applied', false,
    'applied_at', now(),
    'applied_by', v_uid,
    'original_event_id', p_event_id,
    'original_product_id', v_event.core_product_id,
    'original_variant_id', v_event.core_variant_id,
    'original_suggested_quantity', v_suggested,
    'confirmed_quantity', v_confirmed,
    'adjustment_reason', p_adjustment_reason,
    'replacement_product_id', v_replacement_product_id,
    'replacement_woo_product_id', v_replacement_woo_product_id,
    'allocations', v_route_arr,
    'route_summary', v_route_summary,
    'final_route_action', v_final_action,
    'estimated_total', v_estimated_total,
    'created_need_ids', to_jsonb(v_created_needs),
    'created_policy_event_ids', to_jsonb(v_created_events)
  );

  UPDATE public.core_replenishment_policy_events
     SET status = 'resolved',
         resolved_at = now(),
         resolved_by = v_uid,
         resolution_notes = 'Reemplazo aplicado: ' || v_final_action,
         resolution_data = v_result
   WHERE id = p_event_id;

  BEGIN
    INSERT INTO public.core_audit_logs(table_name, record_id, action, new_value, performed_by)
    VALUES ('core_replenishment_policy_events', p_event_id, 'replacement_applied', v_result::text, v_uid::text);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.core_apply_replacement_event(uuid, jsonb, numeric, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.core_apply_replacement_event(uuid, jsonb, numeric, text, boolean) TO authenticated, service_role;