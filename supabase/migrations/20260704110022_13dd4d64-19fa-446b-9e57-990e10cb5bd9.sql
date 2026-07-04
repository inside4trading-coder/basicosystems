
CREATE OR REPLACE FUNCTION public.resolve_core_variant_unit_cost(
  p_product_id uuid,
  p_variant_id uuid
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
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
      RETURN COALESCE(v_sum, 0);
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
        RETURN v_sum;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(v_product_cost, 0);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.resolve_core_variant_unit_cost(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_core_variant_unit_cost(uuid, uuid) TO authenticated, service_role;
