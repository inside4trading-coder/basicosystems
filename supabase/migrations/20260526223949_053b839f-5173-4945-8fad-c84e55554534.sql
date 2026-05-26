ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS product_id bigint,
  ADD COLUMN IF NOT EXISTS variation_id bigint;
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variation_id ON public.order_items(variation_id);