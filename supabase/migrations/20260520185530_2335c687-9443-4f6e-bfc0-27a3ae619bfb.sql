
-- 1. Mirror tables
CREATE TABLE public.sublime_admin_obligations (LIKE public.admin_obligations INCLUDING ALL);
CREATE TABLE public.sublime_admin_instances   (LIKE public.admin_instances   INCLUDING ALL);
CREATE TABLE public.sublime_admin_audit_log   (LIKE public.admin_audit_log   INCLUDING ALL);
CREATE TABLE public.sublime_admin_config      (LIKE public.admin_config      INCLUDING ALL);

-- 2. Foreign keys
ALTER TABLE public.sublime_admin_instances
  ADD CONSTRAINT sublime_admin_instances_obligation_id_fkey
  FOREIGN KEY (obligation_id) REFERENCES public.sublime_admin_obligations(id) ON DELETE CASCADE;

ALTER TABLE public.sublime_admin_audit_log
  ADD CONSTRAINT sublime_admin_audit_log_obligation_id_fkey
  FOREIGN KEY (obligation_id) REFERENCES public.sublime_admin_obligations(id) ON DELETE SET NULL;

ALTER TABLE public.sublime_admin_audit_log
  ADD CONSTRAINT sublime_admin_audit_log_instance_id_fkey
  FOREIGN KEY (instance_id) REFERENCES public.sublime_admin_instances(id) ON DELETE SET NULL;

-- 3. RLS + policies (mirror existing)
ALTER TABLE public.sublime_admin_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sublime_admin_instances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sublime_admin_audit_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sublime_admin_config      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON public.sublime_admin_obligations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON public.sublime_admin_instances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON public.sublime_admin_audit_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON public.sublime_admin_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Triggers
CREATE TRIGGER sublime_admin_obligations_updated_at
  BEFORE UPDATE ON public.sublime_admin_obligations
  FOR EACH ROW EXECUTE FUNCTION public.update_admin_updated_at();

CREATE TRIGGER sublime_admin_instances_updated_at
  BEFORE UPDATE ON public.sublime_admin_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_admin_updated_at();

-- 5. View
CREATE VIEW public.sublime_admin_instances_view AS
SELECT i.id, i.obligation_id, i.period_label, i.due_date, i.amount, i.currency, i.status,
       i.paid_at, i.paid_by, i.payment_reference, i.payment_proof_url, i.notes,
       i.created_at, i.updated_at,
       o.name AS obligation_name, o.category, o.provider, o.frequency,
       o.importance, o.responsible, o.payment_method,
       public.get_urgency(i.due_date) AS urgency
  FROM public.sublime_admin_instances i
  JOIN public.sublime_admin_obligations o ON o.id = i.obligation_id;

-- 6. Seed with current data
INSERT INTO public.sublime_admin_obligations SELECT * FROM public.admin_obligations;
INSERT INTO public.sublime_admin_instances   SELECT * FROM public.admin_instances;
INSERT INTO public.sublime_admin_audit_log   SELECT * FROM public.admin_audit_log;
INSERT INTO public.sublime_admin_config      SELECT * FROM public.admin_config;
