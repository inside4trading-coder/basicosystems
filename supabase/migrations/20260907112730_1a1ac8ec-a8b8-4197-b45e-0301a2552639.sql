-- 1) Creación atómica de necesidad + vínculos de partida
CREATE OR REPLACE FUNCTION public.core_create_need_from_movements(
  p_core_product_id uuid,
  p_core_variant_id uuid,
  p_movement_ids uuid[],
  p_sku text DEFAULT NULL,
  p_variant_sku text DEFAULT NULL,
  p_product_name text DEFAULT NULL,
  p_variant_label text DEFAULT NULL,
  p_size text DEFAULT NULL,
  p_priority text DEFAULT 'media',
  p_run_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_ids uuid[];
  v_qty numeric := 0;
  v_last timestamptz;
  v_need_id uuid;
  v_action text;
  v_linked int := 0;
  v_needed numeric;
  v_converted numeric;
BEGIN
  IF p_core_product_id IS NULL OR p_core_variant_id IS NULL THEN
    RETURN jsonb_build_object('action','skipped','reason','missing_core_ids');
  END IF;

  -- Bloquear las partidas candidatas y quedarnos SOLO con las que no tienen vínculo
  WITH locked AS (
    SELECT m.id, m.quantity, m.created_at
    FROM core_fabrication_fund_movements m
    WHERE m.id = ANY(p_movement_ids)
    ORDER BY m.id
    FOR UPDATE
  )
  SELECT array_agg(l.id), COALESCE(SUM(COALESCE(l.quantity,0)),0), MAX(l.created_at)
    INTO v_new_ids, v_qty, v_last
  FROM locked l
  WHERE NOT EXISTS (
    SELECT 1 FROM core_production_need_sources s
    WHERE s.fabrication_fund_movement_id = l.id
  );

  IF v_new_ids IS NULL OR array_length(v_new_ids,1) IS NULL OR v_qty <= 0 THEN
    RETURN jsonb_build_object('action','skipped','reason','already_linked');
  END IF;

  SELECT id, quantity_needed, quantity_converted_to_order
    INTO v_need_id, v_needed, v_converted
  FROM core_production_needs
  WHERE core_variant_id = p_core_variant_id
    AND need_type = 'sale_generated'
    AND status IN ('pending','review','approved','partially_converted')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_need_id IS NOT NULL THEN
    UPDATE core_production_needs
       SET quantity_needed = v_needed + v_qty,
           quantity_pending = GREATEST((v_needed + v_qty) - COALESCE(v_converted,0), 0),
           last_sale_at = GREATEST(COALESCE(last_sale_at, v_last), v_last),
           generation_run_id = COALESCE(p_run_id, generation_run_id),
           updated_by = p_user_id
     WHERE id = v_need_id;
    v_action := 'updated';
  ELSE
    INSERT INTO core_production_needs (
      need_type, status, priority, core_product_id, core_variant_id,
      sku, variant_sku, product_name, variant_label, size,
      quantity_needed, quantity_approved, quantity_converted_to_order, quantity_pending,
      source, last_sale_at, generation_run_id, created_by, updated_by
    ) VALUES (
      'sale_generated', 'pending',
      CASE WHEN p_priority IN ('alta','media','baja') THEN p_priority ELSE 'media' END,
      p_core_product_id, p_core_variant_id,
      p_sku, p_variant_sku, p_product_name, p_variant_label, p_size,
      v_qty, 0, 0, v_qty,
      'auto_from_movements', v_last, p_run_id, p_user_id, p_user_id
    )
    RETURNING id INTO v_need_id;
    v_action := 'created';
  END IF;

  INSERT INTO core_production_need_sources (
    production_need_id, fabrication_fund_movement_id,
    source_order_id, source_order_item_id, quantity, amount, currency
  )
  SELECT v_need_id, m.id, m.source_order_id, m.source_order_item_id,
         COALESCE(m.quantity,0), m.amount, COALESCE(m.currency,'USD')
  FROM core_fabrication_fund_movements m
  WHERE m.id = ANY(v_new_ids)
  ON CONFLICT (fabrication_fund_movement_id) WHERE fabrication_fund_movement_id IS NOT NULL
  DO NOTHING;

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  INSERT INTO core_audit_logs (table_name, record_id, action, new_value, performed_by)
  VALUES (
    'core_production_needs', v_need_id,
    CASE WHEN v_action = 'created' THEN 'auto_create_from_movements' ELSE 'auto_update_from_movements' END,
    jsonb_build_object('qty_added', v_qty, 'movements', array_length(v_new_ids,1), 'run_id', p_run_id)::text,
    COALESCE(p_user_id::text, 'system')
  );

  RETURN jsonb_build_object(
    'action', v_action,
    'need_id', v_need_id,
    'quantity', v_qty,
    'movements_linked', v_linked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.core_create_need_from_movements(uuid,uuid,uuid[],text,text,text,text,text,text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.core_create_need_from_movements(uuid,uuid,uuid[],text,text,text,text,text,text,uuid,uuid) TO service_role;

-- 2) Reversión quirúrgica de una ejecución concreta
CREATE OR REPLACE FUNCTION public.core_revert_needs_run(
  p_run_id uuid,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dup_ids uuid[];
  v_ok_ids uuid[];
  v_dup int := 0;
  v_adj int := 0;
  v_excess numeric := 0;
  v_note text;
  r record;
  v_target numeric;
BEGIN
  v_note := 'Anulada automáticamente por corrección del incidente '
            || left(p_run_id::text, 8)
            || ': generación duplicó demanda histórica ya procesada.';

  SELECT array_agg(n.id) INTO v_dup_ids
  FROM core_production_needs n
  WHERE n.generation_run_id = p_run_id
    AND NOT EXISTS (SELECT 1 FROM core_production_need_sources s WHERE s.production_need_id = n.id);

  SELECT array_agg(n.id) INTO v_ok_ids
  FROM core_production_needs n
  WHERE n.generation_run_id = p_run_id
    AND EXISTS (SELECT 1 FROM core_production_need_sources s WHERE s.production_need_id = n.id);

  v_dup := COALESCE(array_length(v_dup_ids,1), 0);

  SELECT COALESCE(SUM(GREATEST(n.quantity_needed - COALESCE(sq.q,0), 0)),0)
    INTO v_excess
  FROM core_production_needs n
  LEFT JOIN LATERAL (
    SELECT SUM(s.quantity) q FROM core_production_need_sources s WHERE s.production_need_id = n.id
  ) sq ON true
  WHERE n.id = ANY(COALESCE(v_ok_ids, ARRAY[]::uuid[]));

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'run_id', p_run_id,
      'duplicates', v_dup,
      'legitimate', COALESCE(array_length(v_ok_ids,1),0),
      'excess_units', v_excess
    );
  END IF;

  -- 170 duplicadas: anulación segura, sin borrado físico
  FOR r IN
    SELECT id, status, notes FROM core_production_needs
    WHERE id = ANY(COALESCE(v_dup_ids, ARRAY[]::uuid[]))
      AND status <> 'ignored'
  LOOP
    UPDATE core_production_needs
       SET status = 'ignored',
           notes = CASE WHEN COALESCE(r.notes,'') = '' THEN v_note ELSE r.notes || ' | ' || v_note END
     WHERE id = r.id;

    INSERT INTO core_audit_logs (table_name, record_id, action, field_changed, old_value, new_value, performed_by)
    VALUES ('core_production_needs', r.id, 'incident_revert_ignore', 'status', r.status, 'ignored', 'system:revert:' || left(p_run_id::text,8));
  END LOOP;

  -- Necesidades legítimas: cantidad = suma real de sus partidas vinculadas
  FOR r IN
    SELECT n.id, n.quantity_needed, n.quantity_approved, n.quantity_converted_to_order,
           COALESCE(sq.q, 0) AS real_q
    FROM core_production_needs n
    LEFT JOIN LATERAL (
      SELECT SUM(s.quantity) q FROM core_production_need_sources s WHERE s.production_need_id = n.id
    ) sq ON true
    WHERE n.id = ANY(COALESCE(v_ok_ids, ARRAY[]::uuid[]))
  LOOP
    v_target := GREATEST(r.real_q, COALESCE(r.quantity_converted_to_order,0));
    IF v_target = r.quantity_needed THEN
      CONTINUE;
    END IF;

    UPDATE core_production_needs
       SET quantity_needed = v_target,
           quantity_approved = LEAST(COALESCE(quantity_approved,0), v_target),
           quantity_pending = GREATEST(v_target - COALESCE(quantity_converted_to_order,0), 0)
     WHERE id = r.id;

    INSERT INTO core_audit_logs (table_name, record_id, action, field_changed, old_value, new_value, performed_by)
    VALUES ('core_production_needs', r.id, 'incident_revert_qty', 'quantity_needed',
            r.quantity_needed::text, v_target::text, 'system:revert:' || left(p_run_id::text,8));

    v_adj := v_adj + 1;
  END LOOP;

  -- Validaciones críticas
  IF EXISTS (
    SELECT 1 FROM core_production_needs
    WHERE generation_run_id = p_run_id
      AND (quantity_needed < 0 OR quantity_pending < 0 OR quantity_approved < 0
           OR quantity_needed < quantity_converted_to_order)
  ) THEN
    RAISE EXCEPTION 'Validación fallida: cantidades inconsistentes tras la reversión';
  END IF;

  RETURN jsonb_build_object(
    'dry_run', false,
    'run_id', p_run_id,
    'ignored', v_dup,
    'adjusted', v_adj,
    'excess_units_removed', v_excess
  );
END;
$$;

REVOKE ALL ON FUNCTION public.core_revert_needs_run(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.core_revert_needs_run(uuid, boolean) TO service_role;