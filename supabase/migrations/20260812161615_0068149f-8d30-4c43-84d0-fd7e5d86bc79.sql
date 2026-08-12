CREATE OR REPLACE FUNCTION public.core_sync_production_order_allocation(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   public.core_production_orders%ROWTYPE;
  v_fund_id uuid;
  v_target  numeric := 0;
  v_current numeric := 0;
  v_delta   numeric := 0;
  v_qty     numeric := 0;
  v_mov_id  uuid;
BEGIN
  SELECT * INTO v_order FROM public.core_production_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT id INTO v_fund_id
  FROM public.core_fabrication_funds
  WHERE fund_type = 'general' AND currency = 'USD' AND core_product_id IS NULL
  ORDER BY created_at LIMIT 1;
  IF v_fund_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(l.quantity_ordered), 0),
         COALESCE(SUM(l.quantity_ordered * COALESCE(
           l.estimated_unit_cost,
           public.resolve_core_variant_unit_cost(l.core_product_id, l.core_variant_id),
           0)), 0)
    INTO v_qty, v_target
  FROM public.core_production_order_lines l
  WHERE l.production_order_id = p_order_id;

  IF v_order.status IN ('cancelled') THEN
    v_target := 0;
  END IF;

  SELECT id, ABS(amount) INTO v_mov_id, v_current
  FROM public.core_fabrication_fund_movements
  WHERE production_order_id = p_order_id AND movement_type = 'production_allocated'
  LIMIT 1;
  v_current := COALESCE(v_current, 0);

  v_delta := v_target - v_current;
  IF v_delta = 0 AND v_mov_id IS NOT NULL THEN RETURN; END IF;
  IF v_target = 0 AND v_mov_id IS NULL THEN RETURN; END IF;

  IF v_mov_id IS NULL THEN
    INSERT INTO public.core_fabrication_fund_movements (
      fund_id, movement_type, source, amount, currency, status, fund_bucket,
      production_order_id, quantity, reason, metadata
    ) VALUES (
      v_fund_id, 'production_allocated', 'production_order', -v_target, 'USD', 'posted',
      'internal_factory', p_order_id, v_qty,
      'Asignación de partida a ' || COALESCE(v_order.order_code, 'OP'),
      jsonb_build_object('order_code', v_order.order_code, 'quantity', v_qty, 'total_cost', v_target, 'order_status', v_order.status)
    );
  ELSE
    UPDATE public.core_fabrication_fund_movements
       SET amount = -v_target,
           quantity = v_qty,
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'order_code', v_order.order_code, 'quantity', v_qty,
             'total_cost', v_target, 'order_status', v_order.status)
     WHERE id = v_mov_id;
  END IF;

  IF v_delta < 0 THEN
    INSERT INTO public.core_fabrication_fund_movements (
      fund_id, movement_type, source, amount, currency, status, fund_bucket,
      production_order_id, reason, metadata
    ) VALUES (
      v_fund_id, 'production_released', 'production_order', ABS(v_delta), 'USD', 'posted',
      'internal_factory', p_order_id,
      'Liberación de partida de ' || COALESCE(v_order.order_code, 'OP'),
      jsonb_build_object('order_code', v_order.order_code, 'order_status', v_order.status, 'released', ABS(v_delta))
    );
  END IF;

  UPDATE public.core_fabrication_funds
     SET available_amount = available_amount - v_delta,
         updated_at = now()
   WHERE id = v_fund_id;
END;
$$;

REVOKE ALL ON FUNCTION public.core_sync_production_order_allocation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.core_sync_production_order_allocation(uuid) TO service_role;