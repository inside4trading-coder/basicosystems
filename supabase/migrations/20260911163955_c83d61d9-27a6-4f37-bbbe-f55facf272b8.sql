CREATE TABLE IF NOT EXISTS public.sublime_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.sublime_variants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.sublime_locations(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  qty_delta integer NOT NULL DEFAULT 0,
  qty_result integer NOT NULL DEFAULT 0,
  proposal_id uuid REFERENCES public.sublime_stock_intake_proposals(id) ON DELETE SET NULL,
  performed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sublime_inventory_movements TO authenticated;
GRANT ALL ON public.sublime_inventory_movements TO service_role;

ALTER TABLE public.sublime_inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sublime_movements_read" ON public.sublime_inventory_movements
FOR SELECT TO authenticated USING (true);

CREATE POLICY "sublime_movements_write" ON public.sublime_inventory_movements
FOR INSERT TO authenticated
WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));

CREATE INDEX IF NOT EXISTS idx_sublime_movements_variant ON public.sublime_inventory_movements(variant_id, location_id);
CREATE INDEX IF NOT EXISTS idx_sublime_movements_created ON public.sublime_inventory_movements(created_at DESC);

CREATE OR REPLACE FUNCTION public.sublime_confirm_initial_validation(
  p_variant_id uuid,
  p_counts jsonb,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_now timestamptz := now();
  v_item jsonb;
  v_loc uuid;
  v_qty integer;
  v_prev integer;
  v_prop_id uuid;
  v_total integer := 0;
  v_locations integer := 0;
BEGIN
  IF v_user IS NULL OR NOT public.has_module_access(v_user, '/sublime') THEN
    RAISE EXCEPTION 'No tienes permiso para confirmar inventario de Sublime.';
  END IF;

  IF p_counts IS NULL OR jsonb_typeof(p_counts) <> 'array' OR jsonb_array_length(p_counts) = 0 THEN
    RAISE EXCEPTION 'No se recibieron conteos para confirmar.';
  END IF;

  -- Bloquea las propuestas de esta variante y rechaza si ya hay confirmación.
  PERFORM 1 FROM public.sublime_stock_intake_proposals
   WHERE variant_id = p_variant_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.sublime_stock_intake_proposals
     WHERE variant_id = p_variant_id AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'Esta variante ya tiene un conteo confirmado.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_counts)
  LOOP
    v_loc := (v_item->>'location_id')::uuid;
    v_qty := COALESCE((v_item->>'qty')::integer, 0);
    IF v_loc IS NULL THEN
      RAISE EXCEPTION 'Conteo sin ubicación válida.';
    END IF;
    IF v_qty < 0 THEN
      RAISE EXCEPTION 'Las cantidades no pueden ser negativas.';
    END IF;

    SELECT quantity_on_hand INTO v_prev
      FROM public.sublime_stocks
     WHERE variant_id = p_variant_id AND location_id = v_loc
     FOR UPDATE;

    INSERT INTO public.sublime_stocks (variant_id, location_id, quantity_on_hand, last_counted_at)
    VALUES (p_variant_id, v_loc, v_qty, v_now)
    ON CONFLICT (variant_id, location_id)
    DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand,
                  last_counted_at = EXCLUDED.last_counted_at;

    UPDATE public.sublime_stock_intake_proposals
       SET counted_qty = v_qty,
           status = 'confirmed',
           note = COALESCE(p_note, note),
           confirmed_at = v_now,
           confirmed_by = v_user
     WHERE variant_id = p_variant_id AND location_id = v_loc
     RETURNING id INTO v_prop_id;

    IF v_prop_id IS NULL THEN
      INSERT INTO public.sublime_stock_intake_proposals
        (variant_id, location_id, suggested_qty, counted_qty, status, note, confirmed_at, confirmed_by)
      VALUES (p_variant_id, v_loc, 0, v_qty, 'confirmed', p_note, v_now, v_user)
      RETURNING id INTO v_prop_id;
    END IF;

    INSERT INTO public.sublime_inventory_movements
      (variant_id, location_id, movement_type, qty_delta, qty_result, proposal_id, performed_by, note)
    VALUES (p_variant_id, v_loc, 'initial_inventory_validation',
            v_qty - COALESCE(v_prev, 0), v_qty, v_prop_id, v_user, p_note);

    v_total := v_total + v_qty;
    v_locations := v_locations + 1;
    v_prop_id := NULL;
  END LOOP;

  RETURN jsonb_build_object('variant_id', p_variant_id, 'total', v_total, 'locations', v_locations, 'confirmed_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sublime_confirm_initial_validation(uuid, jsonb, text) TO authenticated;