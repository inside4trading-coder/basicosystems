CREATE TABLE public.core_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number text UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  destination_location_id uuid,
  destination_location_name text,
  factory_responsible text,
  carrier_name text,
  production_order_id uuid,
  expected_departure_date date,
  notes text,
  closed_at timestamptz,
  sent_at timestamptz,
  received_at timestamptz,
  received_by_name text,
  difference_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_dispatches TO authenticated;
GRANT ALL ON public.core_dispatches TO service_role;
ALTER TABLE public.core_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage dispatches" ON public.core_dispatches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_core_dispatches_updated_at
BEFORE UPDATE ON public.core_dispatches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.core_dispatch_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES public.core_dispatches(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL,
  unit_code text NOT NULL,
  production_order_id uuid,
  product_name text,
  sku text,
  size text,
  status text NOT NULL DEFAULT 'in_dispatch',
  received_at timestamptz,
  difference_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_dispatch_units TO authenticated;
GRANT ALL ON public.core_dispatch_units TO service_role;
ALTER TABLE public.core_dispatch_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage dispatch units" ON public.core_dispatch_units FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX uq_dispatch_unit_pair ON public.core_dispatch_units (dispatch_id, unit_id);
CREATE INDEX idx_dispatch_units_dispatch ON public.core_dispatch_units (dispatch_id);
CREATE INDEX idx_dispatch_units_unit ON public.core_dispatch_units (unit_id);

-- Una unidad no puede estar en dos despachos activos
CREATE UNIQUE INDEX uq_unit_active_dispatch
ON public.core_dispatch_units (unit_id)
WHERE status = 'in_dispatch';

CREATE SEQUENCE IF NOT EXISTS public.core_dispatch_number_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.core_dispatch_number_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.core_close_dispatch(_dispatch_id uuid, _factory_responsible text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.core_dispatches%ROWTYPE;
  n integer;
  num text;
  cnt integer;
BEGIN
  SELECT * INTO d FROM public.core_dispatches WHERE id = _dispatch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Despacho no encontrado'; END IF;
  IF d.status <> 'draft' THEN
    RETURN jsonb_build_object('ok', true, 'already_closed', true, 'dispatch_number', d.dispatch_number);
  END IF;

  SELECT count(*) INTO cnt FROM public.core_dispatch_units WHERE dispatch_id = _dispatch_id;
  IF cnt = 0 THEN RAISE EXCEPTION 'El despacho no tiene unidades'; END IF;

  n := nextval('public.core_dispatch_number_seq');
  num := 'DSP-' || lpad(n::text, 6, '0');

  UPDATE public.core_dispatches
  SET status = 'closed',
      dispatch_number = num,
      closed_at = now(),
      factory_responsible = COALESCE(_factory_responsible, factory_responsible),
      created_by = COALESCE(created_by, auth.uid())
  WHERE id = _dispatch_id;

  UPDATE public.core_production_units u
  SET status = 'in_dispatch'
  WHERE u.id IN (SELECT unit_id FROM public.core_dispatch_units WHERE dispatch_id = _dispatch_id)
    AND u.status NOT IN ('entered_inventory','received_in_store');

  RETURN jsonb_build_object('ok', true, 'dispatch_number', num, 'units', cnt);
END;
$$;

CREATE OR REPLACE FUNCTION public.core_receive_dispatch(
  _dispatch_id uuid,
  _received_unit_ids uuid[],
  _received_by text DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.core_dispatches%ROWTYPE;
  total integer;
  recv integer;
  new_status text;
BEGIN
  SELECT * INTO d FROM public.core_dispatches WHERE id = _dispatch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Despacho no encontrado'; END IF;
  IF d.status IN ('received','received_with_differences') THEN
    RETURN jsonb_build_object('ok', true, 'already_received', true, 'status', d.status);
  END IF;
  IF d.status NOT IN ('closed','sent') THEN
    RAISE EXCEPTION 'El despacho debe estar cerrado o enviado para recibirse';
  END IF;

  SELECT count(*) INTO total FROM public.core_dispatch_units WHERE dispatch_id = _dispatch_id;

  UPDATE public.core_dispatch_units
  SET status = 'received', received_at = now()
  WHERE dispatch_id = _dispatch_id
    AND unit_id = ANY(_received_unit_ids);

  UPDATE public.core_dispatch_units
  SET status = 'missing', difference_note = COALESCE(difference_note, _note)
  WHERE dispatch_id = _dispatch_id
    AND NOT (unit_id = ANY(_received_unit_ids));

  SELECT count(*) INTO recv FROM public.core_dispatch_units
  WHERE dispatch_id = _dispatch_id AND status = 'received';

  new_status := CASE WHEN recv = total THEN 'received' ELSE 'received_with_differences' END;

  UPDATE public.core_dispatches
  SET status = new_status,
      received_at = now(),
      received_by_name = COALESCE(_received_by, received_by_name),
      difference_note = COALESCE(_note, difference_note)
  WHERE id = _dispatch_id;

  UPDATE public.core_production_units u
  SET status = 'received_in_store'
  FROM public.core_dispatch_units du
  WHERE du.dispatch_id = _dispatch_id
    AND du.status = 'received'
    AND u.id = du.unit_id
    AND u.status NOT IN ('entered_inventory','received_in_store');

  RETURN jsonb_build_object('ok', true, 'status', new_status, 'received', recv, 'total', total);
END;
$$;