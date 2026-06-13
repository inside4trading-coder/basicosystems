
DROP POLICY IF EXISTS "RRPP team manage contacts" ON public.rrpp_contacts;
CREATE POLICY "RRPP team manage contacts" ON public.rrpp_contacts FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role));

DROP POLICY IF EXISTS "RRPP team manage social_media" ON public.rrpp_social_media;
CREATE POLICY "RRPP team manage social_media" ON public.rrpp_social_media FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role));

DROP POLICY IF EXISTS "RRPP team manage interactions" ON public.rrpp_interactions;
CREATE POLICY "RRPP team manage interactions" ON public.rrpp_interactions FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role));

DROP POLICY IF EXISTS "RRPP team manage collaborations" ON public.rrpp_collaborations;
CREATE POLICY "RRPP team manage collaborations" ON public.rrpp_collaborations FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role));

DROP POLICY IF EXISTS "RRPP team manage brand_goals" ON public.rrpp_brand_goals;
CREATE POLICY "RRPP team manage brand_goals" ON public.rrpp_brand_goals FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role));

DROP POLICY IF EXISTS "RRPP team read config" ON public.rrpp_config;
CREATE POLICY "RRPP team read config" ON public.rrpp_config FOR SELECT
  USING (has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role));

DROP POLICY IF EXISTS "RRPP team read audit_log" ON public.rrpp_audit_log;
CREATE POLICY "RRPP team read audit_log" ON public.rrpp_audit_log FOR SELECT
  USING (has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'partner'::app_role));
