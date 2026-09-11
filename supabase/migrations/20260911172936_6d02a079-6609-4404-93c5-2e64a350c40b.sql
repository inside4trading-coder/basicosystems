-- ============ CAJAS ============
CREATE TABLE public.sublime_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.sublime_locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sublime_registers TO authenticated;
GRANT ALL ON public.sublime_registers TO service_role;
ALTER TABLE public.sublime_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_registers_read" ON public.sublime_registers FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE TRIGGER trg_sublime_registers_updated BEFORE UPDATE ON public.sublime_registers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SESIONES DE CAJA ============
CREATE TABLE public.sublime_cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL REFERENCES public.sublime_registers(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES public.sublime_locations(id) ON DELETE RESTRICT,
  session_number text NOT NULL,
  cashier_user_id uuid NOT NULL,
  cashier_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_ref numeric NOT NULL DEFAULT 0,
  opening_bs numeric NOT NULL DEFAULT 0,
  counted_ref numeric,
  counted_bs numeric,
  expected_ref numeric,
  expected_bs numeric,
  difference_ref numeric,
  difference_bs numeric,
  opening_note text,
  closing_note text,
  closing_summary jsonb,
  opened_by uuid,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sublime_cash_sessions_one_open ON public.sublime_cash_sessions (register_id) WHERE status = 'open';
CREATE INDEX sublime_cash_sessions_status_idx ON public.sublime_cash_sessions (status, opened_at DESC);
GRANT SELECT ON public.sublime_cash_sessions TO authenticated;
GRANT ALL ON public.sublime_cash_sessions TO service_role;
ALTER TABLE public.sublime_cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_cash_sessions_read" ON public.sublime_cash_sessions FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE TRIGGER trg_sublime_cash_sessions_updated BEFORE UPDATE ON public.sublime_cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MOVIMIENTOS DE CAJA (libro distinto al de inventario) ============
CREATE TABLE public.sublime_cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sublime_cash_sessions(id) ON DELETE CASCADE,
  register_id uuid NOT NULL REFERENCES public.sublime_registers(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('opening','cash_in','cash_out','sale_cash','closing_adjustment')),
  currency text NOT NULL CHECK (currency IN ('USD','VES')),
  amount numeric NOT NULL CHECK (amount >= 0),
  sale_id uuid REFERENCES public.sublime_sales(id) ON DELETE SET NULL,
  note text,
  performed_by uuid,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sublime_cash_movements_session_idx ON public.sublime_cash_movements (session_id, created_at DESC);
GRANT SELECT ON public.sublime_cash_movements TO authenticated;
GRANT ALL ON public.sublime_cash_movements TO service_role;
ALTER TABLE public.sublime_cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_cash_movements_read" ON public.sublime_cash_movements FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), '/sublime'));

-- ============ VENTAS ↔ SESIÓN ============
ALTER TABLE public.sublime_sales
  ADD COLUMN cash_session_id uuid REFERENCES public.sublime_cash_sessions(id) ON DELETE SET NULL,
  ADD COLUMN register_id uuid REFERENCES public.sublime_registers(id) ON DELETE SET NULL;
CREATE INDEX sublime_sales_session_idx ON public.sublime_sales (cash_session_id);

-- ============ SEMILLA DE CAJAS ============
INSERT INTO public.sublime_registers (location_id, name, code)
SELECT l.id, v.name, v.code
FROM public.sublime_locations l
CROSS JOIN (VALUES ('Caja 1','C1'), ('Caja 2','C2')) AS v(name, code)
WHERE l.sells_in_pos = true AND l.is_active = true;

-- ============ ABRIR SESIÓN ============
CREATE OR REPLACE FUNCTION public.sublime_open_cash_session(
  p_register_id uuid,
  p_opening_ref numeric DEFAULT 0,
  p_opening_bs numeric DEFAULT 0,
  p_cashier_name text DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_reg public.sublime_registers%ROWTYPE;
  v_open public.sublime_cash_sessions%ROWTYPE;
  v_id uuid;
  v_number text;
  v_seq bigint;
BEGIN
  IF v_uid IS NULL OR NOT public.has_module_access(v_uid, '/sublime') THEN
    RAISE EXCEPTION 'Sin permisos para abrir caja en Sublime.';
  END IF;
  SELECT * INTO v_reg FROM public.sublime_registers WHERE id = p_register_id FOR UPDATE;
  IF NOT FOUND OR NOT v_reg.is_active THEN
    RAISE EXCEPTION 'La caja no existe o está inactiva.';
  END IF;
  IF coalesce(p_opening_ref,0) < 0 OR coalesce(p_opening_bs,0) < 0 THEN
    RAISE EXCEPTION 'El efectivo inicial no puede ser negativo.';
  END IF;

  SELECT * INTO v_open FROM public.sublime_cash_sessions
  WHERE register_id = p_register_id AND status = 'open' LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('session_id', v_open.id, 'session_number', v_open.session_number, 'already_open', true);
  END IF;

  SELECT count(*) + 1 INTO v_seq FROM public.sublime_cash_sessions
  WHERE opened_at >= date_trunc('year', now());
  v_number := 'CS-' || to_char(now(), 'YY') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.sublime_cash_sessions (
    register_id, location_id, session_number, cashier_user_id, cashier_name,
    opening_ref, opening_bs, opening_note, opened_by
  ) VALUES (
    p_register_id, v_reg.location_id, v_number, v_uid, nullif(trim(coalesce(p_cashier_name,'')), ''),
    coalesce(p_opening_ref,0), coalesce(p_opening_bs,0), nullif(trim(coalesce(p_note,'')), ''), v_uid
  ) RETURNING id INTO v_id;

  IF coalesce(p_opening_ref,0) > 0 THEN
    INSERT INTO public.sublime_cash_movements (session_id, register_id, movement_type, currency, amount, note, performed_by)
    VALUES (v_id, p_register_id, 'opening', 'USD', p_opening_ref, coalesce(nullif(trim(coalesce(p_note,'')),''), 'Fondo inicial'), v_uid);
  END IF;
  IF coalesce(p_opening_bs,0) > 0 THEN
    INSERT INTO public.sublime_cash_movements (session_id, register_id, movement_type, currency, amount, note, performed_by)
    VALUES (v_id, p_register_id, 'opening', 'VES', p_opening_bs, coalesce(nullif(trim(coalesce(p_note,'')),''), 'Fondo inicial'), v_uid);
  END IF;

  RETURN jsonb_build_object('session_id', v_id, 'session_number', v_number, 'already_open', false);
END;
$function$;

-- ============ MOVIMIENTO MANUAL DE EFECTIVO ============
CREATE OR REPLACE FUNCTION public.sublime_register_cash_movement(
  p_session_id uuid,
  p_movement_type text,
  p_currency text,
  p_amount numeric,
  p_note text,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ses public.sublime_cash_sessions%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.has_module_access(v_uid, '/sublime') THEN
    RAISE EXCEPTION 'Sin permisos para mover efectivo en Sublime.';
  END IF;
  IF p_movement_type NOT IN ('cash_in','cash_out') THEN
    RAISE EXCEPTION 'Tipo de movimiento no permitido de forma manual.';
  END IF;
  IF p_currency NOT IN ('USD','VES') THEN
    RAISE EXCEPTION 'Moneda no válida.';
  END IF;
  IF coalesce(p_amount,0) <= 0 THEN
    RAISE EXCEPTION 'Indica el monto del movimiento.';
  END IF;
  IF coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'El motivo del movimiento es obligatorio.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.sublime_cash_movements WHERE idempotency_key = p_idempotency_key;
    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object('movement_id', v_id, 'duplicate', true);
    END IF;
  END IF;

  SELECT * INTO v_ses FROM public.sublime_cash_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La sesión de caja no existe.';
  END IF;
  IF v_ses.status <> 'open' THEN
    RAISE EXCEPTION 'La caja ya está cerrada. Abre una nueva sesión.';
  END IF;

  INSERT INTO public.sublime_cash_movements (
    session_id, register_id, movement_type, currency, amount, note, performed_by, idempotency_key
  ) VALUES (
    p_session_id, v_ses.register_id, p_movement_type, p_currency, p_amount, trim(p_note), v_uid, p_idempotency_key
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('movement_id', v_id, 'duplicate', false);
END;
$function$;

-- ============ RESUMEN DE SESIÓN ============
CREATE OR REPLACE FUNCTION public.sublime_cash_session_summary(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ses public.sublime_cash_sessions%ROWTYPE;
  v_exp_ref numeric := 0;
  v_exp_bs numeric := 0;
  v_sales integer := 0;
  v_gross numeric := 0;
  v_disc numeric := 0;
  v_net numeric := 0;
  v_methods jsonb := '[]'::jsonb;
  v_origins jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_module_access(v_uid, '/sublime') THEN
    RAISE EXCEPTION 'Sin permisos.';
  END IF;
  SELECT * INTO v_ses FROM public.sublime_cash_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La sesión de caja no existe.';
  END IF;

  SELECT
    coalesce(sum(CASE WHEN currency='USD' THEN CASE WHEN movement_type IN ('cash_out') THEN -amount ELSE amount END ELSE 0 END), 0),
    coalesce(sum(CASE WHEN currency='VES' THEN CASE WHEN movement_type IN ('cash_out') THEN -amount ELSE amount END ELSE 0 END), 0)
  INTO v_exp_ref, v_exp_bs
  FROM public.sublime_cash_movements WHERE session_id = p_session_id;

  SELECT count(*), coalesce(sum(subtotal_regular_ref),0), coalesce(sum(discount_total_ref),0), coalesce(sum(total_ref),0)
  INTO v_sales, v_gross, v_disc, v_net
  FROM public.sublime_sales WHERE cash_session_id = p_session_id AND status <> 'anulada';

  SELECT coalesce(jsonb_agg(jsonb_build_object('method', m, 'currency', c, 'amount', a, 'amount_ref', ar) ORDER BY m), '[]'::jsonb)
  INTO v_methods
  FROM (
    SELECT p.method m, p.currency c, sum(p.amount) a, sum(p.amount_ref) ar
    FROM public.sublime_sale_payments p
    JOIN public.sublime_sales s ON s.id = p.sale_id
    WHERE s.cash_session_id = p_session_id AND s.status <> 'anulada'
    GROUP BY p.method, p.currency
  ) t;

  SELECT coalesce(jsonb_agg(jsonb_build_object('origin', o, 'sales', n, 'total_ref', tt) ORDER BY o), '[]'::jsonb)
  INTO v_origins
  FROM (
    SELECT sale_origin o, count(*) n, sum(total_ref) tt
    FROM public.sublime_sales
    WHERE cash_session_id = p_session_id AND status <> 'anulada'
    GROUP BY sale_origin
  ) t2;

  RETURN jsonb_build_object(
    'session_id', v_ses.id,
    'session_number', v_ses.session_number,
    'status', v_ses.status,
    'opened_at', v_ses.opened_at,
    'closed_at', v_ses.closed_at,
    'opening_ref', v_ses.opening_ref,
    'opening_bs', v_ses.opening_bs,
    'expected_ref', round(v_exp_ref, 2),
    'expected_bs', round(v_exp_bs, 2),
    'sales_count', v_sales,
    'gross_ref', round(v_gross, 2),
    'discount_ref', round(v_disc, 2),
    'net_ref', round(v_net, 2),
    'by_method', v_methods,
    'by_origin', v_origins
  );
END;
$function$;

-- ============ CERRAR SESIÓN ============
CREATE OR REPLACE FUNCTION public.sublime_close_cash_session(
  p_session_id uuid,
  p_counted_ref numeric,
  p_counted_bs numeric,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ses public.sublime_cash_sessions%ROWTYPE;
  v_sum jsonb;
  v_exp_ref numeric;
  v_exp_bs numeric;
BEGIN
  IF v_uid IS NULL OR NOT public.has_module_access(v_uid, '/sublime') THEN
    RAISE EXCEPTION 'Sin permisos para cerrar caja en Sublime.';
  END IF;
  SELECT * INTO v_ses FROM public.sublime_cash_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La sesión de caja no existe.';
  END IF;
  IF v_ses.status <> 'open' THEN
    RETURN jsonb_build_object('session_id', v_ses.id, 'already_closed', true);
  END IF;

  v_sum := public.sublime_cash_session_summary(p_session_id);
  v_exp_ref := (v_sum->>'expected_ref')::numeric;
  v_exp_bs := (v_sum->>'expected_bs')::numeric;

  UPDATE public.sublime_cash_sessions SET
    status = 'closed',
    closed_at = now(),
    closed_by = v_uid,
    counted_ref = round(coalesce(p_counted_ref,0), 2),
    counted_bs = round(coalesce(p_counted_bs,0), 2),
    expected_ref = v_exp_ref,
    expected_bs = v_exp_bs,
    difference_ref = round(coalesce(p_counted_ref,0) - v_exp_ref, 2),
    difference_bs = round(coalesce(p_counted_bs,0) - v_exp_bs, 2),
    closing_note = nullif(trim(coalesce(p_note,'')), ''),
    closing_summary = v_sum,
    updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'already_closed', false,
    'expected_ref', v_exp_ref,
    'expected_bs', v_exp_bs,
    'difference_ref', round(coalesce(p_counted_ref,0) - v_exp_ref, 2),
    'difference_bs', round(coalesce(p_counted_bs,0) - v_exp_bs, 2),
    'summary', v_sum
  );
END;
$function$;

-- ============ VENTA POS: ahora exige sesión abierta ============
CREATE OR REPLACE FUNCTION public.sublime_register_pos_sale(
  p_idempotency_key text,
  p_location_id uuid,
  p_sale_origin text,
  p_items jsonb,
  p_payments jsonb,
  p_origin_detail text DEFAULT NULL::text,
  p_customer jsonb DEFAULT NULL::jsonb,
  p_invoice_number text DEFAULT NULL::text,
  p_note text DEFAULT NULL::text,
  p_bcv_rate numeric DEFAULT 0,
  p_register_code text DEFAULT NULL::text,
  p_cashier_code text DEFAULT NULL::text,
  p_session_code text DEFAULT NULL::text,
  p_cash_session_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_existing public.sublime_sales%ROWTYPE;
  v_ses public.sublime_cash_sessions%ROWTYPE;
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
  v_method text;
  v_cur text;
  v_amount numeric;
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

  IF p_cash_session_id IS NULL THEN
    RAISE EXCEPTION 'Debes abrir caja antes de vender.';
  END IF;
  SELECT * INTO v_ses FROM public.sublime_cash_sessions WHERE id = p_cash_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Debes abrir caja antes de vender.';
  END IF;
  IF v_ses.status <> 'open' THEN
    RAISE EXCEPTION 'La caja fue cerrada. Actualiza el POS y abre una nueva sesión.';
  END IF;
  IF v_ses.location_id <> p_location_id THEN
    RAISE EXCEPTION 'La sesión de caja no corresponde a esta tienda.';
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
    idempotency_key, sold_by, cash_session_id, register_id
  ) VALUES (
    v_number, p_location_id, p_sale_origin, nullif(trim(coalesce(p_origin_detail,'')), ''),
    v_customer_id, v_customer_name,
    nullif(trim(coalesce(p_invoice_number,'')), ''), nullif(trim(coalesce(p_note,'')), ''),
    coalesce(p_bcv_rate, 0), p_register_code, p_cashier_code, coalesce(p_session_code, v_ses.session_number),
    p_idempotency_key, v_uid, v_ses.id, v_ses.register_id
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
      v_method := coalesce(v_pay->>'method', 'otro');
      v_cur := coalesce(v_pay->>'currency', 'USD');
      v_amount := coalesce((v_pay->>'amount')::numeric, 0);

      INSERT INTO public.sublime_sale_payments (sale_id, method, currency, amount, amount_ref, bank, reference, extra)
      VALUES (
        v_sale_id, v_method, v_cur, v_amount,
        coalesce((v_pay->>'amount_ref')::numeric, 0),
        nullif(v_pay->>'bank', ''),
        nullif(v_pay->>'reference', ''),
        coalesce(v_pay->'extra', '{}'::jsonb)
      );

      -- Solo el efectivo real entra en la caja física
      IF v_method IN ('cash_usd','cash_ves') AND v_amount > 0 THEN
        INSERT INTO public.sublime_cash_movements (
          session_id, register_id, movement_type, currency, amount, sale_id, note, performed_by
        ) VALUES (
          v_ses.id, v_ses.register_id, 'sale_cash',
          CASE WHEN v_method = 'cash_usd' THEN 'USD' ELSE 'VES' END,
          v_amount, v_sale_id, 'Venta ' || v_number, v_uid
        );
      END IF;
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
$function$;

DROP FUNCTION IF EXISTS public.sublime_register_pos_sale(text, uuid, text, jsonb, jsonb, text, jsonb, text, text, numeric, text, text, text);

GRANT EXECUTE ON FUNCTION public.sublime_open_cash_session(uuid, numeric, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sublime_register_cash_movement(uuid, text, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sublime_cash_session_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sublime_close_cash_session(uuid, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sublime_register_pos_sale(text, uuid, text, jsonb, jsonb, text, jsonb, text, text, numeric, text, text, text, uuid) TO authenticated;