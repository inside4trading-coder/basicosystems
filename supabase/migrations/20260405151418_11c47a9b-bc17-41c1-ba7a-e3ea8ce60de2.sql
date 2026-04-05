
CREATE OR REPLACE FUNCTION public.generate_employee_internal_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
