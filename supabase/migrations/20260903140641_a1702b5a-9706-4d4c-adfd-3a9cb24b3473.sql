ALTER TABLE public.sublime_merch_items
  ADD COLUMN IF NOT EXISTS is_consignment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consignment_commission_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consignment_commission_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sublime_merch_items
  ADD CONSTRAINT chk_sublime_consignment_pct CHECK (consignment_commission_pct >= 0 AND consignment_commission_pct <= 100);