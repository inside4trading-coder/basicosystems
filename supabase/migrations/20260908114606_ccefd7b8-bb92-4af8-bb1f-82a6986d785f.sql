CREATE TABLE public.sublime_woo_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_product_id bigint NOT NULL,
  woo_variation_id bigint NULL,
  parent_id bigint NULL,
  woo_type text NULL,
  name text NOT NULL,
  sku text NULL,
  size_label text NULL,
  color_label text NULL,
  attributes jsonb NULL,
  price numeric NULL,
  regular_price numeric NULL,
  stock_quantity integer NULL,
  stock_status text NULL,
  woo_status text NULL,
  image_url text NULL,
  permalink text NULL,
  raw jsonb NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sublime_woo_catalog_key ON public.sublime_woo_catalog (woo_product_id, COALESCE(woo_variation_id, 0));
CREATE INDEX sublime_woo_catalog_sku_idx ON public.sublime_woo_catalog (lower(sku)) WHERE sku IS NOT NULL;
GRANT SELECT ON public.sublime_woo_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_woo_catalog TO authenticated;
GRANT ALL ON public.sublime_woo_catalog TO service_role;
ALTER TABLE public.sublime_woo_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY sublime_woo_catalog_read ON public.sublime_woo_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY sublime_woo_catalog_write ON public.sublime_woo_catalog FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime')) WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE TRIGGER sublime_woo_catalog_updated BEFORE UPDATE ON public.sublime_woo_catalog FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sublime_channel_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'woo',
  product_id uuid NULL REFERENCES public.sublime_products(id) ON DELETE CASCADE,
  variant_id uuid NULL REFERENCES public.sublime_variants(id) ON DELETE CASCADE,
  external_product_id bigint NOT NULL,
  external_variation_id bigint NULL,
  status text NOT NULL DEFAULT 'mapped' CHECK (status IN ('mapped','ignored')),
  match_method text NOT NULL DEFAULT 'manual' CHECK (match_method IN ('saved_id','sku','reference','manual')),
  mapped_by uuid NULL,
  mapped_at timestamptz NOT NULL DEFAULT now(),
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sublime_channel_mappings_ext_key ON public.sublime_channel_mappings (channel, external_product_id, COALESCE(external_variation_id, 0));
CREATE INDEX sublime_channel_mappings_variant_idx ON public.sublime_channel_mappings (variant_id);
CREATE INDEX sublime_channel_mappings_product_idx ON public.sublime_channel_mappings (product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_channel_mappings TO authenticated;
GRANT ALL ON public.sublime_channel_mappings TO service_role;
ALTER TABLE public.sublime_channel_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY sublime_channel_mappings_read ON public.sublime_channel_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY sublime_channel_mappings_write ON public.sublime_channel_mappings FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime')) WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE TRIGGER sublime_channel_mappings_updated BEFORE UPDATE ON public.sublime_channel_mappings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sublime_variants
  ADD COLUMN IF NOT EXISTS cost_ref numeric NULL,
  ADD COLUMN IF NOT EXISTS cost_source text NULL CHECK (cost_source IS NULL OR cost_source IN ('abastecimiento','historico_manual','estimado','consignacion','otro')),
  ADD COLUMN IF NOT EXISTS cost_note text NULL;

ALTER TABLE public.sublime_stock_intake_proposals
  ADD COLUMN IF NOT EXISTS woo_qty integer NULL;