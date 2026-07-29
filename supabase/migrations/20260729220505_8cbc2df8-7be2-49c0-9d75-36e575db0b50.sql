CREATE OR REPLACE FUNCTION public.esp_register_public_pos_sale(
  p_channel_id uuid,
  p_location_id uuid,
  p_payment_method_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL::text,
  p_payment_reference text DEFAULT NULL::text,
  p_allow_negative boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
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
  IF p_location_id IS NULL THEN RAISE EXCEPTION 'Sede requerida'; END IF;
  IF p_payment_method_id IS NULL THEN RAISE EXCEPTION 'Método de pago requerido'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Carrito vacío'; END IF;

  SELECT * INTO v_loc FROM public.esp_locations WHERE id = p_location_id AND is_active = true;
  IF v_loc.id IS NULL THEN RAISE EXCEPTION 'Sede inválida'; END IF;
  IF v_loc.public_pos_enabled IS NOT TRUE THEN RAISE EXCEPTION 'POS público desactivado para esta sede'; END IF;
  IF v_loc.inventory_mode NOT IN ('own_stock','linked_stock') THEN
    RAISE EXCEPTION 'Sede no permite POS (modo: %)', v_loc.inventory_mode;
  END IF;
  v_inv_loc := CASE WHEN v_loc.inventory_mode='linked_stock' AND v_loc.linked_location_id IS NOT NULL
                    THEN v_loc.linked_location_id ELSE p_location_id END;

  v_sale_number := 'ES-POS-' || LPAD(nextval('public.esp_sale_number_seq')::text, 6, '0');

  INSERT INTO public.esp_sales(sale_number, channel_id, location_id, inventory_location_id, user_id, status, subtotal_eur, total_eur, payment_status, notes, created_by, source)
    VALUES (v_sale_number, p_channel_id, p_location_id, v_inv_loc, NULL, 'completed', 0, 0, 'paid', p_notes, NULL, 'public_pos')
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

    SELECT quantity_on_hand INTO v_stock FROM public.esp_inventory_stock
      WHERE location_id = v_inv_loc AND variant_id = v_variant.id FOR UPDATE;
    IF v_stock IS NULL THEN v_stock := 0; END IF;
    IF v_stock < v_qty AND NOT p_allow_negative THEN
      RAISE EXCEPTION 'Stock insuficiente para % (disponible %, requerido %)', v_variant.variant_sku, v_stock, v_qty;
    END IF;
    v_before := v_stock;
    v_after := v_stock - v_qty;
    INSERT INTO public.esp_inventory_stock(location_id, product_id, variant_id, quantity_on_hand, updated_by)
      VALUES (v_inv_loc, v_variant.product_id, v_variant.id, v_after, NULL)
      ON CONFLICT (location_id, variant_id) DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_at = now();

    INSERT INTO public.esp_inventory_movements(movement_type, location_id, product_id, variant_id, quantity, quantity_before, quantity_after, reason, reference_type, reference_id, created_by)
      VALUES ('sale_pos', v_inv_loc, v_variant.product_id, v_variant.id, v_qty, v_before, v_after, 'Venta POS público', 'esp_sale', v_sale_id::text, NULL)
      RETURNING id INTO v_mov_id;

    INSERT INTO public.esp_sale_items(sale_id, product_id, variant_id, sku_snapshot, product_name_snapshot, variant_label_snapshot, quantity, unit_price_eur, subtotal_eur, inventory_movement_id)
      VALUES (v_sale_id, v_variant.product_id, v_variant.id, v_variant.variant_sku, v_variant.p_name,
              COALESCE(v_variant.size,'') || CASE WHEN v_variant.color IS NOT NULL THEN ' · ' || v_variant.color ELSE '' END,
              v_qty, v_unit, v_line_sub, v_mov_id);
  END LOOP;

  v_total := v_subtotal;

  UPDATE public.esp_sales SET subtotal_eur = v_subtotal, total_eur = v_total WHERE id = v_sale_id;

  INSERT INTO public.esp_sale_payments(sale_id, payment_method_id, amount_eur, reference, created_by)
    VALUES (v_sale_id, p_payment_method_id, v_total, p_payment_reference, NULL);

  RETURN jsonb_build_object('ok', true, 'sale_id', v_sale_id, 'sale_number', v_sale_number, 'total_eur', v_total, 'location_id', p_location_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.esp_register_public_pos_sale(uuid,uuid,uuid,jsonb,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.esp_register_public_pos_sale(uuid,uuid,uuid,jsonb,text,text,boolean) TO service_role;