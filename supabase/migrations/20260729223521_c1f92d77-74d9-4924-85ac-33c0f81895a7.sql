DO $mig$
DECLARE
  src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO src
  FROM pg_proc
  WHERE proname = 'core_apply_replacement_event'
    AND pronamespace = 'public'::regnamespace
  LIMIT 1;

  IF src IS NULL THEN
    RAISE EXCEPTION 'core_apply_replacement_event not found';
  END IF;

  IF position('v_is_bridge' in src) > 0 THEN
    RAISE NOTICE 'already patched';
    RETURN;
  END IF;

  IF position('  v_meta jsonb;' in src) = 0
     OR position('  v_behavior := COALESCE(v_policy.replacement_behavior, v_event.replacement_behavior, NULL);' in src) = 0
     OR position('  v_replacement_product_id := COALESCE(v_policy.replacement_product_id, v_event.replacement_product_id);' in src) = 0 THEN
    RAISE EXCEPTION 'unexpected function body, aborting patch';
  END IF;

  src := replace(src,
    '  v_meta jsonb;',
    '  v_meta jsonb;' || E'\n' || '  v_is_bridge boolean := false;');

  src := replace(src,
    '  v_behavior := COALESCE(v_policy.replacement_behavior, v_event.replacement_behavior, NULL);',
    '  v_is_bridge := v_event.source_type = ''fabrication_fund_movement''' || E'\n' ||
    '    AND COALESCE(v_event.resolution_data->>''bridge_source'','''')' || E'\n' ||
    '        IN (''unlinked_core_reserve'',''unlinked_core_manual_resolution'');' || E'\n\n' ||
    '  IF v_is_bridge THEN' || E'\n' ||
    '    v_behavior := COALESCE(v_event.resolution_data->>''forced_behavior'', v_event.replacement_behavior, ''use_on_restock_with_confirmation'');' || E'\n' ||
    '  ELSE' || E'\n' ||
    '    v_behavior := COALESCE(v_policy.replacement_behavior, v_event.replacement_behavior, NULL);' || E'\n' ||
    '  END IF;');

  src := replace(src,
    '  v_replacement_product_id := COALESCE(v_policy.replacement_product_id, v_event.replacement_product_id);' || E'\n' ||
    '  v_replacement_woo_product_id := COALESCE(v_policy.replacement_woo_product_id, v_event.replacement_woo_product_id);',
    '  IF v_is_bridge THEN' || E'\n' ||
    '    v_replacement_product_id := COALESCE(v_event.replacement_product_id, v_policy.replacement_product_id);' || E'\n' ||
    '    v_replacement_woo_product_id := COALESCE(v_event.replacement_woo_product_id, v_policy.replacement_woo_product_id);' || E'\n' ||
    '  ELSE' || E'\n' ||
    '    v_replacement_product_id := COALESCE(v_policy.replacement_product_id, v_event.replacement_product_id);' || E'\n' ||
    '    v_replacement_woo_product_id := COALESCE(v_policy.replacement_woo_product_id, v_event.replacement_woo_product_id);' || E'\n' ||
    '  END IF;');

  EXECUTE src;
END
$mig$;