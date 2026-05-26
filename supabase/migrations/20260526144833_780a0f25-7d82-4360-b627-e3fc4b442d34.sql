ALTER TABLE public.core_fabrication_fund_movements ADD COLUMN IF NOT EXISTS fabrication_fund_run_id uuid REFERENCES public.core_fabrication_fund_runs(id) ON DELETE SET NULL;
ALTER TABLE public.core_fabrication_fund_pending_items ADD COLUMN IF NOT EXISTS fabrication_fund_run_id uuid REFERENCES public.core_fabrication_fund_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cffm_run ON public.core_fabrication_fund_movements(fabrication_fund_run_id);
CREATE INDEX IF NOT EXISTS idx_cffp_run ON public.core_fabrication_fund_pending_items(fabrication_fund_run_id);