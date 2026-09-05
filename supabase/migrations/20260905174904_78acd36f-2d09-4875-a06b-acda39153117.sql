DROP POLICY IF EXISTS "estudio-visual admin manager select" ON storage.objects;
DROP POLICY IF EXISTS "estudio-visual admin manager insert" ON storage.objects;
DROP POLICY IF EXISTS "estudio-visual admin manager update" ON storage.objects;
DROP POLICY IF EXISTS "estudio-visual admin manager delete" ON storage.objects;

CREATE POLICY "estudio-visual module select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'estudio-visual' AND public.has_module_access(auth.uid(), '/estudio-visual'));

CREATE POLICY "estudio-visual module insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'estudio-visual' AND public.has_module_access(auth.uid(), '/estudio-visual'));

CREATE POLICY "estudio-visual module update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'estudio-visual' AND public.has_module_access(auth.uid(), '/estudio-visual'))
WITH CHECK (bucket_id = 'estudio-visual' AND public.has_module_access(auth.uid(), '/estudio-visual'));

CREATE POLICY "estudio-visual module delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'estudio-visual' AND public.has_module_access(auth.uid(), '/estudio-visual'));