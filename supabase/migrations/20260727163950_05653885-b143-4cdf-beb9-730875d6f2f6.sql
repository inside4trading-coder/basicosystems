CREATE OR REPLACE FUNCTION public.core_resolve_missing_sku_pending_item(p_pending_item_id uuid, p_unit_cost numeric, p_action text, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending          public.core_fabrication_fund_pending_items%ROWTYPE;
  v_qty              numeric;
  v_amount           numeric;
  v_bucket           text;
  v_fund_type        text;
  v_fund_id          uuid;
  v_existing_mov_id  uuid;
  v_new_mov_id       uuid;
  v_uid              uuid := auth.uid();
BEGIN
  IF p_pending_item_id IS NULL THEN
    RAISE EXCEPTION 'p_pending_item_id is required';
  END IF;
  IF p_unit_cost IS NULL OR p_unit_cost <= 0 THEN
    RAISE EXCEPTION 'p_unit_cost must be > 0';
  END IF;
  IF p_action NOT IN ('no_restock','replacement_prepare') THEN
    RAISE EXCEPTION 'p_action must be no_restock or replacement_prepare';
  END IF;

  SELECT * INTO v_pending
    FROM public.core_fabrication_fund_pending_items
   WHERE id = p_pending_item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pending item % not found', p_pending_item_id;
  END IF;

  IF v_pending.reason IS NULL
     OR v_pending.reason NOT IN ('missing_sku','product_not_mapped','variation_not_mapped') THEN
    RAISE EXCEPTION 'pending item reason % not supported by this resolver', v_pending.reason;
  END IF;

  IF v_pending.status = 'resolved' THEN
    RETURN jsonb_build_object('already_resolved', true, 'pending_item_id', p_pending_item_id);
  END IF;

  v_qty := COALESCE(v_pending.quantity, 1);
  v_amount := p_unit_cost * v_qty;

  IF p_action = 'no_restock' THEN
    v_bucket := 'non_restockable';
    v_fund_type := 'non_restockable';
  ELSE
    v_bucket := 'pending_classification';
    v_fund_type := 'pending';
  END IF;

  SELECT id INTO v_existing_mov_id
    FROM public.core_fabrication_fund_movements
   WHERE source_order_id      IS NOT DISTINCT FROM v_pending.source_order_id
     AND source_order_item_id IS NOT DISTINCT FROM v_pending.source_order_item_id
     AND (cost_snapshot_data ->> 'manual_missing_sku_resolution') = 'true'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_existing_mov_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already', true,
      'movement_id', v_existing_mov_id,
      'pending_item_id', p_pending_item_id,
      'action', p_action,
      'bucket', v_bucket
    );
  END IF;

  SELECT id INTO v_fund_id
    FROM public.core_fabrication_funds
   WHERE fund_type = v_fund_type
   LIMIT 1;

  IF v_fund_id IS NULL THEN
    RAISE EXCEPTION 'fabrication fund with type % not found', v_fund_type;
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'ok', true,
      'dry_run', true,
      'pending_item_id', p_pending_item_id,
      'action', p_action,
      'bucket', v_bucket,
      'fund_id', v_fund_id,
      'quantity', v_qty,
      'unit_cost', p_unit_cost,
      'amount', v_amount
    );
  END IF;

  INSERT INTO public.core_fabrication_fund_movements (
    fund_id,
    fund_bucket,
    movement_type,
    source,
    source_order_id,
    source_order_item_id,
    woo_product_id,
    woo_variation_id,
    core_product_id,
    core_variant_id,
    sku,
    product_name,
    quantity,
    unit_cost_snapshot,
    amount,
    currency,
    reason,
    notes,
    status,
    created_by,
    cost_snapshot_data
  ) VALUES (
    v_fund_id,
    v_bucket,
    'sale_generated',
    'woocommerce',
    v_pending.source_order_id,
    v_pending.source_order_item_id,
    v_pending.woo_product_id,
    v_pending.woo_variation_id,
    v_pending.linked_core_product_id,
    v_pending.linked_core_variant_id,
    v_pending.woo_sku,
    v_pending.product_name,
    v_qty,
    p_unit_cost,
    v_amount,
    'USD',
    v_pending.reason,
    'Resolución manual missing_sku (' || p_action || ')',
    'posted',
    v_uid,
    jsonb_build_object(
      'manual_missing_sku_resolution', true,
      'resolution_action', p_action,
      'pending_item_id', p_pending_item_id,
      'reason', v_pending.reason,
      'unit_cost', p_unit_cost,
      'quantity', v_qty
    )
  )
  RETURNING id INTO v_new_mov_id;

  UPDATE public.core_fabrication_funds
     SET available_amount = COALESCE(available_amount, 0) + v_amount,
         updated_at = now(),
         updated_by = COALESCE(v_uid, updated_by)
   WHERE id = v_fund_id;

  IF p_action = 'no_restock' THEN
    UPDATE public.core_fabrication_fund_pending_items
       SET status = 'resolved',
           resolved_at = now(),
           resolved_by = v_uid,
           last_action_at = now(),
           last_action_by = v_uid,
           marked_non_restockable = true,
           notes = COALESCE(notes,'') || E'\n[missing_sku:no_restock movement=' || v_new_mov_id::text || ']'
     WHERE id = p_pending_item_id;
  ELSE
    UPDATE public.core_fabrication_fund_pending_items
       SET last_action_at = now(),
           last_action_by = v_uid,
           notes = COALESCE(notes,'') || E'\n[missing_sku:replacement_prepare movement=' || v_new_mov_id::text || ']'
     WHERE id = p_pending_item_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'movement_id', v_new_mov_id,
    'pending_item_id', p_pending_item_id,
    'action', p_action,
    'bucket', v_bucket,
    'fund_id', v_fund_id,
    'quantity', v_qty,
    'unit_cost', p_unit_cost,
    'amount', v_amount
  );
END;
$function$;