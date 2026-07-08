
-- Reconciliation RPC: detect existing connections between Woo products and Core
-- Sources: core_products.woo_product_id, core_cost_structures.woo_product_id (+ optional variant_id -> core_product_variants.core_product_id)
-- Never overwrites already-set core_product_id in core_woo_product_map; never deletes.

CREATE OR REPLACE FUNCTION public.core_reconcile_woo_core_map()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_priv boolean;
  v_map record;
  v_core_id uuid;
  v_ccs record;
  v_ccs_count int;
  v_variant_core uuid;
  v_reviewed int := 0;
  v_linked_via_core int := 0;
  v_linked_via_structure int := 0;
  v_needs_review int := 0;
  v_no_link int := 0;
  v_conflicts int := 0;
  v_new_status text;
  v_new_core uuid;
BEGIN
  v_is_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_is_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;

  FOR v_map IN SELECT * FROM public.core_woo_product_map LOOP
    v_reviewed := v_reviewed + 1;
    v_new_core := v_map.core_product_id;
    v_new_status := v_map.mapping_status;

    -- Skip overwriting if user already set ignored (manual)
    IF v_map.mapping_status = 'ignored' THEN
      CONTINUE;
    END IF;

    -- A) direct link via core_products.woo_product_id
    SELECT id INTO v_core_id FROM public.core_products WHERE woo_product_id = v_map.woo_product_id LIMIT 1;

    IF v_core_id IS NOT NULL THEN
      IF v_new_core IS NULL THEN
        v_new_core := v_core_id;
        v_linked_via_core := v_linked_via_core + 1;
      ELSIF v_new_core <> v_core_id THEN
        v_new_status := 'needs_review';
        v_conflicts := v_conflicts + 1;
      END IF;
      IF v_new_status <> 'needs_review' THEN v_new_status := 'mapped'; END IF;
    ELSE
      -- B) via cost structures on this woo_product_id
      SELECT count(*) INTO v_ccs_count FROM public.core_cost_structures WHERE woo_product_id = v_map.woo_product_id;

      IF v_ccs_count > 0 THEN
        -- Try to resolve a core_product_id via structure -> variant -> core_product
        v_variant_core := NULL;
        SELECT cpv.core_product_id INTO v_variant_core
          FROM public.core_cost_structures ccs
          JOIN public.core_product_variants cpv ON cpv.id = ccs.variant_id
         WHERE ccs.woo_product_id = v_map.woo_product_id
           AND ccs.variant_id IS NOT NULL
         GROUP BY cpv.core_product_id
         LIMIT 2;

        IF v_variant_core IS NOT NULL AND v_new_core IS NULL THEN
          v_new_core := v_variant_core;
          v_new_status := 'mapped';
          v_linked_via_structure := v_linked_via_structure + 1;
        ELSIF v_new_core IS NULL THEN
          -- structure exists but no core link derivable → needs_review
          v_new_status := 'needs_review';
          v_needs_review := v_needs_review + 1;
        ELSE
          v_new_status := 'mapped';
        END IF;
      ELSE
        IF v_new_core IS NULL THEN
          v_new_status := 'unmapped';
          v_no_link := v_no_link + 1;
        END IF;
      END IF;
    END IF;

    IF v_new_core IS DISTINCT FROM v_map.core_product_id
       OR v_new_status IS DISTINCT FROM v_map.mapping_status THEN
      UPDATE public.core_woo_product_map
         SET core_product_id = v_new_core,
             mapping_status = v_new_status,
             updated_at = now()
       WHERE id = v_map.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'reviewed', v_reviewed,
    'linked_via_core_products', v_linked_via_core,
    'linked_via_structures', v_linked_via_structure,
    'needs_review', v_needs_review,
    'no_link', v_no_link,
    'conflicts', v_conflicts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_reconcile_woo_core_map() TO authenticated;
