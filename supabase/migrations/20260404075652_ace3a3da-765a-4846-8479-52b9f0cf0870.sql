
CREATE TABLE public.crew_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  performed_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.crew_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage crew_audit_log" ON public.crew_audit_log FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert crew_audit_log" ON public.crew_audit_log FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
