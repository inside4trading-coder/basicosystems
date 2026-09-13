CREATE TABLE public.sublime_suspended_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_number text NOT NULL UNIQUE,
  location_id uuid,
  register_id uuid REFERENCES public.sublime_registers(id),
  register_code text,
  origin_cash_session_id uuid REFERENCES public.sublime_cash_sessions(id),
  origin_session_code text,
  cashier_code text,
  customer_id uuid REFERENCES public.sublime_customers(id),
  customer_name text,
  sale_origin text,
  origin_detail text,
  note text,
  cart_discount_ref numeric NOT NULL DEFAULT 0,
  cart_discount_reason text,
  units integer NOT NULL DEFAULT 0,
  total_ref numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  idempotency_key text UNIQUE,
  sale_id uuid REFERENCES public.sublime_sales(id),
  suspended_by uuid,
  suspended_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz,
  recovered_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sublime_suspended_carts_status_chk CHECK (status IN ('open','recovered','cancelled','converted_to_sale'))
);

CREATE TABLE public.sublime_suspended_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.sublime_suspended_carts(id) ON DELETE CASCADE,
  line_kind text NOT NULL DEFAULT 'catalog',
  product_id uuid,
  variant_id uuid,
  sku text,
  title text NOT NULL,
  subtitle text,
  qty integer NOT NULL,
  unit_regular_ref numeric NOT NULL DEFAULT 0,
  unit_final_ref numeric NOT NULL DEFAULT 0,
  line_total_ref numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sublime_susp_carts_status ON public.sublime_suspended_carts(status, suspended_at DESC);
CREATE INDEX idx_sublime_susp_items_cart ON public.sublime_suspended_cart_items(cart_id);

GRANT SELECT, INSERT, UPDATE ON public.sublime_suspended_carts TO authenticated;
GRANT ALL ON public.sublime_suspended_carts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_suspended_cart_items TO authenticated;
GRANT ALL ON public.sublime_suspended_cart_items TO service_role;

ALTER TABLE public.sublime_suspended_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sublime_suspended_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sublime_susp_carts_read" ON public.sublime_suspended_carts
FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_susp_carts_write" ON public.sublime_suspended_carts
FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_susp_carts_update" ON public.sublime_suspended_carts
FOR UPDATE TO authenticated USING (public.has_module_access(auth.uid(), '/sublime'))
WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));

CREATE POLICY "sublime_susp_items_read" ON public.sublime_suspended_cart_items
FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_susp_items_write" ON public.sublime_suspended_cart_items
FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));

CREATE TRIGGER trg_sublime_susp_carts_updated
BEFORE UPDATE ON public.sublime_suspended_carts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sublime_suspend_cart(
  p_idempotency_key text,
  p_items jsonb,
  p_location_id uuid DEFAULT NULL,
  p_register_id uuid DEFAULT NULL,
  p_register_code text DEFAULT NULL,
  p_cash_session_id uuid DEFAULT NULL,
  p_session_code text DEFAULT NULL,
  p_cashier_code text DEFAULT NULL,
  p_customer jsonb DEFAULT NULL,
  p_sale_origin text DEFAULT NULL,
  p_origin_detail text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_cart_discount_ref numeric DEFAULT 0,
  p_cart_discount_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.sublime_suspended_carts%ROWTYPE;
  v_cart_id uuid;
  v_number text;
  v_seq bigint;
  v_item jsonb;
  v_units integer := 0;
  v_total numeric := 0;
  v_customer_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.has_module_access(v_uid, '/sublime') THEN
    RAISE EXCEPTION 'Sin permisos para suspender carritos de Sublime.';
  END IF;
  IF coalesce(trim(p_idempotency_key), '') = '' THEN
    RAISE EXCEPTION 'Falta el identificador del carrito.';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El carrito está vacío.';
  END IF;

  SELECT * INTO v_existing FROM public.sublime_suspended_carts WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('cart_id', v_existing.id, 'cart_number', v_existing.cart_number, 'duplicate', true);
  END IF;

  IF p_customer IS NOT NULL AND coalesce(p_customer->>'id', '') <> '' THEN
    v_customer_id := (p_customer->>'id')::uuid;
  END IF;

  SELECT count(*) + 1 INTO v_seq FROM public.sublime_suspended_carts
  WHERE suspended_at >= date_trunc('year', now());
  v_number := 'SC-' || to_char(now(), 'YY') || '-' || lpad(v_seq::text, 5, '0');
  WHILE EXISTS (SELECT 1 FROM public.sublime_suspended_carts WHERE cart_number = v_number) LOOP
    v_seq := v_seq + 1;
    v_number := 'SC-' || to_char(now(), 'YY') || '-' || lpad(v_seq::text, 5, '0');
  END LOOP;

  INSERT INTO public.sublime_suspended_carts (
    cart_number, location_id, register_id, register_code, origin_cash_session_id,
    origin_session_code, cashier_code, customer_id, customer_name, sale_origin,
    origin_detail, note, cart_discount_ref, cart_discount_reason, idempotency_key, suspended_by
  ) VALUES (
    v_number, p_location_id, p_register_id, p_register_code, p_cash_session_id,
    p_session_code, p_cashier_code, v_customer_id, nullif(trim(coalesce(p_customer->>'name','')), ''),
    p_sale_origin, p_origin_detail, p_note, coalesce(p_cart_discount_ref, 0), p_cart_discount_reason,
    p_idempotency_key, v_uid
  ) RETURNING id INTO v_cart_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.sublime_suspended_cart_items (
      cart_id, line_kind, product_id, variant_id, sku, title, subtitle, qty,
      unit_regular_ref, unit_final_ref, line_total_ref
    ) VALUES (
      v_cart_id,
      coalesce(v_item->>'line_kind', 'catalog'),
      nullif(v_item->>'product_id','')::uuid,
      nullif(v_item->>'variant_id','')::uuid,
      nullif(v_item->>'sku',''),
      coalesce(v_item->>'title', 'Ítem'),
      v_item->>'subtitle',
      greatest(1, coalesce((v_item->>'qty')::integer, 1)),
      coalesce((v_item->>'unit_regular_ref')::numeric, 0),
      coalesce((v_item->>'unit_final_ref')::numeric, 0),
      coalesce((v_item->>'line_total_ref')::numeric, 0)
    );
    v_units := v_units + greatest(1, coalesce((v_item->>'qty')::integer, 1));
    v_total := v_total + coalesce((v_item->>'line_total_ref')::numeric, 0);
  END LOOP;

  v_total := greatest(0, v_total - coalesce(p_cart_discount_ref, 0));
  UPDATE public.sublime_suspended_carts SET units = v_units, total_ref = v_total WHERE id = v_cart_id;

  RETURN jsonb_build_object('cart_id', v_cart_id, 'cart_number', v_number, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.sublime_set_suspended_cart_status(
  p_cart_id uuid,
  p_status text,
  p_sale_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cart public.sublime_suspended_carts%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.has_module_access(v_uid, '/sublime') THEN
    RAISE EXCEPTION 'Sin permisos para gestionar carritos de Sublime.';
  END IF;
  IF p_status NOT IN ('recovered','cancelled','converted_to_sale') THEN
    RAISE EXCEPTION 'Estado no válido.';
  END IF;

  SELECT * INTO v_cart FROM public.sublime_suspended_carts WHERE id = p_cart_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El carrito suspendido ya no existe.';
  END IF;
  IF v_cart.status IN ('cancelled','converted_to_sale') THEN
    RETURN jsonb_build_object('cart_id', v_cart.id, 'status', v_cart.status, 'changed', false);
  END IF;

  UPDATE public.sublime_suspended_carts SET
    status = p_status,
    recovered_at = CASE WHEN p_status = 'recovered' THEN now() ELSE recovered_at END,
    recovered_by = CASE WHEN p_status = 'recovered' THEN v_uid ELSE recovered_by END,
    cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END,
    cancelled_by = CASE WHEN p_status = 'cancelled' THEN v_uid ELSE cancelled_by END,
    converted_at = CASE WHEN p_status = 'converted_to_sale' THEN now() ELSE converted_at END,
    sale_id = coalesce(p_sale_id, sale_id)
  WHERE id = p_cart_id;

  RETURN jsonb_build_object('cart_id', p_cart_id, 'status', p_status, 'changed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sublime_suspend_cart(text,jsonb,uuid,uuid,text,uuid,text,text,jsonb,text,text,text,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sublime_set_suspended_cart_status(uuid,text,uuid) TO authenticated;