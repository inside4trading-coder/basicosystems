
CREATE SEQUENCE IF NOT EXISTS public.esp_sale_number_seq;

CREATE TABLE public.esp_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text UNIQUE NOT NULL,
  sale_date timestamptz NOT NULL DEFAULT now(),
  channel_id uuid REFERENCES public.esp_sales_channels(id),
  location_id uuid REFERENCES public.esp_locations(id),
  inventory_location_id uuid REFERENCES public.esp_locations(id),
  user_id uuid,
  status text NOT NULL DEFAULT 'completed',
  subtotal_eur numeric NOT NULL DEFAULT 0,
  discount_eur numeric NOT NULL DEFAULT 0,
  total_eur numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'paid',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.esp_sales TO authenticated;
GRANT ALL ON public.esp_sales TO service_role;
ALTER TABLE public.esp_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_sales read auth" ON public.esp_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_sales write admin/manager" ON public.esp_sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE TRIGGER trg_esp_sales_updated BEFORE UPDATE ON public.esp_sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_esp_sales_date ON public.esp_sales(sale_date DESC);

CREATE TABLE public.esp_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.esp_sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.esp_products(id),
  variant_id uuid NOT NULL REFERENCES public.esp_product_variants(id),
  sku_snapshot text,
  product_name_snapshot text,
  variant_label_snapshot text,
  quantity integer NOT NULL,
  unit_price_eur numeric NOT NULL,
  subtotal_eur numeric NOT NULL,
  inventory_movement_id uuid REFERENCES public.esp_inventory_movements(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.esp_sale_items TO authenticated;
GRANT ALL ON public.esp_sale_items TO service_role;
ALTER TABLE public.esp_sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_sale_items read auth" ON public.esp_sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_sale_items insert admin/manager" ON public.esp_sale_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE INDEX idx_esp_sale_items_sale ON public.esp_sale_items(sale_id);

CREATE TABLE public.esp_sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.esp_sales(id) ON DELETE CASCADE,
  payment_method_id uuid REFERENCES public.esp_payment_methods(id),
  amount_eur numeric NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT ON public.esp_sale_payments TO authenticated;
GRANT ALL ON public.esp_sale_payments TO service_role;
ALTER TABLE public.esp_sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_sale_pay read auth" ON public.esp_sale_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_sale_pay insert admin/manager" ON public.esp_sale_payments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

-- RPC atómica
CREATE OR REPLACE FUNCTION public.esp_register_pos_sale(
  p_channel_id uuid,
  p_location_id uuid,
  p_payment_method_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_allow_negative boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_loc record;
  v_inv_loc uuid;
  v_sale_id uuid;
  v_sale_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_variant record;
  v_qty int;
  v_unit numeric;
  v_line_sub numeric;
  v_stock int;
  v_before int;
  v_after int;
  v_mov_id uuid;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_location_id IS NULL THEN RAISE EXCEPTION 'Sede requerida'; END IF;
  IF p_payment_method_id IS NULL THEN RAISE EXCEPTION 'Método de pago requerido'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Carrito vacío'; END IF;

  SELECT * INTO v_loc FROM public.esp_locations WHERE id = p_location_id AND is_active = true;
  IF v_loc.id IS NULL THEN RAISE EXCEPTION 'Sede inválida'; END IF;
  IF v_loc.inventory_mode NOT IN ('own_stock','linked_stock') THEN
    RAISE EXCEPTION 'Sede no permite POS (modo: %)', v_loc.inventory_mode;
  END IF;
  v_inv_loc := CASE WHEN v_loc.inventory_mode='linked_stock' AND v_loc.linked_location_id IS NOT NULL
                    THEN v_loc.linked_location_id ELSE p_location_id END;

  v_sale_number := 'ES-POS-' || LPAD(nextval('public.esp_sale_number_seq')::text, 6, '0');

  INSERT INTO public.esp_sales(sale_number, channel_id, location_id, inventory_location_id, user_id, status, subtotal_eur, total_eur, payment_status, notes, created_by)
    VALUES (v_sale_number, p_channel_id, p_location_id, v_inv_loc, v_uid, 'completed', 0, 0, 'paid', p_notes, v_uid)
    RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;

    SELECT v.id, v.product_id, v.variant_sku, v.size, v.color, v.status, v.price_eur AS v_price,
           p.name AS p_name, p.status AS p_status, p.price_eur AS p_price
      INTO v_variant
      FROM public.esp_product_variants v
      JOIN public.esp_products p ON p.id = v.product_id
      WHERE v.id = (v_item->>'variant_id')::uuid;
    IF v_variant.id IS NULL THEN RAISE EXCEPTION 'Variante no encontrada'; END IF;
    IF v_variant.status <> 'active' THEN RAISE EXCEPTION 'Variante inactiva: %', v_variant.variant_sku; END IF;
    IF v_variant.p_status NOT IN ('active') THEN RAISE EXCEPTION 'Producto no vendible: %', v_variant.p_name; END IF;

    v_unit := COALESCE((v_item->>'unit_price_eur')::numeric, v_variant.v_price, v_variant.p_price, 0);
    v_line_sub := v_unit * v_qty;
    v_subtotal := v_subtotal + v_line_sub;

    -- descuento atómico
    SELECT quantity_on_hand INTO v_stock FROM public.esp_inventory_stock
      WHERE location_id = v_inv_loc AND variant_id = v_variant.id FOR UPDATE;
    IF v_stock IS NULL THEN v_stock := 0; END IF;
    IF v_stock < v_qty AND NOT p_allow_negative THEN
      RAISE EXCEPTION 'Stock insuficiente para % (disponible %, requerido %)', v_variant.variant_sku, v_stock, v_qty;
    END IF;
    v_before := v_stock;
    v_after := v_stock - v_qty;
    INSERT INTO public.esp_inventory_stock(location_id, product_id, variant_id, quantity_on_hand, updated_by)
      VALUES (v_inv_loc, v_variant.product_id, v_variant.id, v_after, v_uid)
      ON CONFLICT (location_id, variant_id) DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_by = v_uid, updated_at = now();

    INSERT INTO public.esp_inventory_movements(movement_type, location_id, product_id, variant_id, quantity, quantity_before, quantity_after, reason, reference_type, reference_id, created_by)
      VALUES ('sale_pos', v_inv_loc, v_variant.product_id, v_variant.id, v_qty, v_before, v_after, 'Venta POS', 'esp_sale', v_sale_id::text, v_uid)
      RETURNING id INTO v_mov_id;

    INSERT INTO public.esp_sale_items(sale_id, product_id, variant_id, sku_snapshot, product_name_snapshot, variant_label_snapshot, quantity, unit_price_eur, subtotal_eur, inventory_movement_id)
      VALUES (v_sale_id, v_variant.product_id, v_variant.id, v_variant.variant_sku, v_variant.p_name,
              COALESCE(v_variant.size,'') || CASE WHEN v_variant.color IS NOT NULL THEN ' · ' || v_variant.color ELSE '' END,
              v_qty, v_unit, v_line_sub, v_mov_id);
  END LOOP;

  v_total := v_subtotal;

  UPDATE public.esp_sales SET subtotal_eur = v_subtotal, total_eur = v_total WHERE id = v_sale_id;

  INSERT INTO public.esp_sale_payments(sale_id, payment_method_id, amount_eur, reference, created_by)
    VALUES (v_sale_id, p_payment_method_id, v_total, p_payment_reference, v_uid);

  RETURN jsonb_build_object('ok', true, 'sale_id', v_sale_id, 'sale_number', v_sale_number, 'total_eur', v_total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.esp_register_pos_sale(uuid,uuid,uuid,jsonb,text,text,boolean) TO authenticated;
