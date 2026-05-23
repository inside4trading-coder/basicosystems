
-- Lock down admin and sublime_admin tables to admin/manager roles only
DROP POLICY IF EXISTS authenticated_all ON public.admin_config;
DROP POLICY IF EXISTS authenticated_all ON public.admin_instances;
DROP POLICY IF EXISTS authenticated_all ON public.admin_audit_log;
DROP POLICY IF EXISTS authenticated_all ON public.admin_obligations;

CREATE POLICY admin_manager_all ON public.admin_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY admin_manager_all ON public.admin_instances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY admin_manager_all ON public.admin_obligations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
-- audit_log: admin/manager read; inserts via system code (still allowed for admin/manager)
CREATE POLICY admin_manager_read ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY admin_manager_insert ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

DROP POLICY IF EXISTS authenticated_all ON public.sublime_admin_config;
DROP POLICY IF EXISTS authenticated_all ON public.sublime_admin_instances;
DROP POLICY IF EXISTS authenticated_all ON public.sublime_admin_audit_log;
DROP POLICY IF EXISTS authenticated_all ON public.sublime_admin_obligations;

CREATE POLICY admin_manager_all ON public.sublime_admin_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY admin_manager_all ON public.sublime_admin_instances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY admin_manager_all ON public.sublime_admin_obligations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY admin_manager_read ON public.sublime_admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY admin_manager_insert ON public.sublime_admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Restrict admin-payments storage bucket to admin/manager
DROP POLICY IF EXISTS "Authenticated read admin-payments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload admin-payments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update admin-payments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete admin-payments" ON storage.objects;

CREATE POLICY "Admin manager read admin-payments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'admin-payments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY "Admin manager upload admin-payments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-payments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY "Admin manager update admin-payments" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'admin-payments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (bucket_id = 'admin-payments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY "Admin manager delete admin-payments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'admin-payments' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));

-- Restrict incidents inserts: only admin/manager
DROP POLICY IF EXISTS "Authenticated can insert incidents" ON public.incidents;
CREATE POLICY "Admin manager insert incidents" ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Ensure views run as the querying user (avoid SECURITY DEFINER view warnings)
ALTER VIEW public.admin_instances_view SET (security_invoker = true);
ALTER VIEW public.sublime_admin_instances_view SET (security_invoker = true);

-- Fix function search_path
ALTER FUNCTION public.get_urgency(date) SET search_path = public;

-- Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.generate_employee_internal_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_customers_order_stats() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_sublime_daily_shift(uuid, date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_shift_on_event() FROM anon, authenticated;
