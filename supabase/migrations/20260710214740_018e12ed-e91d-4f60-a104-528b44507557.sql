
-- 1) Ampliar CHECK de movement_type para reclasificaciones y ajustes de reemplazo
ALTER TABLE public.core_fabrication_fund_movements
  DROP CONSTRAINT IF EXISTS core_fabrication_fund_movements_movement_type_check;
ALTER TABLE public.core_fabrication_fund_movements
  ADD CONSTRAINT core_fabrication_fund_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY[
    'sale_generated','sale_generated_non_restockable','manual_increase','manual_decrease',
    'transfer','reversal','close','correction',
    'replacement_cost_adjustment','replacement_reclassification_out','replacement_reclassification_in'
  ]));

-- 2) Reescribir core_apply_replacement_event con conciliación financiera atómica
CREATE OR REPLACE FUNCTION public.core_apply_replacement_event(
  p_event_id uuid,
  p_allocations jsonb,
  p_confirmed_quantity numeric DEFAULT NULL::numeric,
  p_adjustment_reason text DEFAULT NULL::text,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_route_summary jsonb := jsonb_build_object('internal_factory',0,'external_supplier_review',0,'manual_cost_review',0);
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
  v_prod_sku text;
  v_prod_name text;
  v_var_sku text;
  v_var_label text;
  v_var_size text;

  -- Conciliación financiera
  v_orig_mov public.core_fabrication_fund_movements%ROWTYPE;
  v_orig_amount numeric := 0;
  v_orig_bucket text;
  v_orig_fund_id uuid;
  v_orig_currency text := 'USD';
  v_dest_bucket text;
  v_dest_totals jsonb := '{}'::jsonb;   -- { bucket: total_cost }
  v_dest_total numeric := 0;
  v_bkey text;
  v_bval numeric;
  v_share numeric;
  v_diff numeric;
  v_target_fund_id uuid;
  v_target_fund_type text;
  v_mov_id uuid;
  v_projected_movs jsonb := '[]'::jsonb;
  v_posted_movs uuid[] := ARRAY[]::uuid[];
  v_fin_preview jsonb;
  v_fin_result jsonb;
  v_do_reconcile boolean := false;
  v_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','unauthenticated'); END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'manager')) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) = 0 THEN
    RETURN jsonb_build_object('error','allocations_required');
  END IF;

  SELECT * INTO v_event FROM public.core_replenishment_policy_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','event_not_found'); END IF;

  -- Idempotencia global + financiera
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
    SELECT * INTO v_policy FROM public.core_replenishment_policies WHERE core_product_id = v_event.core_product_id ORDER BY updated_at DESC LIMIT 1;
  END IF;
  IF v_policy.id IS NULL AND v_event.woo_product_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.core_replenishment_policies WHERE woo_product_id = v_event.woo_product_id ORDER BY updated_at DESC LIMIT 1;
  END IF;

  v_behavior := COALESCE(v_policy.replacement_behavior, v_event.replacement_behavior, NULL);
  IF v_behavior IS NULL OR v_behavior IN ('suggest_only') THEN
    RETURN jsonb_build_object('error','behavior_suggest_only','replacement_behavior',v_behavior);
  END IF;
  IF v_behavior = 'ignore' THEN RETURN jsonb_build_object('error','behavior_ignore'); END IF;
  IF v_behavior NOT IN ('use_on_restock_with_confirmation','block_and_suggest') THEN
    RETURN jsonb_build_object('error','behavior_not_applicable','replacement_behavior',v_behavior);
  END IF;

  v_replacement_product_id := COALESCE(v_policy.replacement_product_id, v_event.replacement_product_id);
  v_replacement_woo_product_id := COALESCE(v_policy.replacement_woo_product_id, v_event.replacement_woo_product_id);
  IF v_replacement_product_id IS NULL AND v_replacement_woo_product_id IS NOT NULL THEN
    SELECT cp.id INTO v_replacement_product_id FROM public.core_products cp WHERE cp.woo_product_id = v_replacement_woo_product_id LIMIT 1;
  END IF;
  IF v_replacement_product_id IS NULL AND v_replacement_woo_product_id IS NULL THEN
    RETURN jsonb_build_object('error','replacement_not_defined');
  END IF;
  IF v_replacement_product_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.core_product_variants WHERE core_product_id = v_replacement_product_id) INTO v_replacement_has_variants;
    IF v_replacement_woo_product_id IS NULL THEN
      SELECT woo_product_id INTO v_replacement_woo_product_id FROM public.core_products WHERE id = v_replacement_product_id;
    END IF;
  END IF;

  WITH RECURSIVE chain AS (
    SELECT v_replacement_product_id AS pid, 1 AS depth, ARRAY[v_replacement_product_id] AS path
    UNION ALL
    SELECT p.replacement_product_id, c.depth + 1, c.path || p.replacement_product_id
    FROM chain c JOIN public.core_replenishment_policies p ON p.core_product_id = c.pid
    WHERE c.depth < 20 AND p.replacement_product_id IS NOT NULL AND NOT (p.replacement_product_id = ANY(c.path))
  )
  SELECT EXISTS(
    SELECT 1 FROM chain
    WHERE pid = v_event.core_product_id
       OR (array_length(path,1) > 1 AND path[array_length(path,1)] = ANY(path[1:array_length(path,1)-1]))
  ) INTO v_cycle_hit;
  IF v_cycle_hit THEN RETURN jsonb_build_object('error','replacement_cycle'); END IF;

  v_suggested := COALESCE(v_event.quantity, 0);
  v_confirmed := COALESCE(p_confirmed_quantity, v_suggested);
  IF v_confirmed IS NULL OR v_confirmed <= 0 THEN RETURN jsonb_build_object('error','invalid_confirmed_quantity'); END IF;
  IF v_confirmed <> v_suggested AND (p_adjustment_reason IS NULL OR btrim(p_adjustment_reason) = '') THEN
    RETURN jsonb_build_object('error','adjustment_reason_required');
  END IF;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
    v_core_variant_id := NULLIF(v_alloc->>'core_variant_id','')::uuid;
    v_woo_variation_id := NULLIF(v_alloc->>'woo_variation_id','')::bigint;
    v_line_qty := COALESCE((v_alloc->>'quantity')::numeric, 0);
    IF v_line_qty <= 0 THEN RETURN jsonb_build_object('error','allocation_invalid_quantity'); END IF;
    IF v_core_variant_id IS NOT NULL AND v_woo_variation_id IS NULL THEN
      SELECT woo_variation_id INTO v_woo_variation_id FROM public.core_product_variants WHERE id = v_core_variant_id;
    ELSIF v_woo_variation_id IS NOT NULL AND v_core_variant_id IS NULL THEN
      SELECT cpv.id INTO v_core_variant_id FROM public.core_product_variants cpv WHERE cpv.woo_variation_id = v_woo_variation_id LIMIT 1;
      IF v_core_variant_id IS NULL THEN
        SELECT wvm.core_variant_id INTO v_core_variant_id FROM public.core_woo_variant_map wvm WHERE wvm.woo_variation_id = v_woo_variation_id LIMIT 1;
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
    IF v_core_variant_id IS NOT NULL THEN v_canon_key := 'core:' || v_core_variant_id::text;
    ELSIF v_woo_variation_id IS NOT NULL THEN v_canon_key := 'woo:' || v_woo_variation_id::text;
    ELSE v_canon_key := 'product:no_variant'; END IF;
    IF v_seen ? v_canon_key THEN RETURN jsonb_build_object('error','allocation_duplicate','canonical_key',v_canon_key); END IF;
    v_seen := v_seen || jsonb_build_object(v_canon_key, true);
    v_sum := v_sum + v_line_qty;
    v_alloc_arr := v_alloc_arr || jsonb_build_array(jsonb_build_object(
      'core_variant_id', v_core_variant_id, 'woo_variation_id', v_woo_variation_id,
      'canonical_key', v_canon_key, 'quantity', v_line_qty, 'notes', v_alloc->>'notes'
    ));
  END LOOP;

  IF v_sum <> v_confirmed THEN RETURN jsonb_build_object('error','allocations_sum_mismatch','sum',v_sum,'confirmed',v_confirmed); END IF;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_alloc_arr) LOOP
    v_core_variant_id := NULLIF(v_alloc->>'core_variant_id','')::uuid;
    v_woo_variation_id := NULLIF(v_alloc->>'woo_variation_id','')::bigint;
    v_line_qty := (v_alloc->>'quantity')::numeric;
    BEGIN
      SELECT unit_cost, cost_source INTO v_unit_cost, v_cost_source
      FROM public.resolve_core_operational_unit_cost(v_replacement_product_id, v_core_variant_id, v_replacement_woo_product_id, v_woo_variation_id) LIMIT 1;
    EXCEPTION WHEN undefined_function OR undefined_column THEN v_unit_cost := NULL; v_cost_source := NULL;
    END;

    v_route := public.route_core_replenishment_candidate(
      p_source_type := 'replacement_policy_event',
      p_source_key := (p_event_id::text || ':' || (v_alloc->>'canonical_key')),
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
      RETURN jsonb_build_object('error','replacement_blocked','blocked_action',v_line_action,'canonical_key',v_alloc->>'canonical_key','message',v_route->>'message');
    END IF;

    v_estimated_total := v_estimated_total + COALESCE(v_unit_cost,0) * v_line_qty;
    v_route_summary := jsonb_set(v_route_summary, ARRAY[v_line_action], to_jsonb( COALESCE((v_route_summary->>v_line_action)::numeric,0) + v_line_qty ));

    v_route_arr := v_route_arr || jsonb_build_array(jsonb_build_object(
      'canonical_key', v_alloc->>'canonical_key','core_variant_id', v_core_variant_id,'woo_variation_id', v_woo_variation_id,
      'quantity', v_line_qty,'route_action', v_line_action,'unit_cost', v_unit_cost,'cost_source', v_cost_source,
      'subtotal', COALESCE(v_unit_cost,0) * v_line_qty
    ));
  END LOOP;

  SELECT count(DISTINCT k) INTO v_distinct_actions FROM jsonb_each(v_route_summary) AS t(k,v) WHERE (v)::text::numeric > 0;
  IF v_distinct_actions <= 1 THEN
    SELECT k INTO v_final_action FROM jsonb_each(v_route_summary) AS t(k,v) WHERE (v)::text::numeric > 0 LIMIT 1;
    v_final_action := COALESCE(v_final_action, 'internal_factory');
  ELSE v_final_action := 'mixed'; END IF;

  -- === Conciliación financiera: preparación ===
  IF v_event.source_type = 'fabrication_fund_movement' AND v_event.source_id IS NOT NULL THEN
    SELECT * INTO v_orig_mov FROM public.core_fabrication_fund_movements WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error','original_movement_not_found','movement_id',v_event.source_id);
    END IF;
    v_orig_amount := COALESCE(v_orig_mov.amount, 0);
    v_orig_bucket := COALESCE(v_orig_mov.fund_bucket,
      CASE
        WHEN (SELECT fund_type FROM public.core_fabrication_funds WHERE id = v_orig_mov.fund_id) = 'general' THEN 'internal_factory'
        WHEN (SELECT fund_type FROM public.core_fabrication_funds WHERE id = v_orig_mov.fund_id) = 'external_supplier' THEN 'external_supplier'
        WHEN (SELECT fund_type FROM public.core_fabrication_funds WHERE id = v_orig_mov.fund_id) = 'pending' THEN 'pending_classification'
        ELSE 'pending_classification'
      END);
    v_orig_fund_id := v_orig_mov.fund_id;
    v_orig_currency := COALESCE(v_orig_mov.currency,'USD');
    v_do_reconcile := true;
  END IF;

  -- Totales destino por bucket
  v_dest_total := 0;
  v_dest_totals := '{}'::jsonb;
  FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_route_arr) LOOP
    v_line_action := v_alloc->>'route_action';
    v_dest_bucket := CASE v_line_action
      WHEN 'internal_factory' THEN 'internal_factory'
      WHEN 'external_supplier_review' THEN 'external_supplier'
      WHEN 'manual_cost_review' THEN 'pending_classification'
      ELSE 'pending_classification' END;
    v_bval := COALESCE((v_alloc->>'subtotal')::numeric, 0);
    v_dest_totals := jsonb_set(v_dest_totals, ARRAY[v_dest_bucket],
      to_jsonb( COALESCE((v_dest_totals->>v_dest_bucket)::numeric, 0) + v_bval ));
    v_dest_total := v_dest_total + v_bval;
  END LOOP;

  -- === Vista previa financiera (proyección de movimientos) ===
  v_projected_movs := '[]'::jsonb;
  IF v_do_reconcile THEN
    IF (SELECT count(*) FROM jsonb_object_keys(v_dest_totals)) = 1
       AND v_dest_totals ? v_orig_bucket THEN
      -- Mismo bucket → un solo ajuste
      v_diff := v_dest_total - v_orig_amount;
      IF v_diff <> 0 THEN
        v_projected_movs := v_projected_movs || jsonb_build_array(jsonb_build_object(
          'movement_type','replacement_cost_adjustment',
          'fund_bucket', v_orig_bucket, 'fund_id', v_orig_fund_id,
          'amount', v_diff, 'reason', 'Ajuste por reemplazo (mismo bucket)'
        ));
      END IF;
    ELSE
      -- Reclasificación proporcional
      v_projected_movs := v_projected_movs || jsonb_build_array(jsonb_build_object(
        'movement_type','replacement_reclassification_out',
        'fund_bucket', v_orig_bucket, 'fund_id', v_orig_fund_id,
        'amount', -v_orig_amount, 'reason', 'Salida por reclasificación de reemplazo'
      ));
      FOR v_bkey, v_bval IN SELECT k, (v)::text::numeric FROM jsonb_each(v_dest_totals) AS t(k,v) LOOP
        IF v_dest_total > 0 THEN
          v_share := round((v_bval / v_dest_total) * v_orig_amount, 4);
        ELSE
          v_share := round(v_orig_amount / (SELECT count(*) FROM jsonb_object_keys(v_dest_totals)), 4);
        END IF;
        -- Resolver fund_id destino
        v_target_fund_type := CASE v_bkey
          WHEN 'internal_factory' THEN 'general'
          WHEN 'external_supplier' THEN 'external_supplier'
          WHEN 'pending_classification' THEN 'pending'
          ELSE 'pending' END;
        SELECT id INTO v_target_fund_id FROM public.core_fabrication_funds
          WHERE fund_type = v_target_fund_type AND status='active' ORDER BY created_at LIMIT 1;
        IF v_target_fund_id IS NULL THEN
          RETURN jsonb_build_object('error','destination_fund_missing','fund_type',v_target_fund_type,'bucket',v_bkey);
        END IF;
        v_projected_movs := v_projected_movs || jsonb_build_array(jsonb_build_object(
          'movement_type','replacement_reclassification_in',
          'fund_bucket', v_bkey, 'fund_id', v_target_fund_id,
          'amount', v_share, 'reason', 'Entrada por reclasificación de reemplazo'
        ));
        v_diff := v_bval - v_share;
        IF v_diff <> 0 THEN
          v_projected_movs := v_projected_movs || jsonb_build_array(jsonb_build_object(
            'movement_type','replacement_cost_adjustment',
            'fund_bucket', v_bkey, 'fund_id', v_target_fund_id,
            'amount', v_diff, 'reason', 'Ajuste por diferencia de costo destino'
          ));
        END IF;
      END LOOP;
    END IF;
  END IF;

  v_fin_preview := jsonb_build_object(
    'reconcile', v_do_reconcile,
    'original_movement_id', v_orig_mov.id,
    'original_reserved_amount', v_orig_amount,
    'original_bucket', v_orig_bucket,
    'original_fund_id', v_orig_fund_id,
    'destination_total', v_dest_total,
    'target_totals_by_bucket', v_dest_totals,
    'net_difference', v_dest_total - v_orig_amount,
    'projected_movements', v_projected_movs
  );

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,'already_applied', false,'original_event_id', p_event_id,
      'original_product_id', v_event.core_product_id,'original_variant_id', v_event.core_variant_id,
      'original_suggested_quantity', v_suggested,'confirmed_quantity', v_confirmed,'adjustment_reason', p_adjustment_reason,
      'replacement_product_id', v_replacement_product_id,'replacement_woo_product_id', v_replacement_woo_product_id,
      'replacement_has_variants', v_replacement_has_variants,'allocations', v_route_arr,
      'route_summary', v_route_summary,'final_route_action', v_final_action,'estimated_total', v_estimated_total,
      'financial_preview', v_fin_preview
    );
  END IF;

  -- === Ejecutar conciliación financiera (idempotente) ===
  IF v_do_reconcile
     AND NOT (v_event.resolution_data IS NOT NULL
              AND v_event.resolution_data #>> '{financial_reconciliation,status}' = 'posted') THEN
    v_meta := jsonb_build_object(
      'replacement_event_id', p_event_id,
      'original_movement_id', v_orig_mov.id,
      'original_product_id', v_event.core_product_id,
      'original_variant_id', v_event.core_variant_id,
      'replacement_product_id', v_replacement_product_id,
      'original_reserved_amount', v_orig_amount,
      'destination_total', v_dest_total,
      'reason', COALESCE(p_adjustment_reason,'Conciliación financiera de reemplazo')
    );
    FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_projected_movs) LOOP
      INSERT INTO public.core_fabrication_fund_movements(
        fund_id, movement_type, source, amount, currency, fund_bucket,
        related_movement_id, core_product_id, reason, notes, cost_snapshot_data, created_by
      ) VALUES (
        (v_alloc->>'fund_id')::uuid,
        v_alloc->>'movement_type',
        'system',
        (v_alloc->>'amount')::numeric,
        v_orig_currency,
        v_alloc->>'fund_bucket',
        v_orig_mov.id,
        v_alloc->>'reason',
        'Reemplazo evento ' || p_event_id::text,
        v_meta || jsonb_build_object('projected', v_alloc),
        v_uid
      ) RETURNING id INTO v_mov_id;
      v_posted_movs := v_posted_movs || v_mov_id;
    END LOOP;
  END IF;

  v_fin_result := v_fin_preview || jsonb_build_object(
    'status', CASE WHEN v_do_reconcile THEN 'posted' ELSE 'skipped_no_source_movement' END,
    'movement_ids', to_jsonb(v_posted_movs),
    'posted_at', now(),
    'posted_by', v_uid
  );

  -- === Necesidades / eventos derivados ===
  FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_route_arr) LOOP
    v_core_variant_id := NULLIF(v_alloc->>'core_variant_id','')::uuid;
    v_woo_variation_id := NULLIF(v_alloc->>'woo_variation_id','')::bigint;
    v_line_qty := (v_alloc->>'quantity')::numeric;
    v_line_action := v_alloc->>'route_action';
    v_unit_cost := NULLIF(v_alloc->>'unit_cost','')::numeric;
    v_cost_source := v_alloc->>'cost_source';

    IF v_line_action = 'internal_factory' THEN
      v_prod_sku := NULL; v_prod_name := NULL; v_var_sku := NULL; v_var_label := NULL; v_var_size := NULL;
      IF v_replacement_product_id IS NOT NULL THEN
        SELECT core_sku, name INTO v_prod_sku, v_prod_name FROM public.core_products WHERE id = v_replacement_product_id;
      END IF;
      IF v_core_variant_id IS NOT NULL THEN
        SELECT variant_sku, variant_label, size INTO v_var_sku, v_var_label, v_var_size
        FROM public.core_product_variants WHERE id = v_core_variant_id;
      END IF;

      SELECT id INTO v_need_id FROM public.core_production_needs
      WHERE core_product_id = v_replacement_product_id
        AND core_variant_id IS NOT DISTINCT FROM v_core_variant_id
        AND source = 'replacement_policy_event:' || p_event_id::text
      LIMIT 1;

      IF v_need_id IS NULL THEN
        INSERT INTO public.core_production_needs(
          need_type, status, priority,
          core_product_id, core_variant_id,
          sku, variant_sku, product_name, variant_label, size,
          quantity_needed, quantity_pending,
          source, reason, notes, created_by
        ) VALUES (
          'inventory_restock', 'pending', 'media',
          v_replacement_product_id, v_core_variant_id,
          v_prod_sku, v_var_sku, v_prod_name, v_var_label, v_var_size,
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
               sku = COALESCE(sku, v_prod_sku),
               variant_sku = COALESCE(variant_sku, v_var_sku),
               product_name = COALESCE(product_name, v_prod_name),
               variant_label = COALESCE(variant_label, v_var_label),
               size = COALESCE(size, v_var_size),
               updated_at = now(),
               updated_by = v_uid
         WHERE id = v_need_id;
      END IF;
      v_created_needs := v_created_needs || v_need_id;

    ELSE
      v_route := public.route_core_replenishment_candidate(
        p_source_type := 'replacement_policy_event',
        p_source_key := (p_event_id::text || ':' || (v_alloc->>'canonical_key')),
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
      IF v_evt_id IS NOT NULL THEN v_created_events := v_created_events || v_evt_id; END IF;
    END IF;
  END LOOP;

  v_result := jsonb_build_object(
    'dry_run', false,'already_applied', false,'applied_at', now(),'applied_by', v_uid,
    'original_event_id', p_event_id,'original_product_id', v_event.core_product_id,'original_variant_id', v_event.core_variant_id,
    'original_suggested_quantity', v_suggested,'confirmed_quantity', v_confirmed,'adjustment_reason', p_adjustment_reason,
    'replacement_product_id', v_replacement_product_id,'replacement_woo_product_id', v_replacement_woo_product_id,
    'allocations', v_route_arr,'route_summary', v_route_summary,'final_route_action', v_final_action,'estimated_total', v_estimated_total,
    'created_need_ids', to_jsonb(v_created_needs),'created_policy_event_ids', to_jsonb(v_created_events),
    'financial_reconciliation', v_fin_result
  );

  UPDATE public.core_replenishment_policy_events
     SET status = 'resolved', resolved_at = now(), resolved_by = v_uid,
         resolution_notes = 'Reemplazo aplicado: ' || v_final_action, resolution_data = v_result
   WHERE id = p_event_id;

  BEGIN
    INSERT INTO public.core_audit_logs(table_name, record_id, action, new_value, performed_by)
    VALUES ('core_replenishment_policy_events', p_event_id, 'replacement_applied', v_result::text, v_uid::text);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_result;
END;
$function$;
