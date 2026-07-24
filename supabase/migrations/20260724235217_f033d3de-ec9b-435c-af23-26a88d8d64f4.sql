
CREATE OR REPLACE FUNCTION public.core_apply_replacement_fund_balance_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.movement_type IN (
    'replacement_reclassification_out',
    'replacement_reclassification_in',
    'replacement_cost_adjustment'
  ) THEN
    UPDATE public.core_fabrication_funds
       SET available_amount = available_amount + NEW.amount,
           updated_at = now(),
           updated_by = COALESCE(NEW.created_by, updated_by)
     WHERE id = NEW.fund_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_replacement_fund_balance ON public.core_fabrication_fund_movements;
CREATE TRIGGER trg_replacement_fund_balance
AFTER INSERT ON public.core_fabrication_fund_movements
FOR EACH ROW
EXECUTE FUNCTION public.core_apply_replacement_fund_balance_trg();

-- Backfill: apply already-posted replacement movements not yet reflected in fund balances
WITH deltas AS (
  SELECT fund_id, SUM(amount) AS delta
  FROM public.core_fabrication_fund_movements
  WHERE movement_type IN (
    'replacement_reclassification_out',
    'replacement_reclassification_in',
    'replacement_cost_adjustment'
  )
    AND status = 'posted'
  GROUP BY fund_id
)
UPDATE public.core_fabrication_funds f
   SET available_amount = f.available_amount + d.delta,
       updated_at = now()
  FROM deltas d
 WHERE f.id = d.fund_id
   AND f.updated_at < (
     SELECT MAX(created_at) FROM public.core_fabrication_fund_movements
     WHERE fund_id = f.id
       AND movement_type IN (
         'replacement_reclassification_out',
         'replacement_reclassification_in',
         'replacement_cost_adjustment'
       )
   );
