
-- employees table
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_id text NOT NULL UNIQUE,
  photo_url text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  cedula text DEFAULT '',
  phone text DEFAULT '',
  position text NOT NULL,
  location text DEFAULT '',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  current_salary numeric,
  skills text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  observations text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage employees" ON public.employees
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- recurring_tasks table
CREATE TABLE public.recurring_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  frequency text NOT NULL DEFAULT 'daily',
  day text DEFAULT '',
  time text DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  area text DEFAULT '',
  responsible text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage recurring_tasks" ON public.recurring_tasks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Sequence function for internal_id
CREATE OR REPLACE FUNCTION public.generate_employee_internal_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(internal_id FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM public.employees;
  NEW.internal_id := 'CR-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employee_internal_id
  BEFORE INSERT ON public.employees
  FOR EACH ROW
  WHEN (NEW.internal_id IS NULL OR NEW.internal_id = '')
  EXECUTE FUNCTION public.generate_employee_internal_id();
