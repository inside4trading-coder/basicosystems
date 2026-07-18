-- Ampliar CHECK de movement_type con external_supplier_payment
ALTER TABLE public.core_fabrication_fund_movements
  DROP CONSTRAINT IF EXISTS core_fabrication_fund_movements_movement_type_check;
ALTER TABLE public.core_fabrication_fund_movements
  ADD CONSTRAINT core_fabrication_fund_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY[
    'sale_generated','sale_generated_non_restockable','manual_increase','manual_decrease',
    'transfer','reversal','close','correction',
    'replacement_cost_adjustment','replacement_reclassification_out','replacement_reclassification_in',
    'external_supplier_payment'
  ]));

CREATE OR REPLACE FUNCTION public.core_update_external_purchase_order_payment(p_order_id uuid, p_amount_paid numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_order record;
  v_old_paid numeric;
  v_balance numeric;
  v_status text;
  v_delta numeric;
  v_fund record;
  v_prev_fund_balance numeric;
  v_new_fund_balance numeric;
  v_key text;
  v_existing_mov uuid;
  v_mov_id uuid := NULL;
  v_mov_amount numeric := 0;
BEGIN
  -- 1. Auth
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RETURN jsonb_build_object('error','unauthorized'); END IF;
  IF p_amount_paid IS NULL OR p_amount_paid < 0 THEN RETURN jsonb_build_object('error','invalid_amount'); END IF;

  -- 2/3. Lock order and read old
  SELECT * INTO v_order FROM public.core_external_purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RETURN jsonb_build_object('error','order_not_found'); END IF;
  IF p_amount_paid > v_order.total THEN RETURN jsonb_build_object('error','amount_exceeds_total'); END IF;

  v_old_paid := COALESCE(v_order.amount_paid, 0);
  v_delta := p_amount_paid - v_old_paid;
  v_balance := v_order.total - p_amount_paid;
  IF p_amount_paid = 0 THEN v_status := 'pending';
  ELSIF p_amount_paid >= v_order.total THEN v_status := 'paid';
  ELSE v_status := 'partial'; END IF;

  -- Idempotency key
  v_key := p_order_id::text || ':' || v_old_paid::text || ':' || p_amount_paid::text;

  -- === Everything below is a single transactional unit; errors after this point use RAISE ===

  -- 7. Update order
  UPDATE public.core_external_purchase_orders
     SET amount_paid = p_amount_paid,
         balance_due = v_balance,
         payment_status = v_status,
         updated_by = v_uid,
         updated_at = now()
   WHERE id = p_order_id;

  -- 8. Financial movement if delta != 0
  IF v_delta <> 0 THEN
    -- Check idempotency
    SELECT id INTO v_existing_mov
    FROM public.core_fabrication_fund_movements
    WHERE movement_type = 'external_supplier_payment'
      AND cost_snapshot_data->>'external_payment_key' = v_key
    LIMIT 1;

    IF v_existing_mov IS NULL THEN
      -- Lock external_supplier fund (USD)
      SELECT * INTO v_fund FROM public.core_fabrication_funds
       WHERE fund_type = 'external_supplier'
         AND currency = 'USD'
         AND core_product_id IS NULL
       FOR UPDATE
       LIMIT 1;
      IF v_fund.id IS NULL THEN RAISE EXCEPTION 'external_supplier_fund_missing'; END IF;

      v_prev_fund_balance := COALESCE(v_fund.available_amount, 0);
      v_mov_amount := -v_delta; -- delta>0 (pago) → egreso negativo; delta<0 (corrección abajo) → +
      v_new_fund_balance := v_prev_fund_balance + v_mov_amount;

      INSERT INTO public.core_fabrication_fund_movements(
        fund_id, movement_type, source, amount, currency, fund_bucket,
        reason, status, created_by, cost_snapshot_data
      ) VALUES (
        v_fund.id, 'external_supplier_payment', 'manual', v_mov_amount, v_fund.currency, 'external_supplier',
        'external_supplier_payment_update', 'posted', v_uid,
        jsonb_build_object(
          'external_purchase_order_id', p_order_id,
          'external_purchase_order_number', v_order.order_number,
          'old_amount_paid', v_old_paid,
          'new_amount_paid', p_amount_paid,
          'payment_delta', v_delta,
          'supplier_name_snapshot', v_order.supplier_name_snapshot,
          'payment_status', v_status,
          'reason', 'external_supplier_payment_update',
          'updated_by', v_uid,
          'updated_at', now(),
          'external_payment_key', v_key,
          'previous_fund_balance', v_prev_fund_balance,
          'new_fund_balance', v_new_fund_balance
        )
      ) RETURNING id INTO v_mov_id;

      UPDATE public.core_fabrication_funds
         SET available_amount = v_new_fund_balance,
             updated_at = now(),
             updated_by = v_uid
       WHERE id = v_fund.id;
    END IF;
  END IF;

  -- 9. Audit
  PERFORM public.core_ext_po_audit(
    p_order_id, v_order.order_number, 'external_order_payment_updated',
    jsonb_build_object('amount_paid', v_old_paid),
    jsonb_build_object(
      'old_amount_paid', v_old_paid,
      'new_amount_paid', p_amount_paid,
      'payment_delta', v_delta,
      'payment_status', v_status,
      'movement_id', v_mov_id,
      'fund_id', v_fund.id,
      'fund_bucket', 'external_supplier',
      'previous_fund_balance', v_prev_fund_balance,
      'new_fund_balance', v_new_fund_balance
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'old_amount_paid', v_old_paid,
    'new_amount_paid', p_amount_paid,
    'payment_delta', v_delta,
    'balance_due', v_balance,
    'payment_status', v_status,
    'movement_id', v_mov_id,
    'movement_amount', v_mov_amount,
    'fund_id', v_fund.id,
    'previous_fund_balance', v_prev_fund_balance,
    'new_fund_balance', v_new_fund_balance,
    'duplicate_skipped', (v_delta <> 0 AND v_mov_id IS NULL)
  );
END;
$function$;