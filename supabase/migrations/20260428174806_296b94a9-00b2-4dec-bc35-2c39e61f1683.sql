DROP POLICY IF EXISTS "Manager can read employees" ON public.employees;

CREATE OR REPLACE FUNCTION public.get_crew_employees()
RETURNS TABLE (
  id uuid,
  internal_id text,
  photo_url text,
  first_name text,
  last_name text,
  cedula text,
  phone text,
  "position" text,
  location text,
  start_date date,
  current_salary numeric,
  skills text[],
  status text,
  observations text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.internal_id,
    e.photo_url,
    e.first_name,
    e.last_name,
    e.cedula,
    e.phone,
    e."position",
    e.location,
    e.start_date,
    CASE
      WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN e.current_salary
      ELSE NULL::numeric
    END AS current_salary,
    e.skills,
    e.status,
    e.observations,
    e.created_at,
    e.updated_at
  FROM public.employees e
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'manager'::app_role)
  ORDER BY e.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_crew_employees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_crew_employees() TO authenticated;