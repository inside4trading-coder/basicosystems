CREATE OR REPLACE FUNCTION public.core_repair_unit_variant_links(p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_match uuid;
  v_count int;
  v_sku text;
  v_size text;
  v_repaired int := 0;
  v_ambiguous int := 0;
  v_unresolved int := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  FOR r IN
    SELECT u.id, u.unit_code, u.core_product_id, u.core_variant_id, u.variant_sku, u.variant_label, u.size
    FROM public.core_production_units u
    LEFT JOIN public.core_product_variants v ON v.id = u.core_variant_id
    WHERE u.status NOT IN ('cancelled', 'lost', 'entered_inventory')
      AND u.entered_inventory_at IS NULL
      AND v.id IS NULL
    ORDER BY u.created_at
  LOOP
    v_match := NULL;
    v_count := 0;

    IF r.core_product_id IS NULL THEN
      v_unresolved := v_unresolved + 1;
      v_details := v_details || jsonb_build_object('unit_code', r.unit_code, 'result', 'no_resuelta', 'reason', 'Unidad sin producto Core');
      CONTINUE;
    END IF;

    v_sku := upper(btrim(coalesce(r.variant_sku, '')));
    v_size := upper(btrim(regexp_replace(coalesce(r.size, ''), '^[Tt]alla\s+', '')));

    -- 1) por SKU de variante
    IF v_sku <> '' THEN
      SELECT count(*), min(id) INTO v_count, v_match
      FROM public.core_product_variants
      WHERE core_product_id = r.core_product_id
        AND (upper(btrim(coalesce(variant_sku, ''))) = v_sku OR upper(btrim(coalesce(woo_sku, ''))) = v_sku);
      IF v_count > 1 THEN
        v_ambiguous := v_ambiguous + 1;
        v_details := v_details || jsonb_build_object('unit_code', r.unit_code, 'result', 'ambigua', 'reason', 'Varias variantes con SKU ' || v_sku);
        CONTINUE;
      END IF;
      IF v_count = 0 THEN v_match := NULL; END IF;
    END IF;

    -- 2) por talla (+ color deducido de etiqueta/SKU)
    IF v_match IS NULL AND v_size <> '' THEN
      SELECT count(*), min(id) INTO v_count, v_match
      FROM public.core_product_variants
      WHERE core_product_id = r.core_product_id
        AND upper(btrim(regexp_replace(coalesce(size, ''), '^[Tt]alla\s+', ''))) = v_size;

      IF v_count > 1 THEN
        SELECT count(*), min(id) INTO v_count, v_match
        FROM public.core_product_variants
        WHERE core_product_id = r.core_product_id
          AND upper(btrim(regexp_replace(coalesce(size, ''), '^[Tt]alla\s+', ''))) = v_size
          AND color IS NOT NULL
          AND upper(coalesce(r.variant_label, '') || ' ' || coalesce(r.variant_sku, '')) LIKE '%' || upper(color) || '%';
      END IF;

      IF v_count > 1 THEN
        v_ambiguous := v_ambiguous + 1;
        v_details := v_details || jsonb_build_object('unit_code', r.unit_code, 'result', 'ambigua', 'reason', 'Varias variantes de talla ' || v_size || '; falta color');
        CONTINUE;
      END IF;
      IF v_count = 0 THEN v_match := NULL; END IF;
    END IF;

    IF v_match IS NULL THEN
      v_unresolved := v_unresolved + 1;
      v_details := v_details || jsonb_build_object('unit_code', r.unit_code, 'result', 'no_resuelta', 'reason', 'No se pudo resolver Woo Variation ID');
      CONTINUE;
    END IF;

    v_repaired := v_repaired + 1;
    v_details := v_details || (
      SELECT jsonb_build_object(
        'unit_code', r.unit_code,
        'result', 'reparada',
        'core_variant_id', v.id,
        'variant_sku', v.variant_sku,
        'woo_variation_id', v.woo_variation_id
      )
      FROM public.core_product_variants v WHERE v.id = v_match
    );

    IF NOT p_dry_run THEN
      UPDATE public.core_production_units u
      SET core_variant_id = v.id,
          variant_sku = coalesce(v.variant_sku, v.woo_sku, u.variant_sku),
          variant_label = coalesce(u.variant_label, v.variant_label),
          updated_at = now(),
          updated_by = auth.uid()
      FROM public.core_product_variants v
      WHERE u.id = r.id AND v.id = v_match;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'reparadas', v_repaired,
    'ambiguas', v_ambiguous,
    'no_resueltas', v_unresolved,
    'detalle', v_details
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_repair_unit_variant_links(boolean) TO authenticated;