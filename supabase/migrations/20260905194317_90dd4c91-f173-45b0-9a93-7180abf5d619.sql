ALTER TABLE public.esp_fabrication_material_consumptions
  ADD COLUMN IF NOT EXISTS expected_material_id uuid,
  ADD COLUMN IF NOT EXISTS expected_variant_id uuid,
  ADD COLUMN IF NOT EXISTS actual_material_id uuid,
  ADD COLUMN IF NOT EXISTS was_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason text;

CREATE OR REPLACE FUNCTION public.esp_consume_materials_for_fabrication_request(
  p_request_id uuid,
  p_location_id uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_overrides jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_req record;
  v_norm text;
  v_loc uuid;
  v_recipe_id uuid;
  v_already int;
  v_item record;
  v_resolved uuid;
  v_expected uuid;
  v_override uuid;
  v_overridden boolean;
  v_base record;
  v_target record;
  v_expected_mat record;
  v_actual_mat record;
  v_before numeric;
  v_after numeric;
  v_mov_id uuid;
  v_consumed_count int := 0;
  v_override_count int := 0;
  v_total_qty numeric := 0;
  v_planned numeric;
  v_mov_note text;
BEGIN
  v_is_priv := public.has_module_access(v_uid, '/espana');
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT * INTO v_req FROM public.esp_fabrication_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_req.is_legacy THEN RAISE EXCEPTION 'Solicitud legacy: no consumible'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Solicitud no está pendiente (estado: %)', v_req.status; END IF;

  SELECT COUNT(*) INTO v_already FROM public.esp_fabrication_material_consumptions WHERE fabrication_request_id = p_request_id;
  IF v_already > 0 THEN RAISE EXCEPTION 'Esta solicitud ya tiene materiales consumidos'; END IF;

  v_norm := public.esp_normalize_size(v_req.variant_label);

  v_loc := COALESCE(p_location_id,
    (SELECT id FROM public.esp_locations WHERE code='ARTURO_SORIA' AND is_active=true LIMIT 1));
  IF v_loc IS NULL THEN RAISE EXCEPTION 'No hay ubicación de almacén configurada'; END IF;

  SELECT id INTO v_recipe_id FROM public.esp_product_material_recipes
   WHERE status='active' AND product_id = v_req.product_id AND variant_id = v_req.variant_id
   ORDER BY created_at DESC LIMIT 1;
  IF v_recipe_id IS NULL THEN
    SELECT id INTO v_recipe_id FROM public.esp_product_material_recipes
     WHERE status='active' AND product_id = v_req.product_id AND variant_id IS NULL
     ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_recipe_id IS NULL THEN RAISE EXCEPTION 'No hay receta activa para este producto'; END IF;

  FOR v_item IN
    SELECT * FROM public.esp_product_material_recipe_items WHERE recipe_id = v_recipe_id ORDER BY id
  LOOP
    v_planned := v_item.quantity_per_unit * v_req.quantity;
    v_expected := NULL;
    v_overridden := false;

    IF v_item.size_strategy = 'fixed' THEN
      v_expected := v_item.material_id;
    ELSIF v_item.size_strategy = 'match_variant_size' THEN
      SELECT * INTO v_base FROM public.esp_material_items WHERE id = v_item.material_id;
      IF v_norm = '' THEN
        v_expected := NULL;
      ELSE
        SELECT * INTO v_target FROM public.esp_material_items
         WHERE status='active'
           AND material_type = v_base.material_type
           AND name = v_base.name
           AND COALESCE(color,'') = COALESCE(v_base.color,'')
           AND UPPER(COALESCE(normalized_size, size, '')) = v_norm
         LIMIT 1;
        v_expected := v_target.id;
      END IF;
    ELSE
      v_expected := v_item.material_id;
    END IF;

    -- override elegido por el operario para esta línea de receta
    SELECT NULLIF(o->>'material_id','')::uuid INTO v_override
      FROM jsonb_array_elements(COALESCE(p_overrides, '[]'::jsonb)) o
     WHERE NULLIF(o->>'recipe_item_id','')::uuid = v_item.id
     LIMIT 1;

    IF v_override IS NOT NULL AND v_override IS DISTINCT FROM v_expected THEN
      SELECT * INTO v_actual_mat FROM public.esp_material_items WHERE id = v_override;
      IF v_actual_mat.id IS NULL THEN
        RAISE EXCEPTION 'Material sustituto no encontrado';
      END IF;
      IF v_actual_mat.status <> 'active' THEN
        RAISE EXCEPTION 'El material sustituto % no está activo', COALESCE(v_actual_mat.sku, v_actual_mat.name);
      END IF;
      IF v_expected IS NOT NULL THEN
        SELECT * INTO v_expected_mat FROM public.esp_material_items WHERE id = v_expected;
        IF v_expected_mat.id IS NOT NULL AND v_actual_mat.material_type <> v_expected_mat.material_type THEN
          RAISE EXCEPTION 'El material sustituto debe ser del mismo tipo (% vs %)', v_actual_mat.material_type, v_expected_mat.material_type;
        END IF;
      END IF;
      v_resolved := v_override;
      v_overridden := true;
      v_override_count := v_override_count + 1;
    ELSE
      IF v_expected IS NULL THEN
        IF v_item.size_strategy = 'match_variant_size' AND v_norm = '' THEN
          RAISE EXCEPTION 'Solicitud sin talla, no se puede resolver match_variant_size';
        END IF;
        RAISE EXCEPTION 'Sin material disponible para la talla % en la receta', COALESCE(NULLIF(v_norm,''), '—');
      END IF;
      v_resolved := v_expected;
      SELECT * INTO v_actual_mat FROM public.esp_material_items WHERE id = v_resolved;
    END IF;

    -- revalidación de stock en el momento de confirmar
    SELECT quantity_on_hand INTO v_before FROM public.esp_material_stock
      WHERE material_id = v_resolved AND location_id = v_loc FOR UPDATE;
    IF v_before IS NULL THEN v_before := 0; END IF;
    IF v_before < v_planned THEN
      RAISE EXCEPTION 'Stock insuficiente para % (disponible %, requerido %)',
        COALESCE(v_actual_mat.sku, v_actual_mat.name, v_resolved::text), v_before, v_planned;
    END IF;

    v_after := v_before - v_planned;

    INSERT INTO public.esp_material_stock(material_id, location_id, quantity_on_hand, updated_by)
      VALUES (v_resolved, v_loc, v_after, v_uid)
      ON CONFLICT (material_id, location_id) DO UPDATE
      SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_by = v_uid, updated_at = now();

    v_mov_note := p_notes;
    IF v_overridden THEN
      SELECT * INTO v_expected_mat FROM public.esp_material_items WHERE id = v_expected;
      v_mov_note := COALESCE(v_mov_note || ' · ', '')
        || 'Material sustituido: previsto '
        || COALESCE(v_expected_mat.sku, v_expected_mat.name, '—')
        || ' → usado '
        || COALESCE(v_actual_mat.sku, v_actual_mat.name, '—');
    END IF;

    INSERT INTO public.esp_material_movements(
      material_id, location_id, movement_type, quantity, quantity_before, quantity_after,
      reason, notes, reference_type, reference_id, created_by
    ) VALUES (
      v_resolved, v_loc, 'fabrication_consumption', v_planned, v_before, v_after,
      CASE WHEN v_overridden THEN 'Consumo fabricación ES (material sustituido)' ELSE 'Consumo fabricación ES' END,
      v_mov_note, 'esp_fabrication_request', p_request_id, v_uid
    ) RETURNING id INTO v_mov_id;

    INSERT INTO public.esp_fabrication_material_consumptions(
      fabrication_request_id, recipe_id, recipe_item_id, material_id, material_movement_id,
      location_id, planned_quantity, consumed_quantity, size_strategy, notes, created_by,
      expected_material_id, expected_variant_id, actual_material_id, was_overridden, override_reason
    ) VALUES (
      p_request_id, v_recipe_id, v_item.id, v_resolved, v_mov_id,
      v_loc, v_planned, v_planned, v_item.size_strategy, p_notes, v_uid,
      v_expected, v_req.variant_id, v_resolved, v_overridden,
      CASE WHEN v_overridden THEN p_notes ELSE NULL END
    );

    v_consumed_count := v_consumed_count + 1;
    v_total_qty := v_total_qty + v_planned;
  END LOOP;

  UPDATE public.esp_fabrication_requests
     SET status = 'in_progress', updated_at = now(), updated_by = v_uid
   WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'recipe_id', v_recipe_id,
    'location_id', v_loc,
    'materials_consumed', v_consumed_count,
    'materials_overridden', v_override_count,
    'total_quantity', v_total_qty
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.esp_consume_materials_for_fabrication_request(uuid, uuid, text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.esp_resolve_fabrication_materials(p_request_id uuid, p_location_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req record;
  v_norm text;
  v_loc uuid;
  v_recipe_id uuid;
  v_already_consumed int;
  v_item record;
  v_resolved_mat uuid;
  v_base_mat record;
  v_target_mat record;
  v_stock numeric;
  v_planned numeric;
  v_materials jsonb := '[]'::jsonb;
  v_all_ok boolean := true;
  v_reason text := null;
BEGIN
  SELECT * INTO v_req FROM public.esp_fabrication_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'request_not_found');
  END IF;

  v_norm := public.esp_normalize_size(v_req.variant_label);

  v_loc := COALESCE(p_location_id,
    (SELECT id FROM public.esp_locations WHERE code='ARTURO_SORIA' AND is_active=true LIMIT 1));

  SELECT COUNT(*) INTO v_already_consumed
    FROM public.esp_fabrication_material_consumptions WHERE fabrication_request_id = p_request_id;

  SELECT id INTO v_recipe_id FROM public.esp_product_material_recipes
   WHERE status='active' AND product_id = v_req.product_id AND variant_id = v_req.variant_id
   ORDER BY created_at DESC LIMIT 1;
  IF v_recipe_id IS NULL THEN
    SELECT id INTO v_recipe_id FROM public.esp_product_material_recipes
     WHERE status='active' AND product_id = v_req.product_id AND variant_id IS NULL
     ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_recipe_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'no_recipe',
      'request', to_jsonb(v_req),
      'normalized_size', v_norm,
      'location_id', v_loc,
      'already_consumed', v_already_consumed
    );
  END IF;

  FOR v_item IN
    SELECT * FROM public.esp_product_material_recipe_items WHERE recipe_id = v_recipe_id ORDER BY id
  LOOP
    v_planned := v_item.quantity_per_unit * v_req.quantity;
    v_resolved_mat := NULL;
    v_reason := NULL;
    v_base_mat := NULL;

    IF v_item.size_strategy = 'fixed' THEN
      v_resolved_mat := v_item.material_id;
      SELECT * INTO v_base_mat FROM public.esp_material_items WHERE id = v_item.material_id;
    ELSIF v_item.size_strategy = 'match_variant_size' THEN
      SELECT * INTO v_base_mat FROM public.esp_material_items WHERE id = v_item.material_id;
      IF v_norm = '' THEN
        v_reason := 'request_size_missing';
      ELSE
        SELECT * INTO v_target_mat FROM public.esp_material_items
         WHERE status='active'
           AND material_type = v_base_mat.material_type
           AND name = v_base_mat.name
           AND COALESCE(color,'') = COALESCE(v_base_mat.color,'')
           AND UPPER(COALESCE(normalized_size, size, '')) = v_norm
         LIMIT 1;
        IF v_target_mat.id IS NULL THEN
          v_reason := 'no_matching_size';
        ELSE
          v_resolved_mat := v_target_mat.id;
        END IF;
      END IF;
    ELSIF v_item.size_strategy = 'manual_select' THEN
      v_resolved_mat := v_item.material_id;
      SELECT * INTO v_base_mat FROM public.esp_material_items WHERE id = v_item.material_id;
      v_reason := 'manual_select';
    ELSE
      v_resolved_mat := v_item.material_id;
      SELECT * INTO v_base_mat FROM public.esp_material_items WHERE id = v_item.material_id;
    END IF;

    IF v_resolved_mat IS NOT NULL THEN
      SELECT * INTO v_target_mat FROM public.esp_material_items WHERE id = v_resolved_mat;
      SELECT COALESCE(SUM(quantity_on_hand),0) INTO v_stock
        FROM public.esp_material_stock WHERE material_id = v_resolved_mat AND location_id = v_loc;
    ELSE
      v_target_mat := NULL;
      v_stock := 0;
    END IF;

    v_materials := v_materials || jsonb_build_object(
      'recipe_item_id', v_item.id,
      'size_strategy', v_item.size_strategy,
      'required_qty_per_unit', v_item.quantity_per_unit,
      'planned_quantity', v_planned,
      'resolved_material_id', v_resolved_mat,
      'expected_material_id', v_resolved_mat,
      'base_material_id', v_item.material_id,
      'family_material_type', COALESCE(v_base_mat.material_type, v_target_mat.material_type, NULL),
      'family_name', COALESCE(v_base_mat.name, NULL),
      'family_color', COALESCE(v_base_mat.color, NULL),
      'material_sku', COALESCE(v_target_mat.sku, NULL),
      'material_name', COALESCE(v_target_mat.name, NULL),
      'material_color', COALESCE(v_target_mat.color, NULL),
      'material_size', COALESCE(v_target_mat.size, NULL),
      'material_type', COALESCE(v_target_mat.material_type, NULL),
      'available', v_stock,
      'ok', (v_resolved_mat IS NOT NULL AND v_stock >= v_planned),
      'reason', v_reason
    );

    IF v_resolved_mat IS NULL OR v_stock < v_planned THEN
      v_all_ok := false;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'request', to_jsonb(v_req),
    'normalized_size', v_norm,
    'location_id', v_loc,
    'recipe_id', v_recipe_id,
    'materials', v_materials,
    'all_ok', v_all_ok,
    'already_consumed', v_already_consumed
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.esp_resolve_fabrication_materials(uuid, uuid) TO authenticated, service_role;