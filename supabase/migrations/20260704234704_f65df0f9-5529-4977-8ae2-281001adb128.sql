
CREATE OR REPLACE FUNCTION public.resolve_core_product_variant_cost_range(p_product_id uuid)
RETURNS TABLE(
  product_id uuid,
  variant_count int,
  variants_with_override int,
  has_overrides boolean,
  min_unit_cost numeric,
  max_unit_cost numeric,
  base_unit_cost numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric;
  v_count int := 0;
  v_overrides int := 0;
  v_min numeric;
  v_max numeric;
  v_variant record;
  v_cost numeric;
BEGIN
  SELECT COALESCE(unit_cost, 0) INTO v_base
    FROM public.core_products WHERE id = p_product_id;

  FOR v_variant IN
    SELECT id, cost_override_enabled
      FROM public.core_product_variants
     WHERE core_product_id = p_product_id
       AND status = 'active'
  LOOP
    v_count := v_count + 1;
    IF v_variant.cost_override_enabled THEN
      v_overrides := v_overrides + 1;
    END IF;
    v_cost := public.resolve_core_variant_unit_cost(p_product_id, v_variant.id);
    IF v_min IS NULL OR v_cost < v_min THEN v_min := v_cost; END IF;
    IF v_max IS NULL OR v_cost > v_max THEN v_max := v_cost; END IF;
  END LOOP;

  IF v_count = 0 THEN
    v_min := v_base;
    v_max := v_base;
  END IF;

  RETURN QUERY SELECT
    p_product_id, v_count, v_overrides,
    v_overrides > 0,
    COALESCE(v_min, v_base),
    COALESCE(v_max, v_base),
    v_base;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_core_product_variant_cost_range(uuid) TO authenticated, service_role;

-- Per-variant resolver that also returns cost_source for UI display
CREATE OR REPLACE FUNCTION public.resolve_core_variant_unit_cost_with_source(p_product_id uuid, p_variant_id uuid)
RETURNS TABLE(unit_cost numeric, cost_source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variant record;
  v_sum numeric;
  v_base_id uuid;
  v_woo_id bigint;
  v_product_cost numeric;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.core_product_variants WHERE id = p_variant_id;
    IF v_variant.id IS NOT NULL
       AND v_variant.cost_override_enabled = true
       AND v_variant.cost_structure_id IS NOT NULL THEN
      SELECT COALESCE(SUM(subtotal), 0) INTO v_sum
        FROM public.core_cost_structure_items
        WHERE cost_structure_id = v_variant.cost_structure_id;
      RETURN QUERY SELECT COALESCE(v_sum, 0), 'variant_override'::text;
      RETURN;
    END IF;
  END IF;

  SELECT woo_product_id, unit_cost INTO v_woo_id, v_product_cost
    FROM public.core_products WHERE id = p_product_id;

  IF v_woo_id IS NOT NULL THEN
    SELECT id INTO v_base_id
      FROM public.core_cost_structures
     WHERE variant_id IS NULL
       AND woo_product_id = v_woo_id
     ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
     LIMIT 1;

    IF v_base_id IS NOT NULL THEN
      SELECT COALESCE(SUM(subtotal), 0) INTO v_sum
        FROM public.core_cost_structure_items
        WHERE cost_structure_id = v_base_id;
      IF v_sum IS NOT NULL AND v_sum > 0 THEN
        RETURN QUERY SELECT v_sum, 'product_base'::text;
        RETURN;
      END IF;
    END IF;
  END IF;

  IF COALESCE(v_product_cost, 0) > 0 THEN
    RETURN QUERY SELECT v_product_cost, 'product_unit_cost'::text;
  ELSE
    RETURN QUERY SELECT 0::numeric, 'zero_fallback'::text;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_core_variant_unit_cost_with_source(uuid, uuid) TO authenticated, service_role;
