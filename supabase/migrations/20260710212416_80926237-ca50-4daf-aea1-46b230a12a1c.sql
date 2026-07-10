DO $$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.core_apply_replacement_event(uuid,jsonb,numeric,text,boolean)'::regprocedure)
    INTO v_definition;

  v_updated := replace(
    v_definition,
    '''restock'', ''pending'', ''media''',
    '''inventory_restock'', ''pending'', ''media'''
  );

  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'core_apply_replacement_event did not contain the expected need_type insert value';
  END IF;

  EXECUTE v_updated;
END $$;

REVOKE ALL ON FUNCTION public.core_apply_replacement_event(uuid, jsonb, numeric, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.core_apply_replacement_event(uuid, jsonb, numeric, text, boolean) TO authenticated, service_role;