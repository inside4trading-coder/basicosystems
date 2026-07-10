ALTER TABLE public.core_fabrication_fund_movements
  ADD COLUMN IF NOT EXISTS fund_bucket text;

CREATE INDEX IF NOT EXISTS core_fab_fund_mov_fund_bucket_idx
  ON public.core_fabrication_fund_movements(fund_bucket);

ALTER TABLE public.core_fabrication_funds
  DROP CONSTRAINT IF EXISTS core_fabrication_funds_fund_type_check;

ALTER TABLE public.core_fabrication_funds
  ADD CONSTRAINT core_fabrication_funds_fund_type_check
  CHECK (fund_type IN ('general','non_restockable','product_specific','replacement','pending','external_supplier'));

INSERT INTO public.core_fabrication_funds (fund_type, name, currency, available_amount, status)
SELECT 'external_supplier', 'Proveedores externos USD', 'USD', 0, 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.core_fabrication_funds
   WHERE fund_type = 'external_supplier'
     AND currency = 'USD'
     AND core_product_id IS NULL
);