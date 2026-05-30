
-- Productos
CREATE TABLE public.esp_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  product_type text,
  category text,
  color text,
  description text,
  status text NOT NULL DEFAULT 'active',
  is_sellable boolean NOT NULL DEFAULT true,
  is_made_to_order boolean NOT NULL DEFAULT false,
  has_variants boolean NOT NULL DEFAULT true,
  price_eur numeric,
  cost_eur numeric,
  woo_product_id bigint,
  image_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_products TO authenticated;
GRANT ALL ON public.esp_products TO service_role;
ALTER TABLE public.esp_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_products read auth" ON public.esp_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_products write admin/manager" ON public.esp_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));
CREATE TRIGGER trg_esp_products_updated BEFORE UPDATE ON public.esp_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Variantes
CREATE TABLE public.esp_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.esp_products(id) ON DELETE CASCADE,
  variant_sku text UNIQUE NOT NULL,
  size text,
  color text,
  barcode text,
  qr_code text,
  scan_code text,
  status text NOT NULL DEFAULT 'active',
  price_eur numeric,
  cost_eur numeric,
  woo_variation_id bigint,
  sort_order int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_product_variants TO authenticated;
GRANT ALL ON public.esp_product_variants TO service_role;
ALTER TABLE public.esp_product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_variants read auth" ON public.esp_product_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_variants write admin/manager" ON public.esp_product_variants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));
CREATE TRIGGER trg_esp_variants_updated BEFORE UPDATE ON public.esp_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto fill scan_code with variant_sku if missing
CREATE OR REPLACE FUNCTION public.esp_variants_default_scan_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.scan_code IS NULL OR NEW.scan_code = '' THEN
    NEW.scan_code := COALESCE(NULLIF(NEW.barcode,''), NULLIF(NEW.qr_code,''), NEW.variant_sku);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_esp_variants_scan BEFORE INSERT OR UPDATE ON public.esp_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.esp_variants_default_scan_code();

-- Stock
CREATE TABLE public.esp_inventory_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.esp_locations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.esp_products(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.esp_product_variants(id) ON DELETE CASCADE,
  quantity_on_hand integer NOT NULL DEFAULT 0,
  quantity_reserved integer NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(location_id, variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_inventory_stock TO authenticated;
GRANT ALL ON public.esp_inventory_stock TO service_role;
ALTER TABLE public.esp_inventory_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_stock read auth" ON public.esp_inventory_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_stock write admin/manager" ON public.esp_inventory_stock
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));
CREATE TRIGGER trg_esp_stock_updated BEFORE UPDATE ON public.esp_inventory_stock
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_esp_stock_variant ON public.esp_inventory_stock(variant_id);
CREATE INDEX idx_esp_stock_location ON public.esp_inventory_stock(location_id);

-- Movements
CREATE TABLE public.esp_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type text NOT NULL,
  location_id uuid REFERENCES public.esp_locations(id),
  from_location_id uuid REFERENCES public.esp_locations(id),
  to_location_id uuid REFERENCES public.esp_locations(id),
  product_id uuid NOT NULL REFERENCES public.esp_products(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.esp_product_variants(id) ON DELETE CASCADE,
  quantity integer NOT NULL,
  quantity_before integer,
  quantity_after integer,
  reason text,
  reference_type text,
  reference_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT ON public.esp_inventory_movements TO authenticated;
GRANT ALL ON public.esp_inventory_movements TO service_role;
ALTER TABLE public.esp_inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_movs read auth" ON public.esp_inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_movs insert admin/manager" ON public.esp_inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX idx_esp_movs_variant ON public.esp_inventory_movements(variant_id);
CREATE INDEX idx_esp_movs_created ON public.esp_inventory_movements(created_at DESC);

-- Apply movement RPC: ensures atomic stock update + movement log
CREATE OR REPLACE FUNCTION public.esp_apply_movement(
  p_movement_type text,
  p_variant_id uuid,
  p_quantity integer,
  p_location_id uuid DEFAULT NULL,
  p_from_location_id uuid DEFAULT NULL,
  p_to_location_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_allow_negative boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product uuid;
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_before int;
  v_after int;
  v_delta int;
BEGIN
  v_is_priv := public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;

  SELECT product_id INTO v_product FROM public.esp_product_variants WHERE id = p_variant_id;
  IF v_product IS NULL THEN RAISE EXCEPTION 'Variante no encontrada'; END IF;

  IF p_movement_type IN ('initial_stock','manual_in','return','fabrication_in') THEN
    IF p_location_id IS NULL THEN RAISE EXCEPTION 'Sede requerida'; END IF;
    v_delta := p_quantity;
    INSERT INTO public.esp_inventory_stock(location_id, product_id, variant_id, quantity_on_hand, updated_by)
    VALUES (p_location_id, v_product, p_variant_id, 0, v_uid)
    ON CONFLICT (location_id, variant_id) DO NOTHING;
    SELECT quantity_on_hand INTO v_before FROM public.esp_inventory_stock WHERE location_id=p_location_id AND variant_id=p_variant_id;
    v_after := v_before + v_delta;
    UPDATE public.esp_inventory_stock SET quantity_on_hand = v_after, updated_by = v_uid, updated_at = now()
      WHERE location_id=p_location_id AND variant_id=p_variant_id;
    INSERT INTO public.esp_inventory_movements(movement_type, location_id, product_id, variant_id, quantity, quantity_before, quantity_after, reason, notes, created_by)
      VALUES (p_movement_type, p_location_id, v_product, p_variant_id, v_delta, v_before, v_after, p_reason, p_notes, v_uid);

  ELSIF p_movement_type IN ('manual_out','sale_pos','sale_woo','fabrication_out') THEN
    IF p_location_id IS NULL THEN RAISE EXCEPTION 'Sede requerida'; END IF;
    SELECT quantity_on_hand INTO v_before FROM public.esp_inventory_stock WHERE location_id=p_location_id AND variant_id=p_variant_id;
    IF v_before IS NULL THEN v_before := 0; END IF;
    IF v_before < p_quantity AND NOT p_allow_negative THEN RAISE EXCEPTION 'Stock insuficiente'; END IF;
    v_after := v_before - p_quantity;
    INSERT INTO public.esp_inventory_stock(location_id, product_id, variant_id, quantity_on_hand, updated_by)
      VALUES (p_location_id, v_product, p_variant_id, v_after, v_uid)
      ON CONFLICT (location_id, variant_id) DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_by = v_uid, updated_at = now();
    INSERT INTO public.esp_inventory_movements(movement_type, location_id, product_id, variant_id, quantity, quantity_before, quantity_after, reason, notes, created_by)
      VALUES (p_movement_type, p_location_id, v_product, p_variant_id, p_quantity, v_before, v_after, p_reason, p_notes, v_uid);

  ELSIF p_movement_type = 'adjustment' THEN
    IF p_location_id IS NULL THEN RAISE EXCEPTION 'Sede requerida'; END IF;
    IF p_reason IS NULL OR p_reason = '' THEN RAISE EXCEPTION 'Motivo requerido'; END IF;
    INSERT INTO public.esp_inventory_stock(location_id, product_id, variant_id, quantity_on_hand, updated_by)
      VALUES (p_location_id, v_product, p_variant_id, 0, v_uid)
      ON CONFLICT (location_id, variant_id) DO NOTHING;
    SELECT quantity_on_hand INTO v_before FROM public.esp_inventory_stock WHERE location_id=p_location_id AND variant_id=p_variant_id;
    v_after := p_quantity; -- absolute set
    UPDATE public.esp_inventory_stock SET quantity_on_hand = v_after, updated_by = v_uid, updated_at = now()
      WHERE location_id=p_location_id AND variant_id=p_variant_id;
    INSERT INTO public.esp_inventory_movements(movement_type, location_id, product_id, variant_id, quantity, quantity_before, quantity_after, reason, notes, created_by)
      VALUES ('adjustment', p_location_id, v_product, p_variant_id, v_after - v_before, v_before, v_after, p_reason, p_notes, v_uid);

  ELSIF p_movement_type = 'transfer' THEN
    IF p_from_location_id IS NULL OR p_to_location_id IS NULL THEN RAISE EXCEPTION 'Sedes requeridas'; END IF;
    IF p_from_location_id = p_to_location_id THEN RAISE EXCEPTION 'Sedes deben diferir'; END IF;
    -- OUT
    SELECT quantity_on_hand INTO v_before FROM public.esp_inventory_stock WHERE location_id=p_from_location_id AND variant_id=p_variant_id;
    IF v_before IS NULL THEN v_before := 0; END IF;
    IF v_before < p_quantity AND NOT p_allow_negative THEN RAISE EXCEPTION 'Stock insuficiente en origen'; END IF;
    v_after := v_before - p_quantity;
    INSERT INTO public.esp_inventory_stock(location_id, product_id, variant_id, quantity_on_hand, updated_by)
      VALUES (p_from_location_id, v_product, p_variant_id, v_after, v_uid)
      ON CONFLICT (location_id, variant_id) DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_by = v_uid, updated_at = now();
    INSERT INTO public.esp_inventory_movements(movement_type, location_id, from_location_id, to_location_id, product_id, variant_id, quantity, quantity_before, quantity_after, reason, notes, created_by)
      VALUES ('transfer_out', p_from_location_id, p_from_location_id, p_to_location_id, v_product, p_variant_id, p_quantity, v_before, v_after, p_reason, p_notes, v_uid);
    -- IN
    INSERT INTO public.esp_inventory_stock(location_id, product_id, variant_id, quantity_on_hand, updated_by)
      VALUES (p_to_location_id, v_product, p_variant_id, 0, v_uid)
      ON CONFLICT (location_id, variant_id) DO NOTHING;
    SELECT quantity_on_hand INTO v_before FROM public.esp_inventory_stock WHERE location_id=p_to_location_id AND variant_id=p_variant_id;
    v_after := v_before + p_quantity;
    UPDATE public.esp_inventory_stock SET quantity_on_hand = v_after, updated_by = v_uid, updated_at = now()
      WHERE location_id=p_to_location_id AND variant_id=p_variant_id;
    INSERT INTO public.esp_inventory_movements(movement_type, location_id, from_location_id, to_location_id, product_id, variant_id, quantity, quantity_before, quantity_after, reason, notes, created_by)
      VALUES ('transfer_in', p_to_location_id, p_from_location_id, p_to_location_id, v_product, p_variant_id, p_quantity, v_before, v_after, p_reason, p_notes, v_uid);
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_movement_type;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.esp_apply_movement(text,uuid,integer,uuid,uuid,uuid,text,text,boolean) TO authenticated;
