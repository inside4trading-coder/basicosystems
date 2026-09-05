-- Helper central: acceso por módulo según role_routes
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_routes rr ON rr.role::text = ur.role::text
      WHERE ur.user_id = _user_id
        AND EXISTS (
          SELECT 1 FROM unnest(rr.routes) r
          WHERE r = '*' OR r = _module OR _module LIKE r || '/%'
        )
    )
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text) TO authenticated, service_role;

-- CREW: acceso pleno para quien tenga el módulo
CREATE OR REPLACE FUNCTION public.get_crew_employees()
RETURNS TABLE(id uuid, internal_id text, photo_url text, first_name text, last_name text, cedula text, phone text, "position" text, location text, start_date date, birth_date date, current_salary numeric, skills text[], status text, observations text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.internal_id, e.photo_url, e.first_name, e.last_name, e.cedula, e.phone,
         e."position", e.location, e.start_date, e.birth_date, e.current_salary,
         e.skills, e.status, e.observations, e.created_at, e.updated_at
  FROM public.employees e
  WHERE public.has_module_access(auth.uid(), '/crew')
  ORDER BY e.created_at ASC;
$$;

DROP POLICY IF EXISTS "Admin can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Manager can read employees" ON public.employees;
CREATE POLICY "Crew module can manage employees" ON public.employees
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/crew'))
  WITH CHECK (public.has_module_access(auth.uid(), '/crew'));

DROP POLICY IF EXISTS "Admin can manage recurring_tasks" ON public.recurring_tasks;
DROP POLICY IF EXISTS "Manager can read recurring_tasks" ON public.recurring_tasks;
CREATE POLICY "Crew module can manage recurring_tasks" ON public.recurring_tasks
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/crew'))
  WITH CHECK (public.has_module_access(auth.uid(), '/crew'));

DROP POLICY IF EXISTS "Admin can manage employee_documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Manager can read employee_documents" ON public.employee_documents;
CREATE POLICY "Crew module can manage employee_documents" ON public.employee_documents
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/crew'))
  WITH CHECK (public.has_module_access(auth.uid(), '/crew'));

DROP POLICY IF EXISTS "Admin can manage incidents" ON public.incidents;
DROP POLICY IF EXISTS "Admin and manager can read incidents" ON public.incidents;
DROP POLICY IF EXISTS "Admin manager insert incidents" ON public.incidents;
CREATE POLICY "Crew module can manage incidents" ON public.incidents
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/crew'))
  WITH CHECK (public.has_module_access(auth.uid(), '/crew'));

DROP POLICY IF EXISTS "Admin can manage salary_history" ON public.salary_history;
CREATE POLICY "Crew module can manage salary_history" ON public.salary_history
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/crew'))
  WITH CHECK (public.has_module_access(auth.uid(), '/crew'));

DROP POLICY IF EXISTS "Admin can manage crew_config" ON public.crew_config;
CREATE POLICY "Crew module can manage crew_config" ON public.crew_config
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/crew'))
  WITH CHECK (public.has_module_access(auth.uid(), '/crew'));

DROP POLICY IF EXISTS "Admin can manage crew_audit_log" ON public.crew_audit_log;
DROP POLICY IF EXISTS "Admin can insert crew_audit_log" ON public.crew_audit_log;
CREATE POLICY "Crew module can manage crew_audit_log" ON public.crew_audit_log
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), '/crew'))
  WITH CHECK (public.has_module_access(auth.uid(), '/crew'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees, public.recurring_tasks, public.employee_documents, public.incidents, public.salary_history, public.crew_config, public.crew_audit_log TO authenticated;

-- ESPAÑA: sustituir checks de rol por acceso al módulo
DO $do$
DECLARE
  f text;
  def text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.esp_consume_materials_for_fabrication_request',
    'public.esp_consume_production_note',
    'public.esp_fabrication_request_mark_ready'
  ] LOOP
    def := pg_get_functiondef(f::regproc);
    def := regexp_replace(
      def,
      'public\.has_role\(v_uid,\s*''(admin|manager|partner)''::app_role\)(\s*OR\s*public\.has_role\(v_uid,\s*''(admin|manager|partner)''::app_role\))*',
      'public.has_module_access(v_uid, ''/espana'')',
      'g'
    );
    EXECUTE def;
  END LOOP;
END
$do$;