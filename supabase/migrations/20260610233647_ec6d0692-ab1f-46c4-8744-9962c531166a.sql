
-- =====================================================
-- TABLE: esp_fabrication_material_consumptions
-- =====================================================
CREATE TABLE public.esp_fabrication_material_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fabrication_request_id uuid NOT NULL REFERENCES public.esp_fabrication_requests(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.esp_product_material_recipes(id) ON DELETE SET NULL,
  recipe_item_id uuid REFERENCES public.esp_product_material_recipe_items(id) ON DELETE SET NULL,
  material_id uuid NOT NULL REFERENCES public.esp_material_items(id) ON DELETE RESTRICT,
  material_movement_id uuid REFERENCES public.esp_material_movements(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.esp_locations(id) ON DELETE SET NULL,
  planned_quantity numeric(12,2) NOT NULL,
  consumed_quantity numeric(12,2) NOT NULL,
  size_strategy text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_fabrication_material_consumptions TO authenticated;
GRANT ALL ON public.esp_fabrication_material_consumptions TO service_role;

ALTER TABLE public.esp_fabrication_material_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esp_fab_consumptions_select_auth"
  ON public.esp_fabrication_material_consumptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_fab_consumptions_write_admin_manager"
  ON public.esp_fabrication_material_consumptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE INDEX idx_esp_fab_cons_request ON public.esp_fabrication_material_consumptions(fabrication_request_id);
CREATE INDEX idx_esp_fab_cons_material ON public.esp_fabrication_material_consumptions(material_id);

-- =====================================================
-- HELPER: normalize size in SQL
-- =====================================================
CREATE OR REPLACE FUNCTION public.esp_normalize_size(p_label text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT UPPER(TRIM(REGEXP_REPLACE(COALESCE(p_label,''), '^\s*talla\s+', '', 'i')));
$$;

-- =====================================================
-- FUNCTION: esp_resolve_fabrication_materials
-- Returns a preview JSON of the recipe + materials + stock.
-- Does NOT consume anything.
-- =====================================================
CREATE OR REPLACE FUNCTION public.esp_resolve_fabrication_materials(
  p_request_id uuid,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- default location: warehouse
  v_loc := COALESCE(p_location_id,
    (SELECT id FROM public.esp_locations WHERE type='warehouse' AND is_active=true ORDER BY created_at LIMIT 1));

  -- consumed?
  SELECT COUNT(*) INTO v_already_consumed
    FROM public.esp_fabrication_material_consumptions WHERE fabrication_request_id = p_request_id;

  -- resolve recipe: variant first, then product
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

    IF v_item.size_strategy = 'fixed' THEN
      v_resolved_mat := v_item.material_id;
    ELSIF v_item.size_strategy = 'match_variant_size' THEN
      -- get base material from recipe item to know family (type+name+color)
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
      v_reason := 'manual_select';
    ELSE
      v_resolved_mat := v_item.material_id;
    END IF;

    -- fetch material info + stock
    IF v_resolved_mat IS NOT NULL THEN
      SELECT * INTO v_target_mat FROM public.esp_material_items WHERE id = v_resolved_mat;
      SELECT COALESCE(SUM(quantity_on_hand),0) INTO v_stock
        FROM public.esp_material_stock WHERE material_id = v_resolved_mat AND location_id = v_loc;
    ELSE
      v_stock := 0;
    END IF;

    v_materials := v_materials || jsonb_build_object(
      'recipe_item_id', v_item.id,
      'size_strategy', v_item.size_strategy,
      'required_qty_per_unit', v_item.quantity_per_unit,
      'planned_quantity', v_planned,
      'resolved_material_id', v_resolved_mat,
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
$$;

-- =====================================================
-- FUNCTION: esp_consume_materials_for_fabrication_request
-- =====================================================
CREATE OR REPLACE FUNCTION public.esp_consume_materials_for_fabrication_request(
  p_request_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_base record;
  v_target record;
  v_stock numeric;
  v_planned numeric;
  v_before numeric;
  v_after numeric;
  v_mov_id uuid;
  v_consumed_count int := 0;
  v_total_qty numeric := 0;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT * INTO v_req FROM public.esp_fabrication_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_req.is_legacy THEN RAISE EXCEPTION 'Solicitud legacy: no consumible'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Solicitud no está pendiente (estado: %)', v_req.status; END IF;

  SELECT COUNT(*) INTO v_already FROM public.esp_fabrication_material_consumptions WHERE fabrication_request_id = p_request_id;
  IF v_already > 0 THEN RAISE EXCEPTION 'Esta solicitud ya tiene materiales consumidos'; END IF;

  v_norm := public.esp_normalize_size(v_req.variant_label);

  v_loc := COALESCE(p_location_id,
    (SELECT id FROM public.esp_locations WHERE type='warehouse' AND is_active=true ORDER BY created_at LIMIT 1));
  IF v_loc IS NULL THEN RAISE EXCEPTION 'No hay ubicación de almacén configurada'; END IF;

  -- resolve recipe
  SELECT id INTO v_recipe_id FROM public.esp_product_material_recipes
   WHERE status='active' AND product_id = v_req.product_id AND variant_id = v_req.variant_id
   ORDER BY created_at DESC LIMIT 1;
  IF v_recipe_id IS NULL THEN
    SELECT id INTO v_recipe_id FROM public.esp_product_material_recipes
     WHERE status='active' AND product_id = v_req.product_id AND variant_id IS NULL
     ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_recipe_id IS NULL THEN RAISE EXCEPTION 'No hay receta activa para este producto'; END IF;

  -- iterate items
  FOR v_item IN
    SELECT * FROM public.esp_product_material_recipe_items WHERE recipe_id = v_recipe_id ORDER BY id
  LOOP
    v_planned := v_item.quantity_per_unit * v_req.quantity;
    v_resolved := NULL;

    IF v_item.size_strategy = 'fixed' THEN
      v_resolved := v_item.material_id;
    ELSIF v_item.size_strategy = 'match_variant_size' THEN
      SELECT * INTO v_base FROM public.esp_material_items WHERE id = v_item.material_id;
      IF v_norm = '' THEN RAISE EXCEPTION 'Solicitud sin talla, no se puede resolver match_variant_size'; END IF;
      SELECT * INTO v_target FROM public.esp_material_items
       WHERE status='active'
         AND material_type = v_base.material_type
         AND name = v_base.name
         AND COALESCE(color,'') = COALESCE(v_base.color,'')
         AND UPPER(COALESCE(normalized_size, size, '')) = v_norm
       LIMIT 1;
      IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'Sin blank disponible para talla % en familia %/%', v_norm, v_base.material_type, v_base.name;
      END IF;
      v_resolved := v_target.id;
    ELSE
      v_resolved := v_item.material_id; -- manual_select / other fallback
    END IF;

    -- lock stock row
    SELECT quantity_on_hand INTO v_before FROM public.esp_material_stock
      WHERE material_id = v_resolved AND location_id = v_loc FOR UPDATE;
    IF v_before IS NULL THEN v_before := 0; END IF;
    IF v_before < v_planned THEN
      RAISE EXCEPTION 'Stock insuficiente para material % (disponible %, requerido %)', v_resolved, v_before, v_planned;
    END IF;

    v_after := v_before - v_planned;

    INSERT INTO public.esp_material_stock(material_id, location_id, quantity_on_hand, updated_by)
      VALUES (v_resolved, v_loc, v_after, v_uid)
      ON CONFLICT (material_id, location_id) DO UPDATE
      SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_by = v_uid, updated_at = now();

    INSERT INTO public.esp_material_movements(
      material_id, location_id, movement_type, quantity, quantity_before, quantity_after,
      reason, notes, reference_type, reference_id, created_by
    ) VALUES (
      v_resolved, v_loc, 'fabrication_consumption', v_planned, v_before, v_after,
      'Consumo fabricación ES', p_notes, 'esp_fabrication_request', p_request_id, v_uid
    ) RETURNING id INTO v_mov_id;

    INSERT INTO public.esp_fabrication_material_consumptions(
      fabrication_request_id, recipe_id, recipe_item_id, material_id, material_movement_id,
      location_id, planned_quantity, consumed_quantity, size_strategy, notes, created_by
    ) VALUES (
      p_request_id, v_recipe_id, v_item.id, v_resolved, v_mov_id,
      v_loc, v_planned, v_planned, v_item.size_strategy, p_notes, v_uid
    );

    v_consumed_count := v_consumed_count + 1;
    v_total_qty := v_total_qty + v_planned;
  END LOOP;

  -- advance request
  UPDATE public.esp_fabrication_requests
     SET status = 'in_progress', updated_at = now(), updated_by = v_uid
   WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'recipe_id', v_recipe_id,
    'location_id', v_loc,
    'materials_consumed', v_consumed_count,
    'total_quantity', v_total_qty
  );
END;
$$;

-- =====================================================
-- FUNCTION: esp_fabrication_request_mark_ready
-- =====================================================
CREATE OR REPLACE FUNCTION public.esp_fabrication_request_mark_ready(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_req record;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT * INTO v_req FROM public.esp_fabrication_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_req.is_legacy THEN RAISE EXCEPTION 'Solicitud legacy'; END IF;
  IF v_req.status <> 'in_progress' THEN RAISE EXCEPTION 'Solicitud no está en fabricación (estado: %)', v_req.status; END IF;

  UPDATE public.esp_fabrication_requests
     SET status = 'ready', updated_at = now(), updated_by = v_uid
   WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'request_id', p_request_id, 'status', 'ready');
END;
$$;
