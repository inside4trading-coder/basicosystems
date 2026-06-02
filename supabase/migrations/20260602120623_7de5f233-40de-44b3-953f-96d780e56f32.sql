
ALTER TABLE public.esp_woo_order_items
  ADD COLUMN IF NOT EXISTS mapping_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS mapping_note text,
  ADD COLUMN IF NOT EXISTS mapped_manually_at timestamptz,
  ADD COLUMN IF NOT EXISTS mapped_manually_by uuid;

DO $$ BEGIN
  ALTER TABLE public.esp_woo_order_items
    ADD CONSTRAINT esp_woo_order_items_mapping_status_chk
    CHECK (mapping_status IN ('pending','mapped','legacy_unmapped','ignored','manually_mapped'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.esp_woo_order_items
  SET mapping_status = 'mapped'
  WHERE mapping_status = 'pending' AND product_id IS NOT NULL AND variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS esp_woo_order_items_mapping_status_idx
  ON public.esp_woo_order_items(mapping_status);
