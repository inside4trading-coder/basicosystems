ALTER TABLE public.sublime_merch_items ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'sublime';
ALTER TABLE public.sublime_merch_shipments ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'sublime';
ALTER TABLE public.sublime_merch_boxes ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'sublime';
ALTER TABLE public.sublime_merch_pricing_rules ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'sublime';

ALTER TABLE public.sublime_merch_items ADD CONSTRAINT sublime_merch_items_brand_chk CHECK (brand IN ('sublime','basico'));
ALTER TABLE public.sublime_merch_shipments ADD CONSTRAINT sublime_merch_shipments_brand_chk CHECK (brand IN ('sublime','basico'));
ALTER TABLE public.sublime_merch_boxes ADD CONSTRAINT sublime_merch_boxes_brand_chk CHECK (brand IN ('sublime','basico'));
ALTER TABLE public.sublime_merch_pricing_rules ADD CONSTRAINT sublime_merch_pricing_rules_brand_chk CHECK (brand IN ('sublime','basico'));

ALTER TABLE public.sublime_merch_pricing_rules DROP CONSTRAINT IF EXISTS sublime_merch_pricing_rules_product_type_key;
DROP INDEX IF EXISTS public.sublime_merch_pricing_rules_product_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS sublime_merch_pricing_rules_brand_type_key ON public.sublime_merch_pricing_rules (brand, product_type);

ALTER TABLE public.sublime_merch_items DROP CONSTRAINT IF EXISTS sublime_merch_items_sku_web_key;
DROP INDEX IF EXISTS public.sublime_merch_items_sku_web_key;
CREATE UNIQUE INDEX IF NOT EXISTS sublime_merch_items_brand_sku_web_key ON public.sublime_merch_items (brand, sku_web) WHERE sku_web IS NOT NULL;

ALTER TABLE public.sublime_merch_shipments DROP CONSTRAINT IF EXISTS sublime_merch_shipments_shipment_number_key;
DROP INDEX IF EXISTS public.sublime_merch_shipments_shipment_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS sublime_merch_shipments_brand_number_key ON public.sublime_merch_shipments (brand, shipment_number);

CREATE INDEX IF NOT EXISTS idx_sublime_merch_items_brand ON public.sublime_merch_items (brand);
CREATE INDEX IF NOT EXISTS idx_sublime_merch_shipments_brand ON public.sublime_merch_shipments (brand);
CREATE INDEX IF NOT EXISTS idx_sublime_merch_boxes_brand ON public.sublime_merch_boxes (brand);