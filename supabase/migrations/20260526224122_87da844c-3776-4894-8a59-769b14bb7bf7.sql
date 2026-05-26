ALTER TABLE public.core_fabrication_fund_pending_items 
  DROP CONSTRAINT IF EXISTS core_fabrication_fund_pending_items_reason_check;
ALTER TABLE public.core_fabrication_fund_pending_items 
  ADD CONSTRAINT core_fabrication_fund_pending_items_reason_check 
  CHECK (reason = ANY (ARRAY[
    'product_not_in_core','missing_cost','unit_cost_missing','missing_sku',
    'sku_conflict','not_fabricable','missing_restock_decision','sync_error',
    'variation_not_mapped','non_restockable_not_classified','product_deleted_or_unavailable'
  ]));

ALTER TABLE public.core_fabrication_fund_pending_items 
  DROP CONSTRAINT IF EXISTS core_fabrication_fund_pending_items_status_check;
ALTER TABLE public.core_fabrication_fund_pending_items 
  ADD CONSTRAINT core_fabrication_fund_pending_items_status_check 
  CHECK (status = ANY (ARRAY['pending','resolved','ignored','review','linked','non_restockable','processed']));