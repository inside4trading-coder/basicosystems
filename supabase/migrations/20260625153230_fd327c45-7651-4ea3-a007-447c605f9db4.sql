CREATE OR REPLACE FUNCTION public.fondo_public_aportes_list()
RETURNS TABLE (
  id uuid,
  fecha_reportada date,
  fecha_confirmada timestamptz,
  donante_publico text,
  metodo public.fondo_metodo,
  moneda_original public.fondo_moneda,
  monto_original numeric,
  equivalente_usd numeric,
  referencia_publica_enmascarada text,
  estado public.fondo_aporte_estado,
  nota_publica text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.fecha_reportada,
    a.fecha_confirmada,
    CASE
      WHEN a.es_anonimo THEN 'anónimo'::text
      ELSE COALESCE(NULLIF(a.nombre_publico, ''), 'anónimo'::text)
    END AS donante_publico,
    a.metodo,
    a.moneda_original,
    a.monto_original,
    a.equivalente_usd,
    a.referencia_publica_enmascarada,
    a.estado,
    a.nota_publica
  FROM public.fondo_aportes a
  WHERE a.estado IN ('confirmado', 'por_verificar', 'coincidencia_encontrada')
  ORDER BY a.fecha_confirmada DESC NULLS LAST, a.fecha_reportada DESC NULLS LAST, a.created_at DESC
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION public.fondo_public_egresos_list()
RETURNS TABLE (
  id uuid,
  fecha_gasto date,
  fecha_ejecucion timestamptz,
  categoria public.fondo_egreso_categoria,
  descripcion text,
  proveedor text,
  moneda_original public.fondo_moneda,
  monto_original numeric,
  equivalente_usd numeric,
  comprobante_publico_url text,
  estado public.fondo_egreso_estado,
  nota_publica text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.fecha_gasto,
    e.fecha_ejecucion,
    e.categoria,
    e.descripcion,
    e.proveedor,
    e.moneda_original,
    e.monto_original,
    e.equivalente_usd,
    e.comprobante_publico_url,
    e.estado,
    e.nota_publica
  FROM public.fondo_egresos e
  WHERE e.estado = 'ejecutado'
  ORDER BY e.fecha_ejecucion DESC NULLS LAST, e.fecha_gasto DESC NULLS LAST, e.created_at DESC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.fondo_public_aportes_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fondo_public_egresos_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fondo_public_aportes_list() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fondo_public_egresos_list() TO anon, authenticated;