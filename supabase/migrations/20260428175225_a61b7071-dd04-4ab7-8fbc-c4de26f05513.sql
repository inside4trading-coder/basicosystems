REVOKE ALL ON FUNCTION public.get_crew_employees() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_crew_employees() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_crew_employees() TO authenticated;