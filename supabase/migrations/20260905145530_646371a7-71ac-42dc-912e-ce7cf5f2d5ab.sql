DO $$
DECLARE r record; expr text := 'has_module_access(auth.uid(), ''/rrpp'')';
BEGIN
  FOR r IN SELECT tablename, policyname, qual, with_check FROM pg_policies
           WHERE schemaname='public' AND tablename LIKE 'rrpp\_%'
             AND (coalesce(qual,'') LIKE '%has_role%' OR coalesce(with_check,'') LIKE '%has_role%')
  LOOP
    IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', r.policyname, r.tablename, expr, expr);
    ELSIF r.qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, expr);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, expr);
    END IF;
  END LOOP;
END $$;