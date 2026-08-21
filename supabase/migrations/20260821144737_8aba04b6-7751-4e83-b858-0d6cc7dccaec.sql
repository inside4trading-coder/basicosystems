-- Notas de producción libres (España): no crean producto Woo ni de catálogo.
CREATE TABLE public.esp_production_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  units integer NOT NULL DEFAULT 1,
  location_id uuid REFERENCES public.esp_locations(id),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  consumed_at timestamptz,
  consumed_by uuid,
  total_cost_eur numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT esp_production_notes_units_chk CHECK (units > 0),
  CONSTRAINT esp_production_notes_status_chk CHECK (status IN ('draft','consumed','cancelled'))
);

CREATE TABLE public.esp_production_note_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.esp_production_notes(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.esp_material_items(id),
  location_id uuid NOT NULL REFERENCES public.esp_locations(id),
  quantity_per_unit numeric NOT NULL,
  total_quantity numeric NOT NULL,
  material_name text,
  material_sku text,
  material_size text,
  material_color text,
  material_type text,
  location_name text,
  unit_cost_eur numeric,
  line_cost_eur numeric,
  material_movement_id uuid REFERENCES public.esp_material_movements(id),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT esp_pnm_qty_chk CHECK (quantity_per_unit > 0 AND total_quantity > 0)
);

CREATE INDEX idx_esp_pnm_note ON public.esp_production_note_materials(note_id);
CREATE INDEX idx_esp_pn_created ON public.esp_production_notes(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_production_notes TO authenticated;
GRANT ALL ON public.esp_production_notes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_production_note_materials TO authenticated;
GRANT ALL ON public.esp_production_note_materials TO service_role;

ALTER TABLE public.esp_production_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esp_production_note_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY esp_pn_select_auth ON public.esp_production_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY esp_pn_write_staff ON public.esp_production_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'partner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'partner'::app_role));

CREATE POLICY esp_pnm_select_auth ON public.esp_production_note_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY esp_pnm_write_staff ON public.esp_production_note_materials FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'partner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'partner'::app_role));

CREATE TRIGGER trg_esp_production_notes_updated_at
  BEFORE UPDATE ON public.esp_production_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Consume una nota completa: valida stock de TODAS las líneas antes de descontar,
-- descuenta de forma atómica, registra un movimiento por línea y es idempotente.
CREATE OR REPLACE FUNCTION public.esp_consume_production_note(p_note_id uuid, p_allow_negative boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_note record;
  v_line record;
  v_before numeric;
  v_after numeric;
  v_mov uuid;
  v_shortages jsonb := '[]'::jsonb;
  v_count int := 0;
  v_total numeric := 0;
BEGIN
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role) OR public.has_role(v_uid,'partner'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_note FROM public.esp_production_notes WHERE id = p_note_id FOR UPDATE;
  IF v_note.id IS NULL THEN RAISE EXCEPTION 'Nota no encontrada'; END IF;
  IF v_note.status = 'consumed' THEN
    RETURN jsonb_build_object('ok', true, 'already_consumed', true, 'note_id', p_note_id);
  END IF;
  IF v_note.status = 'cancelled' THEN RAISE EXCEPTION 'Nota cancelada'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.esp_production_note_materials WHERE note_id = p_note_id) THEN
    RAISE EXCEPTION 'La nota no tiene materiales a descontar';
  END IF;

  -- 1) Validación previa de stock: nada se descuenta si falta alguna línea.
  FOR v_line IN
    SELECT m.*, s.quantity_on_hand
    FROM public.esp_production_note_materials m
    LEFT JOIN public.esp_material_stock s
      ON s.material_id = m.material_id AND s.location_id = m.location_id
    WHERE m.note_id = p_note_id AND m.material_movement_id IS NULL
  LOOP
    IF COALESCE(v_line.quantity_on_hand,0) < v_line.total_quantity THEN
      v_shortages := v_shortages || jsonb_build_object(
        'material_id', v_line.material_id,
        'name', v_line.material_name,
        'sku', v_line.material_sku,
        'variant', trim(both ' · ' from concat_ws(' · ', v_line.material_size, v_line.material_color)),
        'location', v_line.location_name,
        'required', v_line.total_quantity,
        'available', COALESCE(v_line.quantity_on_hand,0)
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_shortages) > 0 AND NOT p_allow_negative THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_stock', 'shortages', v_shortages);
  END IF;

  -- 2) Descuento real, un movimiento por línea, con note_id como referencia.
  FOR v_line IN
    SELECT * FROM public.esp_production_note_materials
    WHERE note_id = p_note_id AND material_movement_id IS NULL
    ORDER BY created_at
  LOOP
    INSERT INTO public.esp_material_stock(material_id, location_id, quantity_on_hand, updated_by)
      VALUES (v_line.material_id, v_line.location_id, 0, v_uid)
      ON CONFLICT (material_id, location_id) DO NOTHING;

    SELECT quantity_on_hand INTO v_before FROM public.esp_material_stock
      WHERE material_id = v_line.material_id AND location_id = v_line.location_id FOR UPDATE;
    v_before := COALESCE(v_before, 0);
    v_after := v_before - v_line.total_quantity;

    UPDATE public.esp_material_stock
      SET quantity_on_hand = v_after, updated_by = v_uid, updated_at = now()
      WHERE material_id = v_line.material_id AND location_id = v_line.location_id;

    INSERT INTO public.esp_material_movements(
      material_id, location_id, movement_type, quantity, quantity_before, quantity_after,
      reason, notes, reference_type, reference_id, created_by)
    VALUES (
      v_line.material_id, v_line.location_id, 'fabrication_consumption', v_line.total_quantity,
      v_before, v_after, 'Nota de producción', v_note.title, 'production_note', p_note_id, v_uid)
    RETURNING id INTO v_mov;

    UPDATE public.esp_production_note_materials
      SET material_movement_id = v_mov, consumed_at = now()
      WHERE id = v_line.id;

    v_count := v_count + 1;
    v_total := v_total + COALESCE(v_line.line_cost_eur, 0);
  END LOOP;

  UPDATE public.esp_production_notes
    SET status = 'consumed', consumed_at = now(), consumed_by = v_uid, total_cost_eur = v_total
    WHERE id = p_note_id;

  RETURN jsonb_build_object('ok', true, 'note_id', p_note_id, 'movements', v_count, 'total_cost_eur', v_total);
END;
$function$;