
CREATE OR REPLACE FUNCTION public.resolve_core_operational_unit_cost(
  p_core_product_id uuid DEFAULT NULL,
  p_core_variant_id uuid DEFAULT NULL,
  p_woo_product_id bigint DEFAULT NULL,
  p_woo_variation_id bigint DEFAULT NULL
)
RETURNS TABLE(
  unit_cost numeric,
  cost_source text,
  policy_id uuid,
  core_product_id uuid,
  core_variant_id uuid,
  woo_product_id bigint,
  woo_variation_id bigint,
  warning text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_core_product_id uuid := p_core_product_id;
  v_core_variant_id uuid := p_core_variant_id;
  v_woo_product_id bigint := p_woo_product_id;
  v_woo_variation_id bigint := p_woo_variation_id;
  v_variant record;
  v_product record;
  v_policy record;
  v_sum numeric;
  v_base_id uuid;
  v_warning text := NULL;
  v_route text;
BEGIN
  -- Resolve variant identity
  IF v_core_variant_id IS NULL AND v_woo_variation_id IS NOT NULL THEN
    SELECT core_variant_id INTO v_core_variant_id
      FROM public.core_woo_variant_map
     WHERE woo_variation_id = v_woo_variation_id
       AND core_variant_id IS NOT NULL
     LIMIT 1;
    IF v_core_variant_id IS NULL THEN
      SELECT id INTO v_core_variant_id
        FROM public.core_product_variants
       WHERE woo_variation_id = v_woo_variation_id
       LIMIT 1;
    END IF;
  END IF;

  -- If we have a variant but no product, derive product from variant
  IF v_core_product_id IS NULL AND v_core_variant_id IS NOT NULL THEN
    SELECT core_product_id INTO v_core_product_id
      FROM public.core_product_variants
     WHERE id = v_core_variant_id
     LIMIT 1;
  END IF;

  -- Resolve product identity from woo
  IF v_core_product_id IS NULL AND v_woo_product_id IS NOT NULL THEN
    SELECT core_product_id INTO v_core_product_id
      FROM public.core_woo_product_map
     WHERE woo_product_id = v_woo_product_id
       AND core_product_id IS NOT NULL
     LIMIT 1;
    IF v_core_product_id IS NULL THEN
      SELECT id INTO v_core_product_id
        FROM public.core_products
       WHERE woo_product_id = v_woo_product_id
       LIMIT 1;
    END IF;
  END IF;

  -- Backfill woo ids from resolved core rows for the return payload
  IF v_core_product_id IS NOT NULL AND v_woo_product_id IS NULL THEN
    SELECT woo_product_id INTO v_woo_product_id FROM public.core_products WHERE id = v_core_product_id;
  END IF;
  IF v_core_variant_id IS NOT NULL AND v_woo_variation_id IS NULL THEN
    SELECT woo_variation_id INTO v_woo_variation_id FROM public.core_product_variants WHERE id = v_core_variant_id;
  END IF;

  -- Load variant/product rows if available
  IF v_core_variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.core_product_variants WHERE id = v_core_variant_id;
  END IF;
  IF v_core_product_id IS NOT NULL THEN
    SELECT * INTO v_product FROM public.core_products WHERE id = v_core_product_id;
  END IF;

  -- Load policy (prefer core_product_id, fallback woo_product_id)
  IF v_core_product_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.core_replenishment_policies
      WHERE core_product_id = v_core_product_id
      LIMIT 1;
  END IF;
  IF v_policy.id IS NULL AND v_woo_product_id IS NOT NULL THEN
    SELECT * INTO v_policy FROM public.core_replenishment_policies
      WHERE woo_product_id = v_woo_product_id
      LIMIT 1;
  END IF;

  IF v_policy.id IS NOT NULL THEN
    v_route := v_policy.replenishment_route;
    IF v_route IN ('no_restock','none','ignored') THEN
      v_warning := 'Producto marcado como no_restock/ignored; costo usado solo como referencia.';
    END IF;
  END IF;

  -- 1) variant_override
  IF v_variant.id IS NOT NULL
     AND v_variant.cost_override_enabled = true
     AND v_variant.cost_structure_id IS NOT NULL THEN
    SELECT COALESCE(SUM(subtotal), 0) INTO v_sum
      FROM public.core_cost_structure_items
      WHERE cost_structure_id = v_variant.cost_structure_id;
    IF COALESCE(v_sum, 0) > 0 THEN
      RETURN QUERY SELECT v_sum, 'variant_override'::text, v_policy.id, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id, v_warning;
      RETURN;
    END IF;
  END IF;

  -- 2) product_base
  IF v_woo_product_id IS NOT NULL THEN
    SELECT id INTO v_base_id
      FROM public.core_cost_structures
     WHERE variant_id IS NULL
       AND woo_product_id = v_woo_product_id
     ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
     LIMIT 1;
    IF v_base_id IS NOT NULL THEN
      SELECT COALESCE(SUM(subtotal), 0) INTO v_sum
        FROM public.core_cost_structure_items
        WHERE cost_structure_id = v_base_id;
      IF COALESCE(v_sum, 0) > 0 THEN
        RETURN QUERY SELECT v_sum, 'product_base'::text, v_policy.id, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id, v_warning;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- 3) policy_manual_cost
  IF v_policy.id IS NOT NULL AND COALESCE(v_policy.manual_unit_cost_usd, 0) > 0 THEN
    RETURN QUERY SELECT v_policy.manual_unit_cost_usd::numeric, 'policy_manual_cost'::text, v_policy.id, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id, v_warning;
    RETURN;
  END IF;

  -- 4) external_supplier_cost
  IF v_policy.id IS NOT NULL AND COALESCE(v_policy.external_supplier_unit_cost_usd, 0) > 0 THEN
    RETURN QUERY SELECT
      v_policy.external_supplier_unit_cost_usd::numeric,
      'external_supplier_cost'::text,
      v_policy.id, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id,
      COALESCE(v_warning || ' ', '') || 'Proveedor externo: costo de referencia, no genera OP interna en esta fase.';
    RETURN;
  END IF;

  -- 5) core_product_manual_cost
  IF v_product.id IS NOT NULL AND COALESCE(v_product.manual_unit_cost_usd, 0) > 0 THEN
    RETURN QUERY SELECT v_product.manual_unit_cost_usd::numeric, 'core_product_manual_cost'::text, v_policy.id, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id, v_warning;
    RETURN;
  END IF;

  -- 6) product_unit_cost
  IF v_product.id IS NOT NULL AND COALESCE(v_product.unit_cost, 0) > 0 THEN
    RETURN QUERY SELECT v_product.unit_cost::numeric, 'product_unit_cost'::text, v_policy.id, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id, v_warning;
    RETURN;
  END IF;

  -- 7) zero_fallback
  RETURN QUERY SELECT 0::numeric, 'zero_fallback'::text, v_policy.id, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id,
    COALESCE(v_warning || ' ', '') || 'Sin costo resuelto (fallback 0).';
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_core_operational_unit_cost(uuid, uuid, bigint, bigint) TO authenticated, service_role;
