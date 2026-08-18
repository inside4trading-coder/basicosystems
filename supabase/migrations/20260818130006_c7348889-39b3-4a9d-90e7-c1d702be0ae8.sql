CREATE OR REPLACE FUNCTION public.resolve_core_variant_unit_cost_with_source(p_product_id uuid, p_variant_id uuid DEFAULT NULL)
RETURNS TABLE(unit_cost numeric, cost_source text)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_variant record;
  v_sum numeric;
  v_base_id uuid;
  v_woo_id bigint;
  v_product_cost numeric;
  v_manual numeric;
  v_struct_id uuid;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.core_product_variants v WHERE v.id = p_variant_id;
    IF v_variant.id IS NOT NULL AND v_variant.cost_override_enabled = true THEN
      IF v_variant.cost_structure_id IS NOT NULL THEN
        SELECT COALESCE(SUM(i.subtotal), 0) INTO v_sum
          FROM public.core_cost_structure_items i
          WHERE i.cost_structure_id = v_variant.cost_structure_id;
        IF COALESCE(v_sum, 0) > 0 THEN
          RETURN QUERY SELECT v_sum, 'variant_override'::text;
          RETURN;
        END IF;
      END IF;
      IF COALESCE(v_variant.variant_unit_cost_usd, 0) > 0 THEN
        RETURN QUERY SELECT v_variant.variant_unit_cost_usd, 'variant_manual'::text;
        RETURN;
      END IF;
    END IF;
  END IF;

  SELECT p.woo_product_id, p.unit_cost, p.manual_unit_cost_usd, p.cost_structure_id
    INTO v_woo_id, v_product_cost, v_manual, v_struct_id
    FROM public.core_products p WHERE p.id = p_product_id;

  IF v_struct_id IS NOT NULL THEN
    SELECT COALESCE(SUM(i.subtotal), 0) INTO v_sum
      FROM public.core_cost_structure_items i
      WHERE i.cost_structure_id = v_struct_id;
    IF COALESCE(v_sum, 0) > 0 THEN
      RETURN QUERY SELECT v_sum, 'product_base'::text;
      RETURN;
    END IF;
  END IF;

  IF v_woo_id IS NOT NULL THEN
    SELECT cs.id INTO v_base_id
      FROM public.core_cost_structures cs
     WHERE cs.variant_id IS NULL
       AND cs.woo_product_id = v_woo_id
     ORDER BY CASE WHEN cs.status = 'active' THEN 0 ELSE 1 END, cs.updated_at DESC
     LIMIT 1;

    IF v_base_id IS NOT NULL THEN
      SELECT COALESCE(SUM(i.subtotal), 0) INTO v_sum
        FROM public.core_cost_structure_items i
        WHERE i.cost_structure_id = v_base_id;
      IF COALESCE(v_sum, 0) > 0 THEN
        RETURN QUERY SELECT v_sum, 'product_base'::text;
        RETURN;
      END IF;
    END IF;
  END IF;

  IF COALESCE(v_manual, 0) > 0 THEN
    RETURN QUERY SELECT v_manual, 'product_manual'::text;
    RETURN;
  END IF;

  IF COALESCE(v_product_cost, 0) > 0 THEN
    RETURN QUERY SELECT v_product_cost, 'product_unit_cost'::text;
  ELSE
    RETURN QUERY SELECT 0::numeric, 'zero_fallback'::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_core_variant_unit_cost(p_product_id uuid, p_variant_id uuid DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cost numeric;
BEGIN
  SELECT r.unit_cost INTO v_cost
    FROM public.resolve_core_variant_unit_cost_with_source(p_product_id, p_variant_id) r;
  RETURN COALESCE(v_cost, 0);
END;
$$;