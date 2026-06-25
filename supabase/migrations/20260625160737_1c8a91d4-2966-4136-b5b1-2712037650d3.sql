DROP FUNCTION IF EXISTS public.fondo_public_aportes_list();

CREATE OR REPLACE FUNCTION public.fondo_public_aportes_list()
 RETURNS TABLE(id uuid, fecha_reportada date, fecha_confirmada timestamp with time zone, donante_publico text, telefono_publico text, metodo fondo_metodo, moneda_original fondo_moneda, monto_original numeric, equivalente_usd numeric, referencia_publica_enmascarada text, estado fondo_aporte_estado, nota_publica text, es_anonimo boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    a.id,
    a.fecha_reportada,
    a.fecha_confirmada,
    CASE
      WHEN a.es_anonimo THEN 'anónimo'::text
      ELSE COALESCE(
        NULLIF(
          regexp_replace(
            COALESCE(NULLIF(a.nombre_publico, ''), COALESCE(a.nombre_donante, '')),
            '(\m\S{1,2})(\S+)',
            '\1' || repeat('*', 3),
            'g'
          ),
          ''
        ),
        'anónimo'::text
      )
    END AS donante_publico,
    CASE
      WHEN a.es_anonimo OR a.telefono_contacto IS NULL OR length(a.telefono_contacto) < 4 THEN NULL
      ELSE repeat('*', greatest(length(a.telefono_contacto) - 4, 2)) || right(a.telefono_contacto, 4)
    END AS telefono_publico,
    a.metodo,
    a.moneda_original,
    a.monto_original,
    a.equivalente_usd,
    a.referencia_publica_enmascarada,
    a.estado,
    a.nota_publica,
    COALESCE(a.es_anonimo, false) AS es_anonimo
  FROM public.fondo_aportes a
  WHERE a.estado IN ('confirmado', 'por_verificar', 'coincidencia_encontrada')
  ORDER BY a.fecha_confirmada DESC NULLS LAST, a.fecha_reportada DESC NULLS LAST, a.created_at DESC
  LIMIT 500;
$function$;

GRANT EXECUTE ON FUNCTION public.fondo_public_aportes_list() TO anon, authenticated;