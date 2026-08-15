-- 1) Nuevo movement_type
ALTER TABLE public.core_fabrication_fund_movements
  DROP CONSTRAINT IF EXISTS core_fabrication_fund_movements_movement_type_check;
ALTER TABLE public.core_fabrication_fund_movements
  ADD CONSTRAINT core_fabrication_fund_movements_movement_type_check CHECK (movement_type = ANY (ARRAY[
    'sale_generated','sale_generated_non_restockable','manual_increase','manual_decrease','transfer','reversal',
    'close','correction','replacement_cost_adjustment','replacement_reclassification_out','replacement_reclassification_in',
    'external_supplier_payment','production_allocated','production_released','production_executed',
    'production_cancelled_to_no_restock']));

-- 2) Idempotencia: una unidad solo se reclasifica una vez
CREATE UNIQUE INDEX IF NOT EXISTS ux_fund_mov_unit_cancel_to_no_restock
  ON public.core_fabrication_fund_movements ((metadata->>'unit_id'))
  WHERE movement_type = 'production_cancelled_to_no_restock';

-- 3) Sync de asignación descuenta unidades canceladas
CREATE OR REPLACE FUNCTION public.core_sync_production_order_allocation(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order   public.core_production_orders%ROWTYPE;
  v_fund_id uuid;
  v_target  numeric := 0;
  v_current numeric := 0;
  v_delta   numeric := 0;
  v_qty     numeric := 0;
  v_cancel  numeric := 0;
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

  -- Costos ya reclasificados a No Restock por prendas canceladas
  SELECT COALESCE(SUM(amount), 0) INTO v_cancel
  FROM public.core_fabrication_fund_movements
  WHERE production_order_id = p_order_id
    AND movement_type = 'production_cancelled_to_no_restock'
    AND status = 'posted';

  v_target := GREATEST(v_target - v_cancel, 0);

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
             'total_cost', v_target, 'order_status', v_order.status,
             'cancelled_units_cost', v_cancel)
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

  -- Nota: el saldo general solo se ajusta cuando el cambio NO proviene de una
  -- cancelación de prenda (esa reserva se mueve lateralmente a No Restock).
  IF v_cancel = 0 OR v_delta > 0 THEN
    UPDATE public.core_fabrication_funds
       SET available_amount = available_amount - v_delta,
           updated_at = now()
     WHERE id = v_fund_id;
  END IF;
END;
$fn$;

-- 4) Cancelar prenda dentro de una OP
CREATE OR REPLACE FUNCTION public.core_cancel_production_unit(
  p_unit_id uuid,
  p_reason  text,
  p_notes   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_unit    public.core_production_units%ROWTYPE;
  v_order   public.core_production_orders%ROWTYPE;
  v_cost    numeric := 0;
  v_fund_nr uuid;
  v_exists  uuid;
  v_dispatched boolean := false;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Motivo obligatorio';
  END IF;

  SELECT * INTO v_unit FROM public.core_production_units WHERE id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidad no encontrada'; END IF;

  IF v_unit.status IN ('cancelled','discarded') THEN
    RAISE EXCEPTION 'La prenda ya está cancelada';
  END IF;
  IF v_unit.status IN ('entered_inventory','sent_to_store','received_in_store')
     OR v_unit.entered_inventory_at IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede cancelar: la prenda ya fue ingresada a inventario o enviada a tienda';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.core_dispatch_units du
    JOIN public.core_dispatches d ON d.id = du.dispatch_id
    WHERE du.unit_id = v_unit.id AND COALESCE(d.status,'draft') <> 'draft'
  ) INTO v_dispatched;
  IF v_dispatched THEN
    RAISE EXCEPTION 'No se puede cancelar: la prenda está en un despacho cerrado o recibido';
  END IF;

  SELECT * INTO v_order FROM public.core_production_orders WHERE id = v_unit.production_order_id;

  -- Costo unitario snapshot
  SELECT COALESCE(l.estimated_unit_cost,
                  public.resolve_core_variant_unit_cost(l.core_product_id, l.core_variant_id), 0)
    INTO v_cost
  FROM public.core_production_order_lines l
  WHERE l.id = v_unit.production_order_line_id;

  IF v_cost IS NULL THEN
    v_cost := COALESCE(public.resolve_core_variant_unit_cost(v_unit.core_product_id, v_unit.core_variant_id), 0);
  END IF;

  UPDATE public.core_production_units
     SET status = 'cancelled',
         cancelled_reason = p_reason,
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         notes = COALESCE(NULLIF(btrim(p_notes), ''), notes),
         updated_at = now(),
         updated_by = auth.uid()
   WHERE id = p_unit_id;

  SELECT id INTO v_exists
  FROM public.core_fabrication_fund_movements
  WHERE movement_type = 'production_cancelled_to_no_restock'
    AND metadata->>'unit_id' = p_unit_id::text
  LIMIT 1;

  IF v_exists IS NULL AND v_cost > 0 THEN
    SELECT id INTO v_fund_nr
    FROM public.core_fabrication_funds
    WHERE fund_type = 'non_restockable' AND currency = 'USD' AND core_product_id IS NULL
    ORDER BY created_at LIMIT 1;

    IF v_fund_nr IS NOT NULL THEN
      INSERT INTO public.core_fabrication_fund_movements (
        fund_id, movement_type, source, amount, currency, status, fund_bucket,
        production_order_id, core_product_id, core_variant_id, sku, product_name,
        quantity, unit_cost_snapshot, reason, notes, created_by, metadata
      ) VALUES (
        v_fund_nr, 'production_cancelled_to_no_restock', 'production_order', v_cost, 'USD', 'posted',
        'non_restockable', v_unit.production_order_id, v_unit.core_product_id, v_unit.core_variant_id,
        COALESCE(v_unit.variant_sku, v_unit.sku), v_order.product_name,
        1, v_cost,
        'Prenda cancelada en ' || COALESCE(v_order.order_code, 'OP') || ': ' || p_reason,
        NULLIF(btrim(p_notes), ''), auth.uid(),
        jsonb_build_object(
          'unit_id', p_unit_id::text,
          'unit_code', v_unit.unit_code,
          'order_code', v_order.order_code,
          'idempotency_key', p_unit_id::text || '|' || v_unit.production_order_id::text || '|cancellation_to_no_restock'
        )
      );

      UPDATE public.core_fabrication_funds
         SET available_amount = available_amount + v_cost, updated_at = now()
       WHERE id = v_fund_nr;
    END IF;
  END IF;

  PERFORM public.core_sync_production_order_allocation(v_unit.production_order_id);

  RETURN jsonb_build_object(
    'unit_id', p_unit_id,
    'unit_code', v_unit.unit_code,
    'cost_moved', CASE WHEN v_exists IS NULL THEN v_cost ELSE 0 END,
    'already_reclassified', v_exists IS NOT NULL
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.core_cancel_production_unit(uuid, text, text) TO authenticated;