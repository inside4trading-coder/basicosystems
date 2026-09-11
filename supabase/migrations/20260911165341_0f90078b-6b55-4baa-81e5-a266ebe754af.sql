CREATE OR REPLACE FUNCTION public.sublime_transfer_stock(
  p_variant_id uuid,
  p_from_location uuid,
  p_to_location uuid,
  p_qty integer,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_qty integer := COALESCE(p_qty, 0);
  v_from_on_hand integer;
  v_from_avail integer;
  v_to_on_hand integer;
BEGIN
  IF v_user IS NULL OR NOT public.has_module_access(v_user, '/sublime') THEN
    RAISE EXCEPTION 'No tienes permiso para mover inventario de Sublime.';
  END IF;

  IF p_variant_id IS NULL OR p_from_location IS NULL OR p_to_location IS NULL THEN
    RAISE EXCEPTION 'Faltan datos para el traslado.';
  END IF;

  IF p_from_location = p_to_location THEN
    RAISE EXCEPTION 'El origen y el destino deben ser distintos.';
  END IF;

  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.';
  END IF;

  SELECT quantity_on_hand, quantity_available
    INTO v_from_on_hand, v_from_avail
    FROM public.sublime_stocks
   WHERE variant_id = p_variant_id AND location_id = p_from_location
   FOR UPDATE;

  IF v_from_on_hand IS NULL THEN
    RAISE EXCEPTION 'No hay existencias de esta variante en la ubicación de origen.';
  END IF;

  IF v_qty > COALESCE(v_from_avail, 0) THEN
    RAISE EXCEPTION 'No puedes mover % unidades: solo hay % disponibles en origen.', v_qty, COALESCE(v_from_avail, 0);
  END IF;

  SELECT quantity_on_hand INTO v_to_on_hand
    FROM public.sublime_stocks
   WHERE variant_id = p_variant_id AND location_id = p_to_location
   FOR UPDATE;

  UPDATE public.sublime_stocks
     SET quantity_on_hand = v_from_on_hand - v_qty
   WHERE variant_id = p_variant_id AND location_id = p_from_location;

  INSERT INTO public.sublime_stocks (variant_id, location_id, quantity_on_hand)
  VALUES (p_variant_id, p_to_location, COALESCE(v_to_on_hand, 0) + v_qty)
  ON CONFLICT (variant_id, location_id)
  DO UPDATE SET quantity_on_hand = COALESCE(v_to_on_hand, 0) + v_qty;

  INSERT INTO public.sublime_inventory_movements
    (variant_id, location_id, movement_type, qty_delta, qty_result, performed_by, note)
  VALUES
    (p_variant_id, p_from_location, 'location_transfer', -v_qty, v_from_on_hand - v_qty, v_user, p_note),
    (p_variant_id, p_to_location, 'location_transfer', v_qty, COALESCE(v_to_on_hand, 0) + v_qty, v_user, p_note);

  RETURN jsonb_build_object(
    'variant_id', p_variant_id,
    'qty', v_qty,
    'from_result', v_from_on_hand - v_qty,
    'to_result', COALESCE(v_to_on_hand, 0) + v_qty
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sublime_transfer_stock(uuid, uuid, uuid, integer, text) TO authenticated;