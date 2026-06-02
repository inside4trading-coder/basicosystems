
-- Política operativa de productos España (fabricación ligera vs stock físico)
ALTER TABLE public.esp_products
  ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'made_to_order',
  ADD COLUMN IF NOT EXISTS web_stock_policy text NOT NULL DEFAULT 'no_web_stock',
  ADD COLUMN IF NOT EXISTS requires_fabrication boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS woo_manage_stock boolean,
  ADD COLUMN IF NOT EXISTS woo_stock_status text,
  ADD COLUMN IF NOT EXISTS woo_stock_quantity integer;

-- Asegurar is_made_to_order existe (ya existe según uso previo) y default true
ALTER TABLE public.esp_products
  ALTER COLUMN is_made_to_order SET DEFAULT true;

-- Variantes: políticas Woo informativas + override opcional de política operativa
ALTER TABLE public.esp_product_variants
  ADD COLUMN IF NOT EXISTS woo_manage_stock boolean,
  ADD COLUMN IF NOT EXISTS woo_stock_status text,
  ADD COLUMN IF NOT EXISTS fulfillment_mode text,
  ADD COLUMN IF NOT EXISTS requires_fabrication boolean;
-- woo_stock_quantity ya existe

-- Validación de valores
DO $$ BEGIN
  ALTER TABLE public.esp_products
    ADD CONSTRAINT esp_products_fulfillment_mode_chk
    CHECK (fulfillment_mode IN ('made_to_order','physical_stock','hybrid','manual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.esp_products
    ADD CONSTRAINT esp_products_web_stock_policy_chk
    CHECK (web_stock_policy IN ('no_web_stock','woo_managed_stock','hub_managed_stock','manual_review'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.esp_product_variants
    ADD CONSTRAINT esp_product_variants_fulfillment_mode_chk
    CHECK (fulfillment_mode IS NULL OR fulfillment_mode IN ('made_to_order','physical_stock','hybrid','manual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Settings: política global de stock web
ALTER TABLE public.esp_settings
  ADD COLUMN IF NOT EXISTS interpret_woo_unmanaged_as_made_to_order boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_create_fabrication_for_mto boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_decrement_web_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS web_stock_location_id uuid;

-- Backfill: productos Woo ES con manage_stock conocido se reclasifican.
-- (Si no hay dato aún, se quedan como made_to_order por default; el próximo sync los actualiza.)
