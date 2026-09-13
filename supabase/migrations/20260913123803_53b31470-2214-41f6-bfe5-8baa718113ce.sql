
-- ============ Tablas postventa ============
CREATE TABLE public.sublime_sale_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL UNIQUE,
  sale_id uuid NOT NULL REFERENCES public.sublime_sales(id),
  kind text NOT NULL DEFAULT 'return' CHECK (kind IN ('return','void','exchange')),
  reason text,
  location_id uuid NOT NULL,
  cash_session_id uuid REFERENCES public.sublime_cash_sessions(id),
  register_id uuid,
  units integer NOT NULL DEFAULT 0,
  total_returned_ref numeric NOT NULL DEFAULT 0,
  total_refund_ref numeric NOT NULL DEFAULT 0,
  exchange_sale_id uuid REFERENCES public.sublime_sales(id),
  idempotency_key text NOT NULL UNIQUE,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sublime_sale_returns TO authenticated;
GRANT ALL ON public.sublime_sale_returns TO service_role;
ALTER TABLE public.sublime_sale_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_sale_returns_read" ON public.sublime_sale_returns FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_sale_returns_write" ON public.sublime_sale_returns FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));

CREATE TABLE public.sublime_sale_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sublime_sale_returns(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES public.sublime_sale_items(id),
  variant_id uuid,
  sku text,
  title text NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  unit_ref numeric NOT NULL DEFAULT 0,
  line_total_ref numeric NOT NULL DEFAULT 0,
  restocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sublime_sale_return_items TO authenticated;
GRANT ALL ON public.sublime_sale_return_items TO service_role;
ALTER TABLE public.sublime_sale_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_sale_return_items_read" ON public.sublime_sale_return_items FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_sale_return_items_write" ON public.sublime_sale_return_items FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));

CREATE TABLE public.sublime_sale_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sublime_sale_returns(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sublime_sales(id),
  method text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('USD','VES')),
  amount numeric NOT NULL CHECK (amount >= 0),
  amount_ref numeric NOT NULL DEFAULT 0,
  bank text,
  reference text,
  cash_session_id uuid REFERENCES public.sublime_cash_sessions(id),
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sublime_sale_refunds TO authenticated;
GRANT ALL ON public.sublime_sale_refunds TO service_role;
ALTER TABLE public.sublime_sale_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_sale_refunds_read" ON public.sublime_sale_refunds FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), '/sublime'));
CREATE POLICY "sublime_sale_refunds_write" ON public.sublime_sale_refunds FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));

CREATE INDEX idx_sublime_sale_returns_sale ON public.sublime_sale_returns(sale_id);
CREATE INDEX idx_sublime_sale_return_items_item ON public.sublime_sale_return_items(sale_item_id);
CREATE INDEX idx_sublime_sale_refunds_sale ON public.sublime_sale_refunds(sale_id);

CREATE TRIGGER trg_sublime_sale_returns_updated_at
BEFORE UPDATE ON public.sublime_sale_returns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Efectivo devuelto ============
ALTER TABLE public.sublime_cash_movements DROP CONSTRAINT sublime_cash_movements_movement_type_check;
ALTER TABLE public.sublime_cash_movements ADD CONSTRAINT sublime_cash_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY['opening','cash_in','cash_out','sale_cash','refund_cash','closing_adjustment']));

-- ============ Registro atómico de devolución / anulación ============
CREATE OR REPLACE FUNCTION public.sublime_register_sale_return(
  p_idempotency_key text,
  p_sale_id uuid,
  p_kind text,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_reason text DEFAULT NULL,
  p_refunds jsonb DEFAULT '[]'::jsonb,
  p_cash_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.sublime_sale_returns%ROWTYPE;
  v_sale public.sublime_sales%ROWTYPE;
  v_ses public.sublime_cash_sessions%ROWTYPE;
  v_items jsonb;
  v_item jsonb;
  v_ret_id uuid;
  v_number text;
  v_seq bigint;
  v_line public.sublime_sale_items%ROWTYPE;
  v_variant public.sublime_variants%ROWTYPE;
  v_stock public.sublime_stocks%ROWTYPE;
  v_qty integer;
  v_returned integer;
  v_new_qty integer;
  v_units integer := 0;
  v_value numeric := 0;
  v_refund_total numeric := 0;
  v_pay jsonb;
  v_method text;
  v_cur text;
  v_amount numeric;
  v_sold_units integer;
  v_ret_units integer;
  v_status text;
  v_restocked boolean;
  v_sells_pos boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.has_module_access(v_uid, '/sublime') THEN
    RAISE EXCEPTION 'Sin permisos para operaciones postventa de Sublime.';
  END IF;
  IF coalesce(trim(p_idempotency_key), '') = '' THEN
    RAISE EXCEPTION 'Falta el identificador de la operación.';
  END IF;
  IF coalesce(p_kind, '') NOT IN ('return','void','exchange') THEN
    RAISE EXCEPTION 'Tipo de operación inválido.';
  END IF;

  SELECT * INTO v_existing FROM public.sublime_sale_returns WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('return_id', v_existing.id, 'return_number', v_existing.return_number, 'duplicate', true);
  END IF;

  SELECT * INTO v_sale FROM public.sublime_sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta no existe.';
  END IF;
  IF v_sale.status = 'voided' THEN
    RAISE EXCEPTION 'La venta ya fue anulada.';
  END IF;
  IF v_sale.status = 'returned' THEN
    RAISE EXCEPTION 'La venta ya fue devuelta por completo.';
  END IF;

  -- Anulación: todo lo que quede sin devolver
  IF p_kind = 'void' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('sale_item_id', i.id, 'qty', i.qty - coalesce(r.q, 0))), '[]'::jsonb)
    INTO v_items
    FROM public.sublime_sale_items i
    LEFT JOIN (
      SELECT ri.sale_item_id, sum(ri.qty) q
      FROM public.sublime_sale_return_items ri
      GROUP BY ri.sale_item_id
    ) r ON r.sale_item_id = i.id
    WHERE i.sale_id = v_sale.id AND i.qty - coalesce(r.q, 0) > 0;
  ELSE
    v_items := coalesce(p_items, '[]'::jsonb);
    IF jsonb_array_length(v_items) = 0 THEN
      RAISE EXCEPTION 'Debes seleccionar al menos una línea a devolver.';
    END IF;
  END IF;

  SELECT count(*) + 1 INTO v_seq FROM public.sublime_sale_returns WHERE created_at >= date_trunc('year', now());
  v_number := 'SDEV-' || to_char(now(), 'YY') || '-' || lpad(v_seq::text, 5, '0');

  SELECT coalesce(sells_in_pos, false) INTO v_sells_pos FROM public.sublime_locations WHERE id = v_sale.location_id;

  INSERT INTO public.sublime_sale_returns (
    return_number, sale_id, kind, reason, location_id, cash_session_id, register_id,
    idempotency_key, performed_by
  ) VALUES (
    v_number, v_sale.id, p_kind, nullif(trim(coalesce(p_reason, '')), ''), v_sale.location_id,
    p_cash_session_id, v_sale.register_id, p_idempotency_key, v_uid
  ) RETURNING id INTO v_ret_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_qty := coalesce((v_item->>'qty')::int, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_line FROM public.sublime_sale_items
    WHERE id = (v_item->>'sale_item_id')::uuid AND sale_id = v_sale.id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La línea indicada no pertenece a esta venta.';
    END IF;

    SELECT coalesce(sum(qty), 0) INTO v_returned
    FROM public.sublime_sale_return_items WHERE sale_item_id = v_line.id;

    IF v_returned + v_qty > v_line.qty THEN
      RAISE EXCEPTION 'No puedes devolver más unidades de las vendidas en "%": vendidas %, ya devueltas %.',
        v_line.title, v_line.qty, v_returned;
    END IF;

    v_restocked := false;
    IF v_line.line_kind = 'catalog' AND v_line.variant_id IS NOT NULL THEN
      SELECT * INTO v_variant FROM public.sublime_variants WHERE id = v_line.variant_id FOR UPDATE;
      IF FOUND THEN
        SELECT * INTO v_stock FROM public.sublime_stocks
        WHERE variant_id = v_line.variant_id AND location_id = v_sale.location_id FOR UPDATE;
        IF FOUND THEN
          v_new_qty := coalesce(v_stock.quantity_on_hand, 0) + v_qty;
          UPDATE public.sublime_stocks SET quantity_on_hand = v_new_qty, updated_at = now() WHERE id = v_stock.id;
        ELSE
          v_new_qty := v_qty;
          INSERT INTO public.sublime_stocks (variant_id, location_id, quantity_on_hand, quantity_reserved)
          VALUES (v_line.variant_id, v_sale.location_id, v_new_qty, 0);
        END IF;

        INSERT INTO public.sublime_inventory_movements (
          variant_id, location_id, movement_type, qty_delta, qty_result, performed_by, note
        ) VALUES (
          v_line.variant_id, v_sale.location_id,
          CASE WHEN p_kind = 'void' THEN 'pos_void' ELSE 'pos_return' END,
          v_qty, v_new_qty, v_uid,
          CASE WHEN p_kind = 'void' THEN 'Anulación ' ELSE 'Devolución ' END
            || v_number || ' · venta ' || v_sale.sale_number || ' · ' || coalesce(v_line.sku, 'sin SKU')
        );

        v_restocked := true;

        IF v_new_qty > 0 AND v_variant.is_active AND coalesce(v_sells_pos, false)
           AND coalesce(trim(coalesce(v_variant.sku, '')), '') <> ''
           AND coalesce(v_variant.current_price_ref, 0) > 0 THEN
          UPDATE public.sublime_variants SET pos_enabled = true, updated_at = now() WHERE id = v_variant.id;
        END IF;
      END IF;
    END IF;

    INSERT INTO public.sublime_sale_return_items (
      return_id, sale_item_id, variant_id, sku, title, qty, unit_ref, line_total_ref, restocked
    ) VALUES (
      v_ret_id, v_line.id, v_line.variant_id, v_line.sku, v_line.title, v_qty,
      v_line.unit_final_ref, round(v_line.unit_final_ref * v_qty, 2), v_restocked
    );

    v_units := v_units + v_qty;
    v_value := v_value + v_line.unit_final_ref * v_qty;
  END LOOP;

  IF v_units = 0 THEN
    RAISE EXCEPTION 'No hay unidades pendientes por devolver en esta venta.';
  END IF;

  -- Reembolsos: el efectivo exige sesión de caja abierta
  IF p_refunds IS NOT NULL THEN
    FOR v_pay IN SELECT * FROM jsonb_array_elements(p_refunds) LOOP
      v_method := coalesce(v_pay->>'method', 'otro');
      v_cur := coalesce(v_pay->>'currency', 'USD');
      v_amount := coalesce((v_pay->>'amount')::numeric, 0);
      IF v_amount <= 0 THEN CONTINUE; END IF;

      IF v_method IN ('cash_usd','cash_ves') THEN
        IF p_cash_session_id IS NULL THEN
          RAISE EXCEPTION 'Debes abrir caja para devolver efectivo.';
        END IF;
        SELECT * INTO v_ses FROM public.sublime_cash_sessions WHERE id = p_cash_session_id FOR UPDATE;
        IF NOT FOUND OR v_ses.status <> 'open' THEN
          RAISE EXCEPTION 'Debes abrir caja para devolver efectivo.';
        END IF;

        INSERT INTO public.sublime_cash_movements (
          session_id, register_id, movement_type, currency, amount, sale_id, note, performed_by
        ) VALUES (
          v_ses.id, v_ses.register_id, 'refund_cash',
          CASE WHEN v_method = 'cash_usd' THEN 'USD' ELSE 'VES' END,
          v_amount, v_sale.id, 'Devolución ' || v_number || ' · venta ' || v_sale.sale_number, v_uid
        );
      END IF;

      INSERT INTO public.sublime_sale_refunds (
        return_id, sale_id, method, currency, amount, amount_ref, bank, reference, cash_session_id, performed_by
      ) VALUES (
        v_ret_id, v_sale.id, v_method,
        CASE WHEN v_cur = 'VES' THEN 'VES' ELSE 'USD' END,
        v_amount, coalesce((v_pay->>'amount_ref')::numeric, 0),
        nullif(v_pay->>'bank', ''), nullif(v_pay->>'reference', ''),
        CASE WHEN v_method IN ('cash_usd','cash_ves') THEN p_cash_session_id ELSE NULL END,
        v_uid
      );

      v_refund_total := v_refund_total + coalesce((v_pay->>'amount_ref')::numeric, 0);
    END LOOP;
  END IF;

  UPDATE public.sublime_sale_returns SET
    units = v_units,
    total_returned_ref = round(v_value, 2),
    total_refund_ref = round(v_refund_total, 2),
    updated_at = now()
  WHERE id = v_ret_id;

  SELECT coalesce(sum(qty), 0) INTO v_sold_units FROM public.sublime_sale_items WHERE sale_id = v_sale.id;
  SELECT coalesce(sum(ri.qty), 0) INTO v_ret_units
  FROM public.sublime_sale_return_items ri
  JOIN public.sublime_sale_returns r ON r.id = ri.return_id
  WHERE r.sale_id = v_sale.id;

  v_status := CASE
    WHEN p_kind = 'void' THEN 'voided'
    WHEN v_ret_units >= v_sold_units THEN 'returned'
    ELSE 'partially_returned'
  END;

  UPDATE public.sublime_sales SET status = v_status, updated_at = now() WHERE id = v_sale.id;

  RETURN jsonb_build_object(
    'return_id', v_ret_id,
    'return_number', v_number,
    'duplicate', false,
    'sale_status', v_status,
    'units', v_units
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.sublime_register_sale_return(text, uuid, text, jsonb, text, jsonb, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.sublime_register_sale_return(text, uuid, text, jsonb, text, jsonb, uuid) TO authenticated;

-- ============ Enlazar cambio (devolución + nueva venta) ============
CREATE OR REPLACE FUNCTION public.sublime_link_exchange_sale(p_return_id uuid, p_new_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ret public.sublime_sale_returns%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.has_module_access(v_uid, '/sublime') THEN
    RAISE EXCEPTION 'Sin permisos.';
  END IF;
  SELECT * INTO v_ret FROM public.sublime_sale_returns WHERE id = p_return_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La devolución no existe.';
  END IF;
  IF v_ret.exchange_sale_id IS NOT NULL THEN
    RETURN jsonb_build_object('return_id', v_ret.id, 'exchange_sale_id', v_ret.exchange_sale_id, 'duplicate', true);
  END IF;
  UPDATE public.sublime_sale_returns
  SET exchange_sale_id = p_new_sale_id, kind = 'exchange', updated_at = now()
  WHERE id = p_return_id;
  RETURN jsonb_build_object('return_id', p_return_id, 'exchange_sale_id', p_new_sale_id, 'duplicate', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.sublime_link_exchange_sale(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.sublime_link_exchange_sale(uuid, uuid) TO authenticated;

-- ============ Resumen de caja: el efectivo devuelto resta ============
CREATE OR REPLACE FUNCTION public.sublime_cash_session_summary(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    coalesce(sum(CASE WHEN currency='USD' THEN CASE WHEN movement_type IN ('cash_out','refund_cash') THEN -amount ELSE amount END ELSE 0 END), 0),
    coalesce(sum(CASE WHEN currency='VES' THEN CASE WHEN movement_type IN ('cash_out','refund_cash') THEN -amount ELSE amount END ELSE 0 END), 0)
  INTO v_exp_ref, v_exp_bs
  FROM public.sublime_cash_movements WHERE session_id = p_session_id;

  SELECT count(*), coalesce(sum(subtotal_regular_ref),0), coalesce(sum(discount_total_ref),0), coalesce(sum(total_ref),0)
  INTO v_sales, v_gross, v_disc, v_net
  FROM public.sublime_sales WHERE cash_session_id = p_session_id AND status NOT IN ('anulada','voided');

  SELECT coalesce(jsonb_agg(jsonb_build_object('method', m, 'currency', c, 'amount', a, 'amount_ref', ar) ORDER BY m), '[]'::jsonb)
  INTO v_methods
  FROM (
    SELECT p.method m, p.currency c, sum(p.amount) a, sum(p.amount_ref) ar
    FROM public.sublime_sale_payments p
    JOIN public.sublime_sales s ON s.id = p.sale_id
    WHERE s.cash_session_id = p_session_id AND s.status NOT IN ('anulada','voided')
    GROUP BY p.method, p.currency
  ) t;

  SELECT coalesce(jsonb_agg(jsonb_build_object('origin', o, 'sales', n, 'total_ref', tt) ORDER BY o), '[]'::jsonb)
  INTO v_origins
  FROM (
    SELECT sale_origin o, count(*) n, sum(total_ref) tt
    FROM public.sublime_sales
    WHERE cash_session_id = p_session_id AND status NOT IN ('anulada','voided')
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
