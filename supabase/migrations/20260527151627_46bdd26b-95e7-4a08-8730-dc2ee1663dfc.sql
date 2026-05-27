
CREATE OR REPLACE FUNCTION public.core_auto_close_order_on_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_total int;
  v_entered int;
  v_status text;
BEGIN
  v_order_id := COALESCE(NEW.production_order_id, OLD.production_order_id);
  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_status
  FROM public.core_production_orders
  WHERE id = v_order_id;

  -- Do not touch terminal/manual states
  IF v_status IN ('closed', 'cancelled', 'manually_closed') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'discarded')),
    COUNT(*) FILTER (WHERE status = 'entered_inventory')
  INTO v_total, v_entered
  FROM public.core_production_units
  WHERE production_order_id = v_order_id;

  IF v_total > 0 AND v_entered = v_total THEN
    UPDATE public.core_production_orders
    SET status = 'closed',
        updated_at = now()
    WHERE id = v_order_id
      AND status NOT IN ('closed', 'cancelled', 'manually_closed');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_core_auto_close_order ON public.core_production_units;
CREATE TRIGGER trg_core_auto_close_order
AFTER INSERT OR UPDATE OF status ON public.core_production_units
FOR EACH ROW
EXECUTE FUNCTION public.core_auto_close_order_on_inventory();

-- Backfill existing orders that already meet the condition
UPDATE public.core_production_orders o
SET status = 'closed', updated_at = now()
WHERE status NOT IN ('closed', 'cancelled', 'manually_closed')
  AND EXISTS (
    SELECT 1 FROM public.core_production_units u WHERE u.production_order_id = o.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.core_production_units u
    WHERE u.production_order_id = o.id
      AND u.status NOT IN ('entered_inventory', 'cancelled', 'discarded')
  );
