DO $$
DECLARE
  r record;
  mod text;
  expr text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'authenticated' = ANY (roles)
      AND (tablename LIKE 'estudio\_%' OR tablename LIKE 'sublime\_%' OR tablename LIKE 'esp\_%' OR tablename LIKE 'rrpp\_%')
      AND (coalesce(qual,'') LIKE '%has_role%' OR coalesce(with_check,'') LIKE '%has_role%')
      AND coalesce(qual,'') NOT LIKE '%has_module_access%'
      AND coalesce(with_check,'') NOT LIKE '%has_module_access%'
  LOOP
    mod := CASE
      WHEN r.tablename LIKE 'estudio\_%' THEN '/estudio-visual'
      WHEN r.tablename LIKE 'sublime\_%' THEN '/sublime'
      WHEN r.tablename LIKE 'esp\_%' THEN '/espana'
      ELSE '/rrpp'
    END;
    expr := format('has_module_access(auth.uid(), %L)', mod);

    IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', r.policyname, r.tablename, expr, expr);
    ELSIF r.qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, expr);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, expr);
    END IF;
  END LOOP;
END $$;