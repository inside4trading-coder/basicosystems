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
    v_target_mat := NULL;

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
REVOKE EXECUTE ON FUNCTION public.esp_resolve_fabrication_materials(uuid, uuid) FROM PUBLIC, anon;