-- =========================================================
-- ESP MATERIALS (Blanks / DTF) - BLOQUE 5A
-- =========================================================

-- 1) Catálogo de materiales
CREATE TABLE IF NOT EXISTS public.esp_material_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type text NOT NULL CHECK (material_type IN ('blank','dtf','packaging','supply','other')),
  sku text UNIQUE,
  name text NOT NULL,
  color text,
  size text,
  normalized_size text,
  unit text NOT NULL DEFAULT 'unit' CHECK (unit IN ('unit','meter','sheet','roll','kg','other')),
  unit_cost_eur numeric(12,4),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  low_stock_threshold numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.esp_material_items TO authenticated;
GRANT ALL ON public.esp_material_items TO service_role;
ALTER TABLE public.esp_material_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mat_items_select_auth" ON public.esp_material_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "mat_items_write_admin_manager" ON public.esp_material_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_esp_mat_items_type_status ON public.esp_material_items(material_type, status);

CREATE TRIGGER esp_mat_items_updated_at BEFORE UPDATE ON public.esp_material_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Stock por sede
CREATE TABLE IF NOT EXISTS public.esp_material_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.esp_material_items(id) ON DELETE RESTRICT,
  location_id uuid REFERENCES public.esp_locations(id) ON DELETE RESTRICT,
  quantity_on_hand numeric(12,2) NOT NULL DEFAULT 0,
  quantity_reserved numeric(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold numeric(12,2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (material_id, location_id)
);
GRANT SELECT, INSERT, UPDATE ON public.esp_material_stock TO authenticated;
GRANT ALL ON public.esp_material_stock TO service_role;
ALTER TABLE public.esp_material_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mat_stock_select_auth" ON public.esp_material_stock
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "mat_stock_write_admin_manager" ON public.esp_material_stock
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER esp_mat_stock_updated_at BEFORE UPDATE ON public.esp_material_stock
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Movimientos (insert-only)
CREATE TABLE IF NOT EXISTS public.esp_material_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.esp_material_items(id) ON DELETE RESTRICT,
  location_id uuid REFERENCES public.esp_locations(id) ON DELETE RESTRICT,
  from_location_id uuid REFERENCES public.esp_locations(id),
  to_location_id uuid REFERENCES public.esp_locations(id),
  movement_type text NOT NULL CHECK (movement_type IN ('initial_stock','manual_in','manual_out','adjustment','correction','return','transfer_in','transfer_out','fabrication_consumption')),
  quantity numeric(12,2) NOT NULL,
  quantity_before numeric(12,2),
  quantity_after numeric(12,2),
  reason text,
  reference_type text,
  reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT ON public.esp_material_movements TO authenticated;
GRANT ALL ON public.esp_material_movements TO service_role;
ALTER TABLE public.esp_material_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mat_mov_select_auth" ON public.esp_material_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "mat_mov_insert_admin_manager" ON public.esp_material_movements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
-- No UPDATE/DELETE policies => insert-only

CREATE INDEX IF NOT EXISTS idx_esp_mat_mov_material_created ON public.esp_material_movements(material_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_esp_mat_mov_location ON public.esp_material_movements(location_id);

-- 4) Recetas
CREATE TABLE IF NOT EXISTS public.esp_product_material_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.esp_products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.esp_product_variants(id) ON DELETE CASCADE,
  name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_product_material_recipes TO authenticated;
GRANT ALL ON public.esp_product_material_recipes TO service_role;
ALTER TABLE public.esp_product_material_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_select_auth" ON public.esp_product_material_recipes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "recipes_write_admin_manager" ON public.esp_product_material_recipes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_esp_recipes_product ON public.esp_product_material_recipes(product_id);

CREATE TRIGGER esp_recipes_updated_at BEFORE UPDATE ON public.esp_product_material_recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.esp_product_material_recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.esp_product_material_recipes(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.esp_material_items(id) ON DELETE RESTRICT,
  quantity_per_unit numeric(12,4) NOT NULL DEFAULT 1,
  size_strategy text NOT NULL DEFAULT 'fixed' CHECK (size_strategy IN ('fixed','match_variant_size','manual_select')),
  required boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_product_material_recipe_items TO authenticated;
GRANT ALL ON public.esp_product_material_recipe_items TO service_role;
ALTER TABLE public.esp_product_material_recipe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_items_select_auth" ON public.esp_product_material_recipe_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "recipe_items_write_admin_manager" ON public.esp_product_material_recipe_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_esp_recipe_items_recipe ON public.esp_product_material_recipe_items(recipe_id);

-- 5) RPC atómica para movimientos de materiales
CREATE OR REPLACE FUNCTION public.esp_apply_material_movement(
  p_movement_type text,
  p_material_id uuid,
  p_quantity numeric,
  p_location_id uuid DEFAULT NULL,
  p_from_location_id uuid DEFAULT NULL,
  p_to_location_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_allow_negative boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_mat record;
  v_before numeric;
  v_after numeric;
  v_delta numeric;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;

  SELECT id, status INTO v_mat FROM public.esp_material_items WHERE id = p_material_id;
  IF v_mat.id IS NULL THEN RAISE EXCEPTION 'Material no encontrado'; END IF;
  IF v_mat.status <> 'active' THEN RAISE EXCEPTION 'Material no activo'; END IF;

  IF p_movement_type IN ('initial_stock','manual_in','return') THEN
    IF p_location_id IS NULL THEN RAISE EXCEPTION 'Ubicación requerida'; END IF;
    INSERT INTO public.esp_material_stock(material_id, location_id, quantity_on_hand, updated_by)
      VALUES (p_material_id, p_location_id, 0, v_uid)
      ON CONFLICT (material_id, location_id) DO NOTHING;
    SELECT quantity_on_hand INTO v_before FROM public.esp_material_stock
      WHERE material_id = p_material_id AND location_id = p_location_id FOR UPDATE;
    v_after := v_before + p_quantity;
    UPDATE public.esp_material_stock SET quantity_on_hand = v_after, updated_by = v_uid, updated_at = now()
      WHERE material_id = p_material_id AND location_id = p_location_id;
    INSERT INTO public.esp_material_movements(material_id, location_id, movement_type, quantity, quantity_before, quantity_after, reason, notes, reference_type, reference_id, created_by)
      VALUES (p_material_id, p_location_id, p_movement_type, p_quantity, v_before, v_after, p_reason, p_notes, p_reference_type, p_reference_id, v_uid);

  ELSIF p_movement_type IN ('manual_out','fabrication_consumption') THEN
    IF p_location_id IS NULL THEN RAISE EXCEPTION 'Ubicación requerida'; END IF;
    IF p_reason IS NULL OR p_reason = '' THEN RAISE EXCEPTION 'Motivo requerido'; END IF;
    SELECT quantity_on_hand INTO v_before FROM public.esp_material_stock
      WHERE material_id = p_material_id AND location_id = p_location_id FOR UPDATE;
    IF v_before IS NULL THEN v_before := 0; END IF;
    IF v_before < p_quantity AND NOT p_allow_negative THEN
      RAISE EXCEPTION 'Stock insuficiente (disponible %, requerido %)', v_before, p_quantity;
    END IF;
    v_after := v_before - p_quantity;
    INSERT INTO public.esp_material_stock(material_id, location_id, quantity_on_hand, updated_by)
      VALUES (p_material_id, p_location_id, v_after, v_uid)
      ON CONFLICT (material_id, location_id) DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_by = v_uid, updated_at = now();
    INSERT INTO public.esp_material_movements(material_id, location_id, movement_type, quantity, quantity_before, quantity_after, reason, notes, reference_type, reference_id, created_by)
      VALUES (p_material_id, p_location_id, p_movement_type, p_quantity, v_before, v_after, p_reason, p_notes, p_reference_type, p_reference_id, v_uid);

  ELSIF p_movement_type IN ('adjustment','correction') THEN
    IF p_location_id IS NULL THEN RAISE EXCEPTION 'Ubicación requerida'; END IF;
    IF p_reason IS NULL OR p_reason = '' THEN RAISE EXCEPTION 'Motivo requerido'; END IF;
    INSERT INTO public.esp_material_stock(material_id, location_id, quantity_on_hand, updated_by)
      VALUES (p_material_id, p_location_id, 0, v_uid)
      ON CONFLICT (material_id, location_id) DO NOTHING;
    SELECT quantity_on_hand INTO v_before FROM public.esp_material_stock
      WHERE material_id = p_material_id AND location_id = p_location_id FOR UPDATE;
    v_after := p_quantity; -- absoluto
    v_delta := v_after - v_before;
    UPDATE public.esp_material_stock SET quantity_on_hand = v_after, updated_by = v_uid, updated_at = now()
      WHERE material_id = p_material_id AND location_id = p_location_id;
    INSERT INTO public.esp_material_movements(material_id, location_id, movement_type, quantity, quantity_before, quantity_after, reason, notes, created_by)
      VALUES (p_material_id, p_location_id, p_movement_type, v_delta, v_before, v_after, p_reason, p_notes, v_uid);

  ELSIF p_movement_type = 'transfer' THEN
    IF p_from_location_id IS NULL OR p_to_location_id IS NULL THEN RAISE EXCEPTION 'Sedes requeridas'; END IF;
    IF p_from_location_id = p_to_location_id THEN RAISE EXCEPTION 'Sedes deben diferir'; END IF;
    -- OUT
    SELECT quantity_on_hand INTO v_before FROM public.esp_material_stock
      WHERE material_id = p_material_id AND location_id = p_from_location_id FOR UPDATE;
    IF v_before IS NULL THEN v_before := 0; END IF;
    IF v_before < p_quantity AND NOT p_allow_negative THEN RAISE EXCEPTION 'Stock insuficiente en origen'; END IF;
    v_after := v_before - p_quantity;
    INSERT INTO public.esp_material_stock(material_id, location_id, quantity_on_hand, updated_by)
      VALUES (p_material_id, p_from_location_id, v_after, v_uid)
      ON CONFLICT (material_id, location_id) DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_by = v_uid, updated_at = now();
    INSERT INTO public.esp_material_movements(material_id, location_id, from_location_id, to_location_id, movement_type, quantity, quantity_before, quantity_after, reason, notes, created_by)
      VALUES (p_material_id, p_from_location_id, p_from_location_id, p_to_location_id, 'transfer_out', p_quantity, v_before, v_after, p_reason, p_notes, v_uid);
    -- IN
    INSERT INTO public.esp_material_stock(material_id, location_id, quantity_on_hand, updated_by)
      VALUES (p_material_id, p_to_location_id, 0, v_uid)
      ON CONFLICT (material_id, location_id) DO NOTHING;
    SELECT quantity_on_hand INTO v_before FROM public.esp_material_stock
      WHERE material_id = p_material_id AND location_id = p_to_location_id FOR UPDATE;
    v_after := v_before + p_quantity;
    UPDATE public.esp_material_stock SET quantity_on_hand = v_after, updated_by = v_uid, updated_at = now()
      WHERE material_id = p_material_id AND location_id = p_to_location_id;
    INSERT INTO public.esp_material_movements(material_id, location_id, from_location_id, to_location_id, movement_type, quantity, quantity_before, quantity_after, reason, notes, created_by)
      VALUES (p_material_id, p_to_location_id, p_from_location_id, p_to_location_id, 'transfer_in', p_quantity, v_before, v_after, p_reason, p_notes, v_uid);
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_movement_type;
  END IF;

  RETURN jsonb_build_object('ok', true, 'before', v_before, 'after', v_after);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.esp_apply_material_movement(text, uuid, numeric, uuid, uuid, uuid, text, text, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.esp_apply_material_movement(text, uuid, numeric, uuid, uuid, uuid, text, text, text, uuid, boolean) TO authenticated;