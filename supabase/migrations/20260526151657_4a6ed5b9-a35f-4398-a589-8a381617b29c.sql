
ALTER TABLE public.core_fabrication_fund_pending_items
  ADD COLUMN IF NOT EXISTS ignored_reason text,
  ADD COLUMN IF NOT EXISTS ignored_at timestamptz,
  ADD COLUMN IF NOT EXISTS ignored_by uuid,
  ADD COLUMN IF NOT EXISTS linked_core_product_id uuid,
  ADD COLUMN IF NOT EXISTS linked_core_variant_id uuid,
  ADD COLUMN IF NOT EXISTS marked_non_restockable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_action_by uuid;

CREATE INDEX IF NOT EXISTS idx_cffp_status ON public.core_fabrication_fund_pending_items(status);
CREATE INDEX IF NOT EXISTS idx_cffp_reason ON public.core_fabrication_fund_pending_items(reason);
CREATE INDEX IF NOT EXISTS idx_cffp_woo_sku ON public.core_fabrication_fund_pending_items(woo_sku);
CREATE INDEX IF NOT EXISTS idx_cffp_linked_core ON public.core_fabrication_fund_pending_items(linked_core_product_id);
CREATE INDEX IF NOT EXISTS idx_cffp_woo_product ON public.core_fabrication_fund_pending_items(woo_product_id);
