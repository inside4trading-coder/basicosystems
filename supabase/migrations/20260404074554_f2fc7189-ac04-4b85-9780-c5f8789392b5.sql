
-- Incidents table
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  employee_name text NOT NULL,
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('positive', 'negative')),
  category text NOT NULL,
  reason text NOT NULL,
  registered_by text,
  observation text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage incidents" ON public.incidents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert incidents" ON public.incidents
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin and manager can read incidents" ON public.incidents
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Crew config table (for passcode hash)
CREATE TABLE public.crew_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.crew_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage crew_config" ON public.crew_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role needs access for edge function
CREATE POLICY "Service can read crew_config" ON public.crew_config
  FOR SELECT TO service_role
  USING (true);
