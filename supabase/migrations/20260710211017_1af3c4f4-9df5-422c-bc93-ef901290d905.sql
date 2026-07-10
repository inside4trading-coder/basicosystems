DO $$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.core_apply_replacement_event(uuid,jsonb,numeric,text,boolean)'::regprocedure)
    INTO v_sql;

  v_sql := replace(
    v_sql,
    'p_source_key := p_event_id::text || '':'' || v_alloc->>''canonical_key'',',
    'p_source_key := p_event_id::text || '':'' || (v_alloc->>''canonical_key''),'
  );

  EXECUTE v_sql;
END;
$$;

REVOKE ALL ON FUNCTION public.core_apply_replacement_event(uuid, jsonb, numeric, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.core_apply_replacement_event(uuid, jsonb, numeric, text, boolean) TO authenticated, service_role;