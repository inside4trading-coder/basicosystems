
CREATE POLICY "sublime_merch_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sublime-merch' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "sublime_merch_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sublime-merch' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "sublime_merch_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sublime-merch' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "sublime_merch_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sublime-merch' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));
