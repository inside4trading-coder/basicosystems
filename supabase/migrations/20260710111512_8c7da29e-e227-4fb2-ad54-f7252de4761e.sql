
-- ============================================================
-- BLOQUE 2: Órdenes de reposición externa
-- ============================================================

-- Extensión para normalización de nombres de proveedor
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Secuencia para número de orden
CREATE SEQUENCE IF NOT EXISTS public.core_external_purchase_order_seq START 1;

-- ============================================================
-- Tabla: core_external_purchase_orders
-- ============================================================
CREATE TABLE public.core_external_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  supplier_id uuid NULL,
  supplier_name_snapshot text NOT NULL,
  supplier_name_normalized text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','ordered','partially_received','received','cancelled')),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','partial','paid','not_applicable')),
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric NOT NULL DEFAULT 0,
  shipping_cost numeric NOT NULL DEFAULT 0,
  other_cost numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  supplier_order_reference text NULL,
  estimated_delivery_date date NULL,
  notes text NULL,
  cancellation_reason text NULL,
  approved_at timestamptz NULL,
  approved_by uuid NULL,
  ordered_at timestamptz NULL,
  ordered_by uuid NULL,
  received_at timestamptz NULL,
  received_by uuid NULL,
  cancelled_at timestamptz NULL,
  cancelled_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE INDEX idx_core_ext_po_status ON public.core_external_purchase_orders(status);
CREATE INDEX idx_core_ext_po_supplier_norm ON public.core_external_purchase_orders(supplier_name_normalized);

GRANT SELECT, INSERT, UPDATE ON public.core_external_purchase_orders TO authenticated;
GRANT ALL ON public.core_external_purchase_orders TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.core_external_purchase_order_seq TO authenticated, service_role;

ALTER TABLE public.core_external_purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ext_po_select_auth" ON public.core_external_purchase_orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ext_po_insert_admin" ON public.core_external_purchase_orders
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)
  );
CREATE POLICY "ext_po_update_admin" ON public.core_external_purchase_orders
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)
  );

CREATE TRIGGER trg_core_ext_po_updated
  BEFORE UPDATE ON public.core_external_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Tabla: core_external_purchase_order_lines
-- ============================================================
CREATE TABLE public.core_external_purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.core_external_purchase_orders(id) ON DELETE CASCADE,
  policy_event_id uuid NULL REFERENCES public.core_replenishment_policy_events(id),
  core_product_id uuid NULL,
  core_variant_id uuid NULL,
  woo_product_id bigint NULL,
  woo_variation_id bigint NULL,
  product_name_snapshot text NULL,
  variant_label_snapshot text NULL,
  sku_snapshot text NULL,
  quantity_ordered numeric NOT NULL CHECK (quantity_ordered > 0),
  quantity_received numeric NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost numeric NOT NULL CHECK (unit_cost >= 0),
  line_subtotal numeric NOT NULL DEFAULT 0,
  cost_source text NULL,
  policy_id uuid NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','ordered','partially_received','received','cancelled')),
  notes text NULL,
  cancellation_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity_received <= quantity_ordered)
);

CREATE UNIQUE INDEX ux_core_ext_po_lines_event
  ON public.core_external_purchase_order_lines(policy_event_id)
  WHERE policy_event_id IS NOT NULL;

CREATE INDEX idx_core_ext_po_lines_order ON public.core_external_purchase_order_lines(order_id);

GRANT SELECT, INSERT, UPDATE ON public.core_external_purchase_order_lines TO authenticated;
GRANT ALL ON public.core_external_purchase_order_lines TO service_role;

ALTER TABLE public.core_external_purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ext_po_lines_select_auth" ON public.core_external_purchase_order_lines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ext_po_lines_insert_admin" ON public.core_external_purchase_order_lines
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)
  );
CREATE POLICY "ext_po_lines_update_admin" ON public.core_external_purchase_order_lines
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)
  );

CREATE TRIGGER trg_core_ext_po_lines_updated
  BEFORE UPDATE ON public.core_external_purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Helper: normalizar nombre de proveedor
-- ============================================================
CREATE OR REPLACE FUNCTION public.core_normalize_supplier_name(p_name text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(unaccent(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g')));
$$;

-- ============================================================
-- Helper: registrar auditoría en core_audit_logs
-- ============================================================
CREATE OR REPLACE FUNCTION public.core_ext_po_audit(
  p_order_id uuid, p_order_number text, p_action text,
  p_old jsonb, p_new jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.core_audit_logs(table_name, record_id, action, field_changed, old_value, new_value, performed_by)
  VALUES ('core_external_purchase_orders', p_order_id::text, p_action, p_order_number,
    coalesce(p_old::text, NULL), coalesce(p_new::text, NULL),
    (SELECT coalesce(email, id::text) FROM auth.users WHERE id = auth.uid()));
END;
$$;

-- ============================================================
-- RPC 1: Crear órdenes desde eventos (preview + confirmación)
-- ============================================================
CREATE OR REPLACE FUNCTION public.core_create_external_purchase_orders_from_events(
  p_event_ids uuid[],
  p_overrides jsonb DEFAULT '{}'::jsonb,
  p_dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_event record;
  v_policy record;
  v_supplier_raw text;
  v_supplier_norm text;
  v_unit_cost numeric;
  v_qty numeric;
  v_line_notes text;
  v_ev_over jsonb;
  v_sup_over jsonb;
  v_groups jsonb := '{}'::jsonb;
  v_group_key text;
  v_group jsonb;
  v_lines jsonb;
  v_out_orders jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_order_number text;
  v_seq bigint;
  v_line record;
  v_subtotal numeric;
  v_shipping numeric;
  v_other numeric;
  v_total numeric;
  v_currency text;
  v_header_notes text;
  v_supplier_display text;
  v_existing_line uuid;
  v_line_item jsonb;
  v_result_lines jsonb;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_event_ids IS NULL OR array_length(p_event_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Sin eventos seleccionados';
  END IF;

  -- Cargar eventos y agrupar
  FOR v_event IN
    SELECT * FROM public.core_replenishment_policy_events
    WHERE id = ANY(p_event_ids)
    ORDER BY id
  LOOP
    IF v_event.action <> 'external_supplier_review' THEN
      RAISE EXCEPTION 'Evento % no es external_supplier_review (action=%)', v_event.id, v_event.action;
    END IF;

    -- Bloquear si ya tiene línea externa
    SELECT id INTO v_existing_line
      FROM public.core_external_purchase_order_lines
     WHERE policy_event_id = v_event.id LIMIT 1;
    IF v_existing_line IS NOT NULL THEN
      RAISE EXCEPTION 'Evento % ya fue convertido en línea externa (%)', v_event.id, v_existing_line;
    END IF;

    -- Cargar política
    v_policy := NULL;
    IF v_event.policy_id IS NOT NULL THEN
      SELECT * INTO v_policy FROM public.core_replenishment_policies WHERE id = v_event.policy_id;
    END IF;
    IF v_policy.id IS NULL AND v_event.core_product_id IS NOT NULL THEN
      SELECT * INTO v_policy FROM public.core_replenishment_policies WHERE core_product_id = v_event.core_product_id LIMIT 1;
    END IF;

    -- Overrides por evento
    v_ev_over := coalesce(p_overrides->'events'->v_event.id::text, '{}'::jsonb);
    v_qty := coalesce((v_ev_over->>'quantity_ordered')::numeric, v_event.quantity, 0);
    v_unit_cost := coalesce(
      (v_ev_over->>'unit_cost')::numeric,
      v_policy.external_supplier_unit_cost_usd,
      v_event.unit_cost,
      0
    );
    v_line_notes := v_ev_over->>'notes';

    v_supplier_raw := coalesce(
      NULLIF(trim(coalesce((v_ev_over->>'supplier_name'),'')), ''),
      NULLIF(trim(coalesce(v_policy.external_supplier_name,'')), '')
    );
    IF v_supplier_raw IS NULL THEN
      RAISE EXCEPTION 'Evento % sin proveedor configurado en la política (product=%)', v_event.id, v_event.core_product_id;
    END IF;
    v_supplier_norm := public.core_normalize_supplier_name(v_supplier_raw);

    -- Override de proveedor a nivel grupo (por clave normalizada)
    v_sup_over := coalesce(p_overrides->'suppliers'->v_supplier_norm, '{}'::jsonb);
    IF (v_sup_over->>'supplier_name') IS NOT NULL AND trim(v_sup_over->>'supplier_name') <> '' THEN
      v_supplier_raw := trim(v_sup_over->>'supplier_name');
      v_supplier_norm := public.core_normalize_supplier_name(v_supplier_raw);
      v_sup_over := coalesce(p_overrides->'suppliers'->v_supplier_norm, v_sup_over);
    END IF;

    IF v_qty <= 0 THEN RAISE EXCEPTION 'Cantidad inválida para evento %', v_event.id; END IF;
    IF v_unit_cost < 0 THEN RAISE EXCEPTION 'Costo inválido para evento %', v_event.id; END IF;

    -- Build line jsonb
    v_line_item := jsonb_build_object(
      'policy_event_id', v_event.id,
      'core_product_id', v_event.core_product_id,
      'core_variant_id', v_event.core_variant_id,
      'woo_product_id', v_event.woo_product_id,
      'woo_variation_id', v_event.woo_variation_id,
      'product_name_snapshot', v_event.product_name_snapshot,
      'variant_label_snapshot', v_event.variant_label_snapshot,
      'sku_snapshot', v_event.sku_snapshot,
      'quantity_ordered', v_qty,
      'unit_cost', v_unit_cost,
      'line_subtotal', round(v_qty * v_unit_cost, 4),
      'cost_source', coalesce(v_event.cost_source, 'external_supplier_cost'),
      'policy_id', v_policy.id,
      'notes', v_line_notes
    );

    -- Agregar al grupo
    v_group := coalesce(v_groups->v_supplier_norm, jsonb_build_object(
      'supplier_name_snapshot', v_supplier_raw,
      'supplier_name_normalized', v_supplier_norm,
      'lines', '[]'::jsonb
    ));
    v_group := jsonb_set(v_group, '{lines}', (v_group->'lines') || v_line_item);
    v_groups := jsonb_set(v_groups, ARRAY[v_supplier_norm], v_group, true);
  END LOOP;

  -- Procesar cada grupo → una orden
  FOR v_group_key IN SELECT jsonb_object_keys(v_groups) LOOP
    v_group := v_groups->v_group_key;
    v_sup_over := coalesce(p_overrides->'suppliers'->v_group_key, '{}'::jsonb);
    v_supplier_display := coalesce(NULLIF(trim(v_sup_over->>'supplier_name'),''), v_group->>'supplier_name_snapshot');
    v_shipping := coalesce((v_sup_over->>'shipping_cost')::numeric, 0);
    v_other := coalesce((v_sup_over->>'other_cost')::numeric, 0);
    v_currency := coalesce(NULLIF(v_sup_over->>'currency',''), 'USD');
    v_header_notes := v_sup_over->>'notes';

    v_subtotal := 0;
    v_result_lines := '[]'::jsonb;
    FOR v_line_item IN SELECT * FROM jsonb_array_elements(v_group->'lines') LOOP
      v_subtotal := v_subtotal + (v_line_item->>'line_subtotal')::numeric;
      v_result_lines := v_result_lines || v_line_item;
    END LOOP;
    v_total := v_subtotal + v_shipping + v_other;

    IF p_dry_run THEN
      v_out_orders := v_out_orders || jsonb_build_object(
        'supplier_name', v_supplier_display,
        'supplier_normalized', v_group_key,
        'currency', v_currency,
        'subtotal', v_subtotal,
        'shipping_cost', v_shipping,
        'other_cost', v_other,
        'total', v_total,
        'notes', v_header_notes,
        'lines', v_result_lines
      );
    ELSE
      v_seq := nextval('public.core_external_purchase_order_seq');
      v_order_number := 'EXT-' || lpad(v_seq::text, 6, '0');

      INSERT INTO public.core_external_purchase_orders(
        order_number, supplier_name_snapshot, supplier_name_normalized,
        status, currency, subtotal, shipping_cost, other_cost, total,
        balance_due, notes, created_by, updated_by
      ) VALUES (
        v_order_number, v_supplier_display, v_group_key,
        'draft', v_currency, v_subtotal, v_shipping, v_other, v_total,
        v_total, v_header_notes, v_uid, v_uid
      ) RETURNING id INTO v_order_id;

      FOR v_line_item IN SELECT * FROM jsonb_array_elements(v_result_lines) LOOP
        INSERT INTO public.core_external_purchase_order_lines(
          order_id, policy_event_id, core_product_id, core_variant_id,
          woo_product_id, woo_variation_id, product_name_snapshot,
          variant_label_snapshot, sku_snapshot, quantity_ordered, unit_cost,
          line_subtotal, cost_source, policy_id, notes, status
        ) VALUES (
          v_order_id,
          (v_line_item->>'policy_event_id')::uuid,
          NULLIF(v_line_item->>'core_product_id','')::uuid,
          NULLIF(v_line_item->>'core_variant_id','')::uuid,
          NULLIF(v_line_item->>'woo_product_id','')::bigint,
          NULLIF(v_line_item->>'woo_variation_id','')::bigint,
          v_line_item->>'product_name_snapshot',
          v_line_item->>'variant_label_snapshot',
          v_line_item->>'sku_snapshot',
          (v_line_item->>'quantity_ordered')::numeric,
          (v_line_item->>'unit_cost')::numeric,
          (v_line_item->>'line_subtotal')::numeric,
          v_line_item->>'cost_source',
          NULLIF(v_line_item->>'policy_id','')::uuid,
          v_line_item->>'notes',
          'pending'
        );

        -- Marcar evento como reviewed
        UPDATE public.core_replenishment_policy_events
           SET status = 'reviewed',
               resolution_notes = 'Convertido en orden externa ' || v_order_number,
               updated_at = now()
         WHERE id = (v_line_item->>'policy_event_id')::uuid
           AND status IN ('open','reviewed');
      END LOOP;

      PERFORM public.core_ext_po_audit(v_order_id, v_order_number, 'external_order_created', NULL,
        jsonb_build_object('supplier', v_supplier_display, 'total', v_total, 'lines', jsonb_array_length(v_result_lines)));

      v_out_orders := v_out_orders || jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'supplier_name', v_supplier_display,
        'total', v_total
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'dry_run', p_dry_run, 'orders', v_out_orders);
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_create_external_purchase_orders_from_events(uuid[], jsonb, boolean) TO authenticated, service_role;

-- ============================================================
-- RPC 2: Editar borrador (única vía)
-- ============================================================
CREATE OR REPLACE FUNCTION public.core_update_external_purchase_order_draft(
  p_order_id uuid,
  p_header jsonb DEFAULT '{}'::jsonb,
  p_lines jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_order record;
  v_line_item jsonb;
  v_line_id uuid;
  v_qty numeric;
  v_cost numeric;
  v_status text;
  v_subtotal numeric := 0;
  v_shipping numeric;
  v_other numeric;
  v_total numeric;
  v_balance numeric;
  v_pay_status text;
  v_amount_paid numeric;
  v_supplier text;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT * INTO v_order FROM public.core_external_purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF v_order.status <> 'draft' THEN RAISE EXCEPTION 'Solo se puede editar en borrador (estado: %)', v_order.status; END IF;

  -- Lock lines
  PERFORM 1 FROM public.core_external_purchase_order_lines WHERE order_id = p_order_id FOR UPDATE;

  -- Header
  v_supplier := coalesce(NULLIF(trim(p_header->>'supplier_name'),''), v_order.supplier_name_snapshot);
  v_shipping := coalesce((p_header->>'shipping_cost')::numeric, v_order.shipping_cost);
  v_other := coalesce((p_header->>'other_cost')::numeric, v_order.other_cost);
  IF v_shipping < 0 OR v_other < 0 THEN RAISE EXCEPTION 'Costos no pueden ser negativos'; END IF;

  -- Aplicar cambios de líneas
  IF p_lines IS NOT NULL THEN
    FOR v_line_item IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
      v_line_id := NULLIF(v_line_item->>'line_id','')::uuid;
      v_qty := (v_line_item->>'quantity_ordered')::numeric;
      v_cost := (v_line_item->>'unit_cost')::numeric;
      v_status := coalesce(NULLIF(v_line_item->>'status',''), 'pending');

      IF v_status NOT IN ('pending','cancelled') THEN
        RAISE EXCEPTION 'Estado de línea inválido en edición: %', v_status;
      END IF;
      IF v_status = 'pending' THEN
        IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Cantidad debe ser > 0'; END IF;
        IF v_cost IS NULL OR v_cost < 0 THEN RAISE EXCEPTION 'Costo inválido'; END IF;
      END IF;
      IF v_status = 'cancelled' AND coalesce(NULLIF(v_line_item->>'cancellation_notes',''), NULL) IS NULL THEN
        RAISE EXCEPTION 'Se requiere motivo para cancelar una línea';
      END IF;

      IF v_line_id IS NULL THEN
        -- Nueva línea manual (sin evento)
        INSERT INTO public.core_external_purchase_order_lines(
          order_id, core_product_id, core_variant_id, woo_product_id, woo_variation_id,
          product_name_snapshot, variant_label_snapshot, sku_snapshot,
          quantity_ordered, unit_cost, line_subtotal, notes, status
        ) VALUES (
          p_order_id,
          NULLIF(v_line_item->>'core_product_id','')::uuid,
          NULLIF(v_line_item->>'core_variant_id','')::uuid,
          NULLIF(v_line_item->>'woo_product_id','')::bigint,
          NULLIF(v_line_item->>'woo_variation_id','')::bigint,
          v_line_item->>'product_name_snapshot',
          v_line_item->>'variant_label_snapshot',
          v_line_item->>'sku_snapshot',
          v_qty, v_cost, round(v_qty * v_cost, 4),
          v_line_item->>'notes', v_status
        );
      ELSE
        UPDATE public.core_external_purchase_order_lines
           SET quantity_ordered = coalesce(v_qty, quantity_ordered),
               unit_cost = coalesce(v_cost, unit_cost),
               line_subtotal = round(coalesce(v_qty, quantity_ordered) * coalesce(v_cost, unit_cost), 4),
               notes = coalesce(v_line_item->>'notes', notes),
               status = v_status,
               cancellation_notes = coalesce(v_line_item->>'cancellation_notes', cancellation_notes),
               updated_at = now()
         WHERE id = v_line_id AND order_id = p_order_id;
      END IF;
    END LOOP;
  END IF;

  -- Recalcular totales
  SELECT coalesce(sum(line_subtotal), 0) INTO v_subtotal
    FROM public.core_external_purchase_order_lines
    WHERE order_id = p_order_id AND status <> 'cancelled';

  v_total := v_subtotal + v_shipping + v_other;
  v_amount_paid := v_order.amount_paid;
  v_balance := v_total - v_amount_paid;
  IF v_amount_paid <= 0 THEN v_pay_status := 'pending';
  ELSIF v_amount_paid >= v_total THEN v_pay_status := 'paid';
  ELSE v_pay_status := 'partial'; END IF;

  UPDATE public.core_external_purchase_orders
     SET supplier_name_snapshot = v_supplier,
         supplier_name_normalized = public.core_normalize_supplier_name(v_supplier),
         currency = coalesce(NULLIF(p_header->>'currency',''), currency),
         shipping_cost = v_shipping,
         other_cost = v_other,
         subtotal = v_subtotal,
         total = v_total,
         balance_due = v_balance,
         payment_status = v_pay_status,
         notes = coalesce(p_header->>'notes', notes),
         estimated_delivery_date = coalesce((p_header->>'estimated_delivery_date')::date, estimated_delivery_date),
         supplier_order_reference = coalesce(p_header->>'supplier_order_reference', supplier_order_reference),
         updated_by = v_uid,
         updated_at = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'total', v_total, 'subtotal', v_subtotal);
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_update_external_purchase_order_draft(uuid, jsonb, jsonb) TO authenticated, service_role;

-- ============================================================
-- RPC 3: Aprobar
-- ============================================================
CREATE OR REPLACE FUNCTION public.core_approve_external_purchase_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_order record;
  v_active_count int;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT * INTO v_order FROM public.core_external_purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF v_order.status <> 'draft' THEN RAISE EXCEPTION 'Solo se aprueba desde borrador'; END IF;
  IF coalesce(trim(v_order.supplier_name_snapshot),'') = '' THEN RAISE EXCEPTION 'Proveedor requerido'; END IF;

  PERFORM 1 FROM public.core_external_purchase_order_lines WHERE order_id = p_order_id FOR UPDATE;

  SELECT count(*) INTO v_active_count
    FROM public.core_external_purchase_order_lines
    WHERE order_id = p_order_id AND status <> 'cancelled';
  IF v_active_count = 0 THEN RAISE EXCEPTION 'La orden no tiene líneas activas'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.core_external_purchase_order_lines
    WHERE order_id = p_order_id AND status <> 'cancelled' AND (quantity_ordered <= 0 OR unit_cost <= 0)
  ) THEN RAISE EXCEPTION 'Todas las líneas activas requieren cantidad y costo > 0'; END IF;

  IF v_order.total <= 0 THEN RAISE EXCEPTION 'Total debe ser mayor a 0'; END IF;

  UPDATE public.core_external_purchase_orders
     SET status = 'approved', approved_at = now(), approved_by = v_uid,
         updated_by = v_uid, updated_at = now()
   WHERE id = p_order_id;

  -- Resolver eventos vinculados
  UPDATE public.core_replenishment_policy_events e
     SET status = 'resolved',
         resolved_at = now(),
         resolved_by = v_uid,
         resolution_notes = 'Orden externa ' || v_order.order_number || ' aprobada',
         updated_at = now()
    FROM public.core_external_purchase_order_lines l
    WHERE l.order_id = p_order_id AND l.policy_event_id = e.id
      AND e.status <> 'resolved';

  PERFORM public.core_ext_po_audit(p_order_id, v_order.order_number, 'external_order_approved', NULL, NULL);
  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_approve_external_purchase_order(uuid) TO authenticated, service_role;

-- ============================================================
-- RPC 4: Marcar pedida
-- ============================================================
CREATE OR REPLACE FUNCTION public.core_mark_external_purchase_order_ordered(
  p_order_id uuid,
  p_reference text DEFAULT NULL,
  p_eta date DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_order record;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT * INTO v_order FROM public.core_external_purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF v_order.status <> 'approved' THEN RAISE EXCEPTION 'Solo desde approved'; END IF;

  PERFORM 1 FROM public.core_external_purchase_order_lines WHERE order_id = p_order_id FOR UPDATE;

  UPDATE public.core_external_purchase_orders
     SET status = 'ordered', ordered_at = now(), ordered_by = v_uid,
         supplier_order_reference = coalesce(p_reference, supplier_order_reference),
         estimated_delivery_date = coalesce(p_eta, estimated_delivery_date),
         notes = CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN coalesce(notes,'') || E'\n' || p_notes ELSE notes END,
         updated_by = v_uid, updated_at = now()
   WHERE id = p_order_id;

  UPDATE public.core_external_purchase_order_lines
     SET status = 'ordered', updated_at = now()
   WHERE order_id = p_order_id AND status = 'pending';

  PERFORM public.core_ext_po_audit(p_order_id, v_order.order_number, 'external_order_ordered', NULL,
    jsonb_build_object('reference', p_reference, 'eta', p_eta));
  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_mark_external_purchase_order_ordered(uuid, text, date, text) TO authenticated, service_role;

-- ============================================================
-- RPC 5: Registrar recepción
-- ============================================================
CREATE OR REPLACE FUNCTION public.core_receive_external_purchase_order(
  p_order_id uuid,
  p_lines jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_order record;
  v_line_item jsonb;
  v_line record;
  v_qty_now numeric;
  v_new_received numeric;
  v_new_status text;
  v_touched int := 0;
  v_total_lines int;
  v_all_received int;
  v_any_received int;
  v_final_status text;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT * INTO v_order FROM public.core_external_purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF v_order.status NOT IN ('ordered','partially_received') THEN
    RAISE EXCEPTION 'Solo se recibe desde ordered o partially_received';
  END IF;

  FOR v_line_item IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty_now := coalesce((v_line_item->>'qty_now')::numeric, 0);
    IF v_qty_now < 0 THEN RAISE EXCEPTION 'qty_now no puede ser negativo'; END IF;
    IF v_qty_now = 0 THEN CONTINUE; END IF;

    SELECT * INTO v_line FROM public.core_external_purchase_order_lines
      WHERE id = (v_line_item->>'line_id')::uuid AND order_id = p_order_id FOR UPDATE;
    IF v_line.id IS NULL THEN RAISE EXCEPTION 'Línea no encontrada'; END IF;
    IF v_line.status = 'cancelled' THEN RAISE EXCEPTION 'Línea cancelada'; END IF;

    v_new_received := v_line.quantity_received + v_qty_now;
    IF v_new_received > v_line.quantity_ordered THEN
      RAISE EXCEPTION 'Recepción supera cantidad pedida en línea %', v_line.id;
    END IF;

    IF v_new_received = 0 THEN v_new_status := 'ordered';
    ELSIF v_new_received < v_line.quantity_ordered THEN v_new_status := 'partially_received';
    ELSE v_new_status := 'received'; END IF;

    UPDATE public.core_external_purchase_order_lines
       SET quantity_received = v_new_received,
           status = v_new_status,
           updated_at = now()
     WHERE id = v_line.id;
    v_touched := v_touched + 1;
  END LOOP;

  IF v_touched = 0 THEN RAISE EXCEPTION 'Se requiere al menos una recepción'; END IF;

  -- Estado orden
  SELECT count(*) FILTER (WHERE status <> 'cancelled'),
         count(*) FILTER (WHERE status = 'received'),
         count(*) FILTER (WHERE quantity_received > 0 AND status <> 'cancelled')
    INTO v_total_lines, v_all_received, v_any_received
    FROM public.core_external_purchase_order_lines WHERE order_id = p_order_id;

  IF v_all_received = v_total_lines THEN
    v_final_status := 'received';
    UPDATE public.core_external_purchase_orders
       SET status = 'received', received_at = now(), received_by = v_uid,
           updated_by = v_uid, updated_at = now()
     WHERE id = p_order_id;
  ELSE
    v_final_status := 'partially_received';
    UPDATE public.core_external_purchase_orders
       SET status = 'partially_received', updated_by = v_uid, updated_at = now()
     WHERE id = p_order_id;
  END IF;

  PERFORM public.core_ext_po_audit(p_order_id, v_order.order_number,
    CASE WHEN v_final_status = 'received' THEN 'external_order_received' ELSE 'external_order_partially_received' END,
    NULL, jsonb_build_object('touched', v_touched));

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', v_final_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_receive_external_purchase_order(uuid, jsonb) TO authenticated, service_role;

-- ============================================================
-- RPC 6: Cancelar
-- ============================================================
CREATE OR REPLACE FUNCTION public.core_cancel_external_purchase_order(
  p_order_id uuid, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_order record;
  v_received_sum numeric;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF coalesce(trim(p_reason),'') = '' THEN RAISE EXCEPTION 'Motivo requerido'; END IF;

  SELECT * INTO v_order FROM public.core_external_purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF v_order.status IN ('cancelled','received') THEN RAISE EXCEPTION 'Orden no cancelable'; END IF;

  SELECT coalesce(sum(quantity_received),0) INTO v_received_sum
    FROM public.core_external_purchase_order_lines WHERE order_id = p_order_id;
  IF v_received_sum > 0 THEN
    RAISE EXCEPTION 'No se puede cancelar: existen recepciones registradas';
  END IF;

  UPDATE public.core_external_purchase_orders
     SET status = 'cancelled', cancellation_reason = p_reason,
         cancelled_at = now(), cancelled_by = v_uid,
         updated_by = v_uid, updated_at = now()
   WHERE id = p_order_id;

  PERFORM public.core_ext_po_audit(p_order_id, v_order.order_number, 'external_order_cancelled', NULL,
    jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_cancel_external_purchase_order(uuid, text) TO authenticated, service_role;

-- ============================================================
-- RPC 7: Reabrir
-- ============================================================
CREATE OR REPLACE FUNCTION public.core_reopen_external_purchase_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_order record;
  v_received_sum numeric;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT * INTO v_order FROM public.core_external_purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF v_order.status <> 'cancelled' THEN RAISE EXCEPTION 'Solo se reabren órdenes canceladas'; END IF;

  SELECT coalesce(sum(quantity_received),0) INTO v_received_sum
    FROM public.core_external_purchase_order_lines WHERE order_id = p_order_id;
  IF v_received_sum > 0 THEN RAISE EXCEPTION 'La orden tiene recepciones'; END IF;

  UPDATE public.core_external_purchase_orders
     SET status = 'draft', cancellation_reason = NULL,
         cancelled_at = NULL, cancelled_by = NULL,
         approved_at = NULL, approved_by = NULL,
         ordered_at = NULL, ordered_by = NULL,
         updated_by = v_uid, updated_at = now()
   WHERE id = p_order_id;

  UPDATE public.core_external_purchase_order_lines
     SET status = 'pending', updated_at = now()
   WHERE order_id = p_order_id AND status <> 'cancelled';

  PERFORM public.core_ext_po_audit(p_order_id, v_order.order_number, 'external_order_reopened', NULL, NULL);
  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_reopen_external_purchase_order(uuid) TO authenticated, service_role;

-- ============================================================
-- RPC 8: Actualizar pago
-- ============================================================
CREATE OR REPLACE FUNCTION public.core_update_external_purchase_order_payment(
  p_order_id uuid, p_amount_paid numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_order record;
  v_balance numeric;
  v_status text;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_amount_paid IS NULL OR p_amount_paid < 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;

  SELECT * INTO v_order FROM public.core_external_purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF p_amount_paid > v_order.total THEN RAISE EXCEPTION 'Monto pagado no puede superar total'; END IF;

  v_balance := v_order.total - p_amount_paid;
  IF p_amount_paid = 0 THEN v_status := 'pending';
  ELSIF p_amount_paid >= v_order.total THEN v_status := 'paid';
  ELSE v_status := 'partial'; END IF;

  UPDATE public.core_external_purchase_orders
     SET amount_paid = p_amount_paid, balance_due = v_balance, payment_status = v_status,
         updated_by = v_uid, updated_at = now()
   WHERE id = p_order_id;

  PERFORM public.core_ext_po_audit(p_order_id, v_order.order_number, 'external_order_payment_updated',
    jsonb_build_object('amount_paid', v_order.amount_paid),
    jsonb_build_object('amount_paid', p_amount_paid, 'payment_status', v_status));
  RETURN jsonb_build_object('ok', true, 'balance_due', v_balance, 'payment_status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_update_external_purchase_order_payment(uuid, numeric) TO authenticated, service_role;
