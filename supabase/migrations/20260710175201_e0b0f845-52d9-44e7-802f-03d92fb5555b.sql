
CREATE OR REPLACE FUNCTION public.resolve_core_operational_unit_cost(
  p_core_product_id uuid DEFAULT NULL::uuid,
  p_core_variant_id uuid DEFAULT NULL::uuid,
  p_woo_product_id bigint DEFAULT NULL::bigint,
  p_woo_variation_id bigint DEFAULT NULL::bigint
)
RETURNS TABLE(unit_cost numeric, cost_source text, policy_id uuid, core_product_id uuid, core_variant_id uuid, woo_product_id bigint, woo_variation_id bigint, warning text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_core_product_id uuid := p_core_product_id;
  v_core_variant_id uuid := p_core_variant_id;
  v_woo_product_id bigint := p_woo_product_id;
  v_woo_variation_id bigint := p_woo_variation_id;
  v_variant record;
  v_variant_found boolean := false;
  v_product record;
  v_product_found boolean := false;
  v_policy record;
  v_policy_found boolean := false;
  v_sum numeric;
  v_base_id uuid;
  v_warning text := NULL;
  v_route text;
BEGIN
  IF v_core_variant_id IS NULL AND v_woo_variation_id IS NOT NULL THEN
    SELECT wvm.core_variant_id INTO v_core_variant_id
      FROM public.core_woo_variant_map AS wvm
     WHERE wvm.woo_variation_id = v_woo_variation_id
       AND wvm.core_variant_id IS NOT NULL
     LIMIT 1;
    IF v_core_variant_id IS NULL THEN
      SELECT cpv.id INTO v_core_variant_id
        FROM public.core_product_variants AS cpv
       WHERE cpv.woo_variation_id = v_woo_variation_id
       LIMIT 1;
    END IF;
  END IF;

  IF v_core_product_id IS NULL AND v_core_variant_id IS NOT NULL THEN
    SELECT cpv.core_product_id INTO v_core_product_id
      FROM public.core_product_variants AS cpv
     WHERE cpv.id = v_core_variant_id
     LIMIT 1;
  END IF;

  IF v_core_product_id IS NULL AND v_woo_product_id IS NOT NULL THEN
    SELECT wpm.core_product_id INTO v_core_product_id
      FROM public.core_woo_product_map AS wpm
     WHERE wpm.woo_product_id = v_woo_product_id
       AND wpm.core_product_id IS NOT NULL
     LIMIT 1;
    IF v_core_product_id IS NULL THEN
      SELECT cp.id INTO v_core_product_id
        FROM public.core_products AS cp
       WHERE cp.woo_product_id = v_woo_product_id
       LIMIT 1;
    END IF;
  END IF;

  IF v_core_product_id IS NOT NULL AND v_woo_product_id IS NULL THEN
    SELECT cp.woo_product_id INTO v_woo_product_id
      FROM public.core_products AS cp
     WHERE cp.id = v_core_product_id;
  END IF;
  IF v_core_variant_id IS NOT NULL AND v_woo_variation_id IS NULL THEN
    SELECT cpv.woo_variation_id INTO v_woo_variation_id
      FROM public.core_product_variants AS cpv
     WHERE cpv.id = v_core_variant_id;
  END IF;

  IF v_core_variant_id IS NOT NULL THEN
    SELECT cpv.* INTO v_variant
      FROM public.core_product_variants AS cpv
     WHERE cpv.id = v_core_variant_id;
    v_variant_found := FOUND;
  END IF;
  IF v_core_product_id IS NOT NULL THEN
    SELECT cp.* INTO v_product
      FROM public.core_products AS cp
     WHERE cp.id = v_core_product_id;
    v_product_found := FOUND;
  END IF;

  IF v_core_product_id IS NOT NULL OR v_woo_product_id IS NOT NULL THEN
    SELECT crp.* INTO v_policy
      FROM public.core_replenishment_policies AS crp
     WHERE (v_core_product_id IS NOT NULL AND crp.core_product_id = v_core_product_id)
        OR (v_woo_product_id  IS NOT NULL AND crp.woo_product_id  = v_woo_product_id)
     ORDER BY CASE WHEN v_core_product_id IS NOT NULL AND crp.core_product_id = v_core_product_id THEN 0 ELSE 1 END
     LIMIT 1;
    v_policy_found := FOUND;
  END IF;

  IF v_policy_found THEN
    v_route := v_policy.replenishment_route;
    IF v_route IN ('no_restock','none','ignored') THEN
      v_warning := 'Producto marcado como no_restock/ignored; costo usado solo como referencia.';
    END IF;
  END IF;

  -- 1) variant_override
  IF v_variant_found
     AND v_variant.cost_override_enabled = true
     AND v_variant.cost_structure_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ccsi.subtotal), 0) INTO v_sum
      FROM public.core_cost_structure_items AS ccsi
     WHERE ccsi.cost_structure_id = v_variant.cost_structure_id;
    IF COALESCE(v_sum, 0) > 0 THEN
      RETURN QUERY SELECT v_sum, 'variant_override'::text, (CASE WHEN v_policy_found THEN v_policy.id ELSE NULL END), v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id, v_warning;
      RETURN;
    END IF;
  END IF;

  -- 2) product_base
  IF v_woo_product_id IS NOT NULL THEN
    SELECT ccs.id INTO v_base_id
      FROM public.core_cost_structures AS ccs
     WHERE ccs.variant_id IS NULL
       AND ccs.woo_product_id = v_woo_product_id
     ORDER BY CASE WHEN ccs.status = 'active' THEN 0 ELSE 1 END, ccs.updated_at DESC
     LIMIT 1;
    IF v_base_id IS NOT NULL THEN
      SELECT COALESCE(SUM(ccsi.subtotal), 0) INTO v_sum
        FROM public.core_cost_structure_items AS ccsi
       WHERE ccsi.cost_structure_id = v_base_id;
      IF COALESCE(v_sum, 0) > 0 THEN
        RETURN QUERY SELECT v_sum, 'product_base'::text, (CASE WHEN v_policy_found THEN v_policy.id ELSE NULL END), v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id, v_warning;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- 3) policy_manual_cost
  IF v_policy_found AND COALESCE(v_policy.manual_unit_cost_usd, 0) > 0 THEN
    RETURN QUERY SELECT v_policy.manual_unit_cost_usd::numeric, 'policy_manual_cost'::text, v_policy.id, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id, v_warning;
    RETURN;
  END IF;

  -- 4) external_supplier_cost
  IF v_policy_found AND COALESCE(v_policy.external_supplier_unit_cost_usd, 0) > 0 THEN
    RETURN QUERY SELECT
      v_policy.external_supplier_unit_cost_usd::numeric,
      'external_supplier_cost'::text,
      v_policy.id, v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id,
      COALESCE(v_warning || ' ', '') || 'Proveedor externo: costo de referencia, no genera OP interna en esta fase.';
    RETURN;
  END IF;

  -- 5) core_product_manual_cost
  IF v_product_found AND COALESCE(v_product.manual_unit_cost_usd, 0) > 0 THEN
    RETURN QUERY SELECT v_product.manual_unit_cost_usd::numeric, 'core_product_manual_cost'::text, (CASE WHEN v_policy_found THEN v_policy.id ELSE NULL END), v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id, v_warning;
    RETURN;
  END IF;

  -- 6) product_unit_cost
  IF v_product_found AND COALESCE(v_product.unit_cost, 0) > 0 THEN
    RETURN QUERY SELECT v_product.unit_cost::numeric, 'product_unit_cost'::text, (CASE WHEN v_policy_found THEN v_policy.id ELSE NULL END), v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id, v_warning;
    RETURN;
  END IF;

  -- 7) zero_fallback
  RETURN QUERY SELECT 0::numeric, 'zero_fallback'::text, (CASE WHEN v_policy_found THEN v_policy.id ELSE NULL END), v_core_product_id, v_core_variant_id, v_woo_product_id, v_woo_variation_id,
    COALESCE(v_warning || ' ', '') || 'Sin costo resuelto (fallback 0).';
END;
$function$;
