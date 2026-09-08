-- LOCATIONS
CREATE TABLE public.sublime_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'store' CHECK (type IN ('store','warehouse','popup','external')),
  is_active boolean NOT NULL DEFAULT true,
  sells_in_pos boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_locations TO authenticated;
GRANT ALL ON public.sublime_locations TO service_role;
ALTER TABLE public.sublime_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_locations_read" ON public.sublime_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "sublime_locations_write" ON public.sublime_locations FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime')) WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE TRIGGER trg_sublime_locations_updated BEFORE UPDATE ON public.sublime_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCTS
CREATE TABLE public.sublime_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL DEFAULT 'sublime',
  category text,
  product_type text,
  main_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  woo_product_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_products TO authenticated;
GRANT ALL ON public.sublime_products TO service_role;
ALTER TABLE public.sublime_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_products_read" ON public.sublime_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "sublime_products_write" ON public.sublime_products FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime')) WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE TRIGGER trg_sublime_products_updated BEFORE UPDATE ON public.sublime_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_sublime_products_brand_name ON public.sublime_products (brand, lower(name));

-- VARIANTS
CREATE TABLE public.sublime_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.sublime_products(id) ON DELETE CASCADE,
  size text,
  color text,
  sku text,
  barcode text,
  full_price_ref numeric(12,2),
  current_price_ref numeric(12,2),
  discount_pct numeric(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN full_price_ref IS NULL OR current_price_ref IS NULL OR full_price_ref <= 0 THEN 0
      WHEN current_price_ref >= full_price_ref THEN 0
      ELSE round(((full_price_ref - current_price_ref) / full_price_ref) * 100, 2)
    END
  ) STORED,
  is_active boolean NOT NULL DEFAULT true,
  pos_enabled boolean NOT NULL DEFAULT false,
  woo_variation_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_variants TO authenticated;
GRANT ALL ON public.sublime_variants TO service_role;
ALTER TABLE public.sublime_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_variants_read" ON public.sublime_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "sublime_variants_write" ON public.sublime_variants FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime')) WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE TRIGGER trg_sublime_variants_updated BEFORE UPDATE ON public.sublime_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE UNIQUE INDEX uq_sublime_variants_sku ON public.sublime_variants (sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX uq_sublime_variants_combo ON public.sublime_variants (product_id, coalesce(size,''), coalesce(color,''));

-- STOCKS
CREATE TABLE public.sublime_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.sublime_variants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.sublime_locations(id) ON DELETE CASCADE,
  quantity_on_hand integer NOT NULL DEFAULT 0,
  quantity_reserved integer NOT NULL DEFAULT 0,
  quantity_available integer GENERATED ALWAYS AS (greatest(quantity_on_hand - quantity_reserved, 0)) STORED,
  last_counted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, location_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_stocks TO authenticated;
GRANT ALL ON public.sublime_stocks TO service_role;
ALTER TABLE public.sublime_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_stocks_read" ON public.sublime_stocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "sublime_stocks_write" ON public.sublime_stocks FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime')) WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE TRIGGER trg_sublime_stocks_updated BEFORE UPDATE ON public.sublime_stocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- VARIANT LOTS (link to Abastecimiento + financial layer)
CREATE TABLE public.sublime_variant_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.sublime_variants(id) ON DELETE CASCADE,
  merch_item_id uuid NOT NULL REFERENCES public.sublime_merch_items(id) ON DELETE CASCADE,
  size text,
  qty_from_lot integer NOT NULL DEFAULT 0,
  unit_cost_ref numeric(12,2),
  shipment_id uuid,
  is_consignment boolean NOT NULL DEFAULT false,
  consignment_commission_pct numeric(6,2),
  consignment_commission_amount numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merch_item_id, variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_variant_lots TO authenticated;
GRANT ALL ON public.sublime_variant_lots TO service_role;
ALTER TABLE public.sublime_variant_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_variant_lots_read" ON public.sublime_variant_lots FOR SELECT TO authenticated USING (true);
CREATE POLICY "sublime_variant_lots_write" ON public.sublime_variant_lots FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime')) WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE TRIGGER trg_sublime_variant_lots_updated BEFORE UPDATE ON public.sublime_variant_lots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STOCK INTAKE PROPOSALS
CREATE TABLE public.sublime_stock_intake_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.sublime_variants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.sublime_locations(id) ON DELETE CASCADE,
  suggested_qty integer NOT NULL DEFAULT 0,
  counted_qty integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','discarded')),
  source_merch_item_id uuid,
  note text,
  confirmed_at timestamptz,
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, location_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_stock_intake_proposals TO authenticated;
GRANT ALL ON public.sublime_stock_intake_proposals TO service_role;
ALTER TABLE public.sublime_stock_intake_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_intake_read" ON public.sublime_stock_intake_proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "sublime_intake_write" ON public.sublime_stock_intake_proposals FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime')) WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE TRIGGER trg_sublime_intake_updated BEFORE UPDATE ON public.sublime_stock_intake_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ubicaciones iniciales
INSERT INTO public.sublime_locations (name, code, type, sells_in_pos)
VALUES ('Sublime Barquicenter', 'BQ', 'store', true),
       ('Almacén Sublime', 'WH', 'warehouse', false);
