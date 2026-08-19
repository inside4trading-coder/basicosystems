CREATE OR REPLACE FUNCTION public.core_resolve_unlinked_core_movement(p_movement_id uuid, p_action text, p_replacement_event_id uuid DEFAULT NULL::uuid, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mov public.core_fabrication_fund_movements%ROWTYPE;
  v_existing text;
  v_target_fund_id uuid;
  v_target_bucket text;
  v_target_fund_type text;
  v_amount numeric;
  v_out_id uuid;
  v_in_id uuid;
  v_res jsonb;
BEGIN
  IF p_action NOT IN ('no_restock','mark_replaced','external_supplier','mark_reviewed') THEN
    RETURN jsonb_build_object('error','invalid_action','action',p_action);
  END IF;

  IF p_action = 'mark_replaced' AND p_replacement_event_id IS NULL THEN
    RETURN jsonb_build_object('error','replacement_event_id_required');
  END IF;

  SELECT * INTO v_mov FROM public.core_fabrication_fund_movements
   WHERE id = p_movement_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','movement_not_found','movement_id',p_movement_id);
  END IF;

  IF v_mov.movement_type <> 'sale_generated' THEN
    RETURN jsonb_build_object('error','invalid_movement_type','movement_type',v_mov.movement_type);
  END IF;
  IF v_mov.status <> 'posted' THEN
    RETURN jsonb_build_object('error','invalid_status','status',v_mov.status);
  END IF;
  IF COALESCE(v_mov.amount,0) <= 0 AND p_action <> 'mark_reviewed' THEN
    RETURN jsonb_build_object('error','invalid_amount','amount',v_mov.amount);
  END IF;
  IF COALESCE(v_mov.fund_bucket,'') <> 'internal_factory' THEN
    RETURN jsonb_build_object('error','invalid_fund_bucket','fund_bucket',v_mov.fund_bucket);
  END IF;
  IF v_mov.core_product_id IS NOT NULL AND v_mov.core_variant_id IS NOT NULL THEN
    RETURN jsonb_build_object('error','movement_already_linked');
  END IF;

  v_existing := COALESCE(v_mov.cost_snapshot_data,'{}'::jsonb)
                  -> 'unlinked_core_resolution' ->> 'status';
  IF v_existing IN ('corrected','closed') THEN
    RETURN jsonb_build_object(
      'already_resolved', true,
      'movement_id', p_movement_id,
      'resolution', COALESCE(v_mov.cost_snapshot_data,'{}'::jsonb)->'unlinked_core_resolution'
    );
  END IF;

  v_amount := COALESCE(v_mov.amount,0);

  IF p_action = 'mark_replaced' THEN
    IF p_dry_run THEN
      RETURN jsonb_build_object('dry_run',true,'action','mark_replaced','movement_id',p_movement_id,
                                'replacement_event_id',p_replacement_event_id,'movements',jsonb_build_array());
    END IF;

    UPDATE public.core_fabrication_fund_movements
       SET cost_snapshot_data = jsonb_set(
             COALESCE(cost_snapshot_data,'{}'::jsonb),
             '{unlinked_core_resolution}',
             jsonb_build_object(
               'status','corrected',
               'action','replace',
               'replacement_event_id', p_replacement_event_id,
               'resolved_at', now()
             ), true)
     WHERE id = p_movement_id;

    RETURN jsonb_build_object('ok',true,'action','replace','movement_id',p_movement_id,
                              'replacement_event_id',p_replacement_event_id,'funds_moved',false);
  END IF;

  IF p_action = 'mark_reviewed' THEN
    IF p_dry_run THEN
      RETURN jsonb_build_object('dry_run',true,'action','mark_reviewed','movement_id',p_movement_id,
                                'movements',jsonb_build_array());
    END IF;

    UPDATE public.core_fabrication_fund_movements
       SET cost_snapshot_data = jsonb_set(
             COALESCE(cost_snapshot_data,'{}'::jsonb),
             '{unlinked_core_resolution}',
             jsonb_build_object(
               'status','closed',
               'action','mark_reviewed',
               'resolved_at', now(),
               'reason','Revisado manualmente. Reposición externa gestionada por fuera.'
             ), true)
     WHERE id = p_movement_id;

    RETURN jsonb_build_object('ok',true,'action','mark_reviewed','movement_id',p_movement_id,'funds_moved',false);
  END IF;

  IF p_action = 'external_supplier' THEN
    v_target_fund_type := 'external_supplier';
    v_target_bucket := 'external_supplier';
  ELSE
    v_target_fund_type := 'non_restockable';
    v_target_bucket := 'non_restockable';
  END IF;

  SELECT id INTO v_target_fund_id FROM public.core_fabrication_funds
   WHERE fund_type = v_target_fund_type AND status = 'active'
   ORDER BY created_at LIMIT 1;
  IF v_target_fund_id IS NULL THEN
    RETURN jsonb_build_object('error','destination_fund_missing','fund_type',v_target_fund_type);
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object('dry_run',true,'action',p_action,'movement_id',p_movement_id,
      'movements', jsonb_build_array(
        jsonb_build_object('movement_type','replacement_reclassification_out','fund_bucket','internal_factory','fund_id',v_mov.fund_id,'amount',-v_amount),
        jsonb_build_object('movement_type','replacement_reclassification_in','fund_bucket',v_target_bucket,'fund_id',v_target_fund_id,'amount',v_amount)
      ));
  END IF;

  INSERT INTO public.core_fabrication_fund_movements (
    fund_id, movement_type, source, source_order_id, source_order_item_id,
    woo_product_id, woo_variation_id, sku, product_name, quantity,
    unit_cost_snapshot, amount, currency, related_movement_id, reason,
    status, fund_bucket, cost_snapshot_data
  ) VALUES (
    v_mov.fund_id, 'replacement_reclassification_out', 'woocommerce',
    v_mov.source_order_id, v_mov.source_order_item_id,
    v_mov.woo_product_id, v_mov.woo_variation_id, v_mov.sku, v_mov.product_name,
    v_mov.quantity, v_mov.unit_cost_snapshot, -v_amount,
    COALESCE(v_mov.currency,'USD'), p_movement_id,
    CASE WHEN p_action = 'external_supplier'
      THEN 'Salida por venta sin vínculo Core reclasificada a proveedor externo'
      ELSE 'Salida por venta sin vínculo Core marcada como no restock' END,
    'posted', 'internal_factory',
    jsonb_build_object('unlinked_core_resolution_leg','out','origin_movement_id',p_movement_id,'action',p_action)
  ) RETURNING id INTO v_out_id;

  INSERT INTO public.core_fabrication_fund_movements (
    fund_id, movement_type, source, source_order_id, source_order_item_id,
    woo_product_id, woo_variation_id, sku, product_name, quantity,
    unit_cost_snapshot, amount, currency, related_movement_id, reason,
    status, fund_bucket, cost_snapshot_data
  ) VALUES (
    v_target_fund_id, 'replacement_reclassification_in', 'woocommerce',
    v_mov.source_order_id, v_mov.source_order_item_id,
    v_mov.woo_product_id, v_mov.woo_variation_id, v_mov.sku, v_mov.product_name,
    v_mov.quantity, v_mov.unit_cost_snapshot, v_amount,
    COALESCE(v_mov.currency,'USD'), p_movement_id,
    CASE WHEN p_action = 'external_supplier'
      THEN 'Entrada a partida proveedores por reposición externa sin vínculo Core'
      ELSE 'Entrada a partida no restockable por venta sin vínculo Core' END,
    'posted', v_target_bucket,
    jsonb_build_object('unlinked_core_resolution_leg','in','origin_movement_id',p_movement_id,'action',p_action)
  ) RETURNING id INTO v_in_id;

  UPDATE public.core_fabrication_fund_movements
     SET cost_snapshot_data = jsonb_set(
           COALESCE(cost_snapshot_data,'{}'::jsonb),
           '{unlinked_core_resolution}',
           jsonb_build_object(
             'status','corrected',
             'action', CASE WHEN p_action='external_supplier' THEN 'external_supplier' ELSE 'no_restock' END,
             'resolved_at', now(),
             'out_movement_id', v_out_id,
             'in_movement_id', v_in_id,
             'reason', CASE WHEN p_action='external_supplier'
               THEN 'Venta con ruta proveedor externo. Reserva movida a partida proveedores.'
               ELSE 'Venta con Woo vinculado pero sin Core. Marcada como no restock.' END
           ), true)
   WHERE id = p_movement_id;

  v_res := jsonb_build_object('ok',true,'action',p_action,'movement_id',p_movement_id,
                              'amount',v_amount,'out_movement_id',v_out_id,'in_movement_id',v_in_id,
                              'funds_moved',true);
  RETURN v_res;
END;
$function$;