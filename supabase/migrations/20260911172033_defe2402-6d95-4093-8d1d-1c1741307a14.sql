CREATE TABLE public.sublime_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  id_card text,
  phone text,
  email text,
  birth_date date,
  address text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sublime_customers TO authenticated;
GRANT ALL ON public.sublime_customers TO service_role;
ALTER TABLE public.sublime_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_customers_read" ON public.sublime_customers FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_customers_write" ON public.sublime_customers FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_customers_update" ON public.sublime_customers FOR UPDATE TO authenticated USING (public.has_module_access(auth.uid(), '/sublime')) WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE INDEX idx_sublime_customers_name ON public.sublime_customers (lower(name));

CREATE TABLE public.sublime_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text NOT NULL UNIQUE,
  location_id uuid NOT NULL REFERENCES public.sublime_locations(id),
  sale_origin text NOT NULL,
  origin_detail text,
  customer_id uuid REFERENCES public.sublime_customers(id),
  customer_name text,
  invoice_number text,
  note text,
  subtotal_regular_ref numeric(12,2) NOT NULL DEFAULT 0,
  discount_total_ref numeric(12,2) NOT NULL DEFAULT 0,
  total_ref numeric(12,2) NOT NULL DEFAULT 0,
  tax_included_ref numeric(12,2) NOT NULL DEFAULT 0,
  bcv_rate numeric(14,4) NOT NULL DEFAULT 0,
  units integer NOT NULL DEFAULT 0,
  register_code text,
  cashier_code text,
  session_code text,
  status text NOT NULL DEFAULT 'completed',
  idempotency_key text NOT NULL UNIQUE,
  sold_by uuid,
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sublime_sales TO authenticated;
GRANT ALL ON public.sublime_sales TO service_role;
ALTER TABLE public.sublime_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_sales_read" ON public.sublime_sales FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_sales_write" ON public.sublime_sales FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE INDEX idx_sublime_sales_sold_at ON public.sublime_sales (sold_at DESC);

CREATE TABLE public.sublime_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sublime_sales(id) ON DELETE CASCADE,
  line_kind text NOT NULL DEFAULT 'catalog',
  product_id uuid REFERENCES public.sublime_products(id),
  variant_id uuid REFERENCES public.sublime_variants(id),
  sku text,
  title text NOT NULL,
  subtitle text,
  qty integer NOT NULL CHECK (qty > 0),
  unit_regular_ref numeric(12,2) NOT NULL DEFAULT 0,
  unit_final_ref numeric(12,2) NOT NULL DEFAULT 0,
  discount_ref numeric(12,2) NOT NULL DEFAULT 0,
  line_total_ref numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sublime_sale_items TO authenticated;
GRANT ALL ON public.sublime_sale_items TO service_role;
ALTER TABLE public.sublime_sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_sale_items_read" ON public.sublime_sale_items FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_sale_items_write" ON public.sublime_sale_items FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE INDEX idx_sublime_sale_items_sale ON public.sublime_sale_items (sale_id);

CREATE TABLE public.sublime_sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sublime_sales(id) ON DELETE CASCADE,
  method text NOT NULL,
  currency text NOT NULL,
  amount numeric(14,2) NOT NULL,
  amount_ref numeric(12,2) NOT NULL,
  bank text,
  reference text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sublime_sale_payments TO authenticated;
GRANT ALL ON public.sublime_sale_payments TO service_role;
ALTER TABLE public.sublime_sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_sale_payments_read" ON public.sublime_sale_payments FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_sale_payments_write" ON public.sublime_sale_payments FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE INDEX idx_sublime_sale_payments_sale ON public.sublime_sale_payments (sale_id);

CREATE TRIGGER trg_sublime_customers_updated BEFORE UPDATE ON public.sublime_customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sublime_sales_updated BEFORE UPDATE ON public.sublime_sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sublime_register_pos_sale(
  p_idempotency_key text,
  p_location_id uuid,
  p_sale_origin text,
  p_items jsonb,
  p_payments jsonb,
  p_origin_detail text DEFAULT NULL,
  p_customer jsonb DEFAULT NULL,
  p_invoice_number text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_bcv_rate numeric DEFAULT 0,
  p_register_code text DEFAULT NULL,
  p_cashier_code text DEFAULT NULL,
  p_session_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_existing public.sublime_sales%ROWTYPE;
  v_item jsonb;
  v_pay jsonb;
  v_qty integer;
  v_variant public.sublime_variants%ROWTYPE;
  v_stock public.sublime_stocks%ROWTYPE;
  v_new_qty integer;
  v_customer_id uuid;
  v_customer_name text;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_units integer := 0;
  v_number text;
  v_seq bigint;
BEGIN
  IF v_uid IS NULL OR NOT public.has_module_access(v_uid, '/sublime') THEN
    RAISE EXCEPTION 'Sin permisos para registrar ventas de Sublime.';
  END IF;
  IF coalesce(trim(p_idempotency_key), '') = '' THEN
    RAISE EXCEPTION 'Falta el identificador del intento de cobro.';
  END IF;
  IF coalesce(trim(p_sale_origin), '') = '' THEN
    RAISE EXCEPTION 'El origen de la venta es obligatorio.';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene líneas.';
  END IF;

  SELECT * INTO v_existing FROM public.sublime_sales WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('sale_id', v_existing.id, 'sale_number', v_existing.sale_number, 'duplicate', true);
  END IF;

  IF p_customer IS NOT NULL AND coalesce(trim(p_customer->>'name'), '') <> '' THEN
    v_customer_name := trim(p_customer->>'name');
    IF coalesce(p_customer->>'id', '') <> '' THEN
      v_customer_id := (p_customer->>'id')::uuid;
    ELSE
      SELECT id INTO v_customer_id FROM public.sublime_customers
      WHERE (coalesce(trim(p_customer->>'id_card'), '') <> '' AND lower(coalesce(id_card,'')) = lower(trim(p_customer->>'id_card')))
         OR lower(name) = lower(v_customer_name)
      LIMIT 1;
      IF v_customer_id IS NULL THEN
        INSERT INTO public.sublime_customers (name, id_card, phone, email, birth_date, address, created_by)
        VALUES (
          v_customer_name,
          nullif(trim(coalesce(p_customer->>'id_card','')), ''),
          nullif(trim(coalesce(p_customer->>'phone','')), ''),
          nullif(trim(coalesce(p_customer->>'email','')), ''),
          nullif(trim(coalesce(p_customer->>'birth_date','')), '')::date,
          nullif(trim(coalesce(p_customer->>'address','')), ''),
          v_uid
        )
        RETURNING id INTO v_customer_id;
      END IF;
    END IF;
  END IF;

  SELECT count(*) + 1 INTO v_seq FROM public.sublime_sales WHERE sold_at >= date_trunc('year', now());
  v_number := 'SPOS-' || to_char(now(), 'YY') || '-' || lpad(v_seq::text, 5, '0');

  INSERT INTO public.sublime_sales (
    sale_number, location_id, sale_origin, origin_detail, customer_id, customer_name,
    invoice_number, note, bcv_rate, register_code, cashier_code, session_code,
    idempotency_key, sold_by
  ) VALUES (
    v_number, p_location_id, p_sale_origin, nullif(trim(coalesce(p_origin_detail,'')), ''),
    v_customer_id, v_customer_name,
    nullif(trim(coalesce(p_invoice_number,'')), ''), nullif(trim(coalesce(p_note,'')), ''),
    coalesce(p_bcv_rate, 0), p_register_code, p_cashier_code, p_session_code,
    p_idempotency_key, v_uid
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := coalesce((v_item->>'qty')::int, 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en la venta.';
    END IF;

    IF coalesce(v_item->>'line_kind', 'catalog') = 'catalog' THEN
      SELECT * INTO v_variant FROM public.sublime_variants
      WHERE id = (v_item->>'variant_id')::uuid FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'La variante ya no existe.';
      END IF;
      IF NOT v_variant.is_active THEN
        RAISE EXCEPTION 'La variante % ya no está activa.', coalesce(v_variant.sku, v_variant.id::text);
      END IF;

      SELECT * INTO v_stock FROM public.sublime_stocks
      WHERE variant_id = v_variant.id AND location_id = p_location_id FOR UPDATE;
      IF NOT FOUND OR coalesce(v_stock.quantity_on_hand, 0) - coalesce(v_stock.quantity_reserved, 0) < v_qty THEN
        RAISE EXCEPTION 'Stock insuficiente. La disponibilidad cambió (%).', coalesce(v_variant.sku, 'sin SKU');
      END IF;

      v_new_qty := v_stock.quantity_on_hand - v_qty;
      UPDATE public.sublime_stocks SET quantity_on_hand = v_new_qty, updated_at = now() WHERE id = v_stock.id;

      INSERT INTO public.sublime_inventory_movements (
        variant_id, location_id, movement_type, qty_delta, qty_result, performed_by, note
      ) VALUES (
        v_variant.id, p_location_id, 'pos_sale', -v_qty, v_new_qty, v_uid,
        'Venta POS ' || v_number || ' · ' || coalesce(v_variant.sku, 'sin SKU')
      );

      IF v_new_qty <= 0 THEN
        UPDATE public.sublime_variants SET pos_enabled = false, updated_at = now() WHERE id = v_variant.id;
      END IF;
    END IF;

    INSERT INTO public.sublime_sale_items (
      sale_id, line_kind, product_id, variant_id, sku, title, subtitle, qty,
      unit_regular_ref, unit_final_ref, discount_ref, line_total_ref
    ) VALUES (
      v_sale_id,
      coalesce(v_item->>'line_kind', 'catalog'),
      nullif(v_item->>'product_id', '')::uuid,
      nullif(v_item->>'variant_id', '')::uuid,
      nullif(v_item->>'sku', ''),
      coalesce(v_item->>'title', 'Línea'),
      nullif(v_item->>'subtitle', ''),
      v_qty,
      coalesce((v_item->>'unit_regular_ref')::numeric, 0),
      coalesce((v_item->>'unit_final_ref')::numeric, 0),
      coalesce((v_item->>'discount_ref')::numeric, 0),
      coalesce((v_item->>'line_total_ref')::numeric, 0)
    );

    v_units := v_units + v_qty;
    v_subtotal := v_subtotal + coalesce((v_item->>'unit_regular_ref')::numeric, 0) * v_qty;
    v_discount := v_discount + coalesce((v_item->>'discount_ref')::numeric, 0);
    v_total := v_total + coalesce((v_item->>'line_total_ref')::numeric, 0);
  END LOOP;

  IF p_payments IS NOT NULL THEN
    FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
      INSERT INTO public.sublime_sale_payments (sale_id, method, currency, amount, amount_ref, bank, reference, extra)
      VALUES (
        v_sale_id,
        coalesce(v_pay->>'method', 'otro'),
        coalesce(v_pay->>'currency', 'USD'),
        coalesce((v_pay->>'amount')::numeric, 0),
        coalesce((v_pay->>'amount_ref')::numeric, 0),
        nullif(v_pay->>'bank', ''),
        nullif(v_pay->>'reference', ''),
        coalesce(v_pay->'extra', '{}'::jsonb)
      );
    END LOOP;
  END IF;

  UPDATE public.sublime_sales SET
    subtotal_regular_ref = round(v_subtotal, 2),
    discount_total_ref = round(v_discount, 2),
    total_ref = round(v_total, 2),
    tax_included_ref = round(v_total - v_total / 1.16, 2),
    units = v_units,
    updated_at = now()
  WHERE id = v_sale_id;

  RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_number, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.sublime_register_pos_sale(text, uuid, text, jsonb, jsonb, text, jsonb, text, text, numeric, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.sublime_register_pos_sale(text, uuid, text, jsonb, jsonb, text, jsonb, text, text, numeric, text, text, text) TO authenticated;