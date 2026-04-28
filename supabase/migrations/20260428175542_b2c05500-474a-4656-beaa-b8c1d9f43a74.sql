CREATE POLICY "Manager can read employees"
ON public.employees
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role));