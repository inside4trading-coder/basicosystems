ALTER TABLE public.core_fabrication_fund_movements
  DROP CONSTRAINT IF EXISTS core_fabrication_fund_movements_source_check;
ALTER TABLE public.core_fabrication_fund_movements
  ADD CONSTRAINT core_fabrication_fund_movements_source_check
  CHECK (source = ANY (ARRAY['woocommerce','manual','system','reprocess_pending','adjustment']));