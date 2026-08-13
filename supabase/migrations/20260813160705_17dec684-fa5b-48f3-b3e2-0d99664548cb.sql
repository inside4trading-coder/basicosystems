CREATE OR REPLACE FUNCTION public.core_propagate_raw_material_cost(p_material_id uuid)
RETURNS TABLE(structures_updated integer, items_updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cost numeric;
  v_name text;
  v_items integer := 0;
  v_structs integer := 0;
  r record;
  v_old_total numeric;
  v_by_rm numeric; v_by_lab numeric; v_by_tp numeric; v_by_vc numeric;
  v_by_log numeric; v_by_pack numeric; v_by_oth numeric; v_total numeric;
  v_sale numeric; v_margin numeric; v_margin_pct numeric;
  v_user uuid := auth.uid();
  v_ids uuid[];
BEGIN
  SELECT unit_cost, name INTO v_cost, v_name FROM public.core_raw_materials WHERE id = p_material_id;
  IF v_cost IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT i.cost_structure_id), '{}')
    INTO v_ids
    FROM public.core_cost_structure_items i
    JOIN public.core_cost_structures s ON s.id = i.cost_structure_id
   WHERE i.raw_material_id = p_material_id
     AND s.status = 'active'
     AND COALESCE(i.unit_cost, 0) IS DISTINCT FROM v_cost;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  UPDATE public.core_cost_structure_items i
     SET unit_cost = v_cost,
         subtotal = ROUND(COALESCE(i.quantity, 0) * v_cost, 4),
         updated_at = now()
   WHERE i.raw_material_id = p_material_id
     AND i.cost_structure_id = ANY(v_ids);
  GET DIAGNOSTICS v_items = ROW_COUNT;

  FOR r IN SELECT s.* FROM public.core_cost_structures s WHERE s.id = ANY(v_ids)
  LOOP
    v_old_total := COALESCE(r.total_unit_cost, 0);

    SELECT
      COALESCE(SUM(CASE WHEN section = 'raw_material' THEN subtotal END), 0),
      COALESCE(SUM(CASE WHEN section = 'labor' THEN subtotal END), 0),
      COALESCE(SUM(CASE WHEN section = 'technical_process' THEN subtotal END), 0),
      COALESCE(SUM(CASE WHEN section = 'variable_cost' THEN subtotal END), 0),
      COALESCE(SUM(CASE WHEN section = 'logistics' THEN subtotal END), 0),
      COALESCE(SUM(CASE WHEN section = 'packaging' THEN subtotal END), 0),
      COALESCE(SUM(CASE WHEN section = 'other' THEN subtotal END), 0),
      COALESCE(SUM(subtotal), 0)
    INTO v_by_rm, v_by_lab, v_by_tp, v_by_vc, v_by_log, v_by_pack, v_by_oth, v_total
    FROM public.core_cost_structure_items
    WHERE cost_structure_id = r.id;

    v_sale := r.estimated_sale_price;
    IF v_sale IS NOT NULL AND v_sale > 0 THEN
      v_margin := v_sale - v_total;
      v_margin_pct := (v_margin / v_sale) * 100;
    ELSE
      v_margin := NULL;
      v_margin_pct := NULL;
    END IF;

    UPDATE public.core_cost_structures
       SET total_raw_materials = v_by_rm,
           total_labor = v_by_lab,
           total_technical_processes = v_by_tp,
           total_variable_costs = v_by_vc,
           total_logistics = v_by_log,
           total_packaging = v_by_pack,
           total_other_costs = v_by_oth,
           total_unit_cost = v_total,
           estimated_gross_margin = v_margin,
           estimated_gross_margin_percent = v_margin_pct,
           suggested_fabrication_fund = v_total,
           updated_at = now()
     WHERE id = r.id;

    INSERT INTO public.core_audit_logs (table_name, record_id, action, field_changed, old_value, new_value, performed_by)
    VALUES ('core_cost_structures', r.id::text, 'raw_material_cost_propagated',
            'total_unit_cost', v_old_total::text, v_total::text,
            COALESCE(v_user::text, 'system') || ' · material=' || COALESCE(v_name, p_material_id::text));

    v_structs := v_structs + 1;
  END LOOP;

  RETURN QUERY SELECT v_structs, v_items;
END;
$function$;

CREATE OR REPLACE FUNCTION public.core_raw_material_cost_change_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost THEN
    PERFORM public.core_propagate_raw_material_cost(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_core_raw_material_cost_change ON public.core_raw_materials;
CREATE TRIGGER trg_core_raw_material_cost_change
AFTER UPDATE OF unit_cost ON public.core_raw_materials
FOR EACH ROW
EXECUTE FUNCTION public.core_raw_material_cost_change_trg();

GRANT EXECUTE ON FUNCTION public.core_propagate_raw_material_cost(uuid) TO authenticated;