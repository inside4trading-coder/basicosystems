-- 1) Nuevos tipos de movimiento y source
ALTER TABLE public.core_fabrication_fund_movements
  DROP CONSTRAINT IF EXISTS core_fabrication_fund_movements_movement_type_check;
ALTER TABLE public.core_fabrication_fund_movements
  ADD CONSTRAINT core_fabrication_fund_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY[
    'sale_generated','sale_generated_non_restockable','manual_increase','manual_decrease',
    'transfer','reversal','close','correction','replacement_cost_adjustment',
    'replacement_reclassification_out','replacement_reclassification_in','external_supplier_payment',
    'production_allocated','production_released','production_executed'
  ]));

ALTER TABLE public.core_fabrication_fund_movements
  DROP CONSTRAINT IF EXISTS core_fabrication_fund_movements_source_check;
ALTER TABLE public.core_fabrication_fund_movements
  ADD CONSTRAINT core_fabrication_fund_movements_source_check
  CHECK (source = ANY (ARRAY['woocommerce','manual','system','reprocess_pending','adjustment','production_order']));

-- 2) Columnas nuevas
ALTER TABLE public.core_fabrication_fund_movements
  ADD COLUMN IF NOT EXISTS production_order_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cffm_production_order_fk'
  ) THEN
    ALTER TABLE public.core_fabrication_fund_movements
      ADD CONSTRAINT cffm_production_order_fk
      FOREIGN KEY (production_order_id) REFERENCES public.core_production_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cffm_production_allocated
  ON public.core_fabrication_fund_movements (production_order_id)
  WHERE movement_type = 'production_allocated';

CREATE INDEX IF NOT EXISTS idx_cffm_production_order
  ON public.core_fabrication_fund_movements (production_order_id);

-- 3) Sincronización de asignación por OP
CREATE OR REPLACE FUNCTION public.core_sync_production_order_allocation(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   public.core_production_orders%ROWTYPE;
  v_fund_id uuid;
  v_target  numeric := 0;   -- monto que debe estar asignado (positivo)
  v_current numeric := 0;   -- monto ya asignado (positivo)
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
           public.resolve_core_variant_unit_cost(l.core_variant_id),
           0)), 0)
    INTO v_qty, v_target
  FROM public.core_production_order_lines l
  WHERE l.production_order_id = p_order_id;

  -- Estados que no mantienen reserva viva
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

  -- Si se liberó dinero, dejar rastro explícito
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

  -- Ajuste de saldo por diferencia exacta (nunca por total)
  UPDATE public.core_fabrication_funds
     SET available_amount = available_amount - v_delta,
         updated_at = now()
   WHERE id = v_fund_id;
END;
$$;

-- 4) Triggers
CREATE OR REPLACE FUNCTION public.core_pol_allocation_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.core_sync_production_order_allocation(OLD.production_order_id);
    RETURN OLD;
  END IF;
  PERFORM public.core_sync_production_order_allocation(NEW.production_order_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_core_pol_allocation ON public.core_production_order_lines;
CREATE TRIGGER trg_core_pol_allocation
AFTER INSERT OR UPDATE OF quantity_ordered, estimated_unit_cost, core_variant_id OR DELETE
ON public.core_production_order_lines
FOR EACH ROW EXECUTE FUNCTION public.core_pol_allocation_trg();

CREATE OR REPLACE FUNCTION public.core_production_order_status_fund_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alloc numeric;
  v_fund_id uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'cancelled' THEN
    PERFORM public.core_sync_production_order_allocation(NEW.id);
    RETURN NEW;
  END IF;

  IF NEW.status IN ('closed', 'completed', 'manually_closed') THEN
    SELECT ABS(amount), fund_id INTO v_alloc, v_fund_id
    FROM public.core_fabrication_fund_movements
    WHERE production_order_id = NEW.id AND movement_type = 'production_allocated'
    LIMIT 1;

    IF v_alloc IS NOT NULL AND v_alloc > 0 AND NOT EXISTS (
      SELECT 1 FROM public.core_fabrication_fund_movements
      WHERE production_order_id = NEW.id AND movement_type = 'production_executed'
    ) THEN
      INSERT INTO public.core_fabrication_fund_movements (
        fund_id, movement_type, source, amount, currency, status, fund_bucket,
        production_order_id, reason, metadata
      ) VALUES (
        v_fund_id, 'production_executed', 'production_order', 0, 'USD', 'posted',
        'internal_factory', NEW.id,
        'Producción ejecutada ' || COALESCE(NEW.order_code, 'OP'),
        jsonb_build_object('order_code', NEW.order_code, 'order_status', NEW.status, 'executed_amount', v_alloc)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_core_po_status_fund ON public.core_production_orders;
CREATE TRIGGER trg_core_po_status_fund
AFTER UPDATE OF status ON public.core_production_orders
FOR EACH ROW EXECUTE FUNCTION public.core_production_order_status_fund_trg();