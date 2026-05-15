-- Catálogo de tiendas Sublime
CREATE TABLE public.sublime_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sublime_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read stores"
  ON public.sublime_stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages stores"
  ON public.sublime_stores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER sublime_stores_updated_at
  BEFORE UPDATE ON public.sublime_stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Configuración de fichaje por empleado
CREATE TABLE public.sublime_clock_settings (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  store_id uuid REFERENCES public.sublime_stores(id) ON DELETE SET NULL,
  weekly_schedule jsonb NOT NULL DEFAULT '{"mon":false,"tue":false,"wed":false,"thu":false,"fri":false,"sat":false,"sun":false}'::jsonb,
  entry_time time,
  exit_time time,
  break_start time,
  break_end time,
  break_minutes integer NOT NULL DEFAULT 60,
  late_tolerance_minutes integer NOT NULL DEFAULT 10,
  pin_hash text,
  pin_set_at timestamptz,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sublime_clock_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages clock settings"
  ON public.sublime_clock_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager reads clock settings"
  ON public.sublime_clock_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER sublime_clock_settings_updated_at
  BEFORE UPDATE ON public.sublime_clock_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Eventos de fichaje (append-only)
CREATE TABLE public.sublime_clock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.sublime_stores(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('entrada','salida','inicio_descanso','fin_descanso')),
  event_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'pin' CHECK (source IN ('pin','manual','admin')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sublime_clock_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages clock events"
  ON public.sublime_clock_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager reads clock events"
  ON public.sublime_clock_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX sublime_clock_events_emp_at_idx
  ON public.sublime_clock_events (employee_id, event_at DESC);
CREATE INDEX sublime_clock_events_at_idx
  ON public.sublime_clock_events (event_at DESC);