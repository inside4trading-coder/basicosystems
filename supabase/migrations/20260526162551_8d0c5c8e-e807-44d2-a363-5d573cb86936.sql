
ALTER TABLE public.core_products
  ADD COLUMN IF NOT EXISTS product_priority text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS replenishment_mode text NOT NULL DEFAULT 'manual_review';

CREATE INDEX IF NOT EXISTS idx_core_products_priority ON public.core_products(product_priority);
