GRANT SELECT ON public.fondo_public_aportes TO anon, authenticated;
GRANT SELECT ON public.fondo_public_egresos TO anon, authenticated;
GRANT SELECT ON public.fondo_public_totales TO anon, authenticated;
GRANT SELECT ON public.fondo_configuracion TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fondo_aportes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fondo_egresos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fondo_movimientos_cargados TO authenticated;
GRANT SELECT ON public.fondo_audit_log TO authenticated;
GRANT ALL ON public.fondo_aportes TO service_role;
GRANT ALL ON public.fondo_egresos TO service_role;
GRANT ALL ON public.fondo_movimientos_cargados TO service_role;
GRANT ALL ON public.fondo_configuracion TO service_role;
GRANT ALL ON public.fondo_audit_log TO service_role;

-- Asegura que la configuración pública tenga lectura real para visitantes si RLS está activo.
DROP POLICY IF EXISTS "fondo_configuracion_public_read" ON public.fondo_configuracion;
CREATE POLICY "fondo_configuracion_public_read"
ON public.fondo_configuracion
FOR SELECT
TO anon, authenticated
USING (true);