
CREATE OR REPLACE FUNCTION public.fondo_registrar_aporte_publico(
  p_metodo fondo_metodo,
  p_nombre text,
  p_email text,
  p_telefono text,
  p_fecha_pago date,
  p_monto numeric,
  p_moneda fondo_moneda,
  p_referencia text,
  p_comprobante_path text,
  p_es_anonimo boolean DEFAULT false,
  p_sender_name text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_dup int;
  v_ref_mask text;
  v_nota_interna text;
BEGIN
  IF p_nombre IS NULL OR length(trim(p_nombre)) < 2 OR length(p_nombre) > 120 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    IF p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 200 THEN
      RAISE EXCEPTION 'Correo inválido';
    END IF;
  END IF;
  IF p_telefono IS NOT NULL AND length(trim(p_telefono)) > 0 THEN
    IF length(trim(p_telefono)) < 6 OR length(p_telefono) > 40 THEN
      RAISE EXCEPTION 'Teléfono inválido';
    END IF;
  END IF;
  IF p_fecha_pago IS NULL OR p_fecha_pago > current_date THEN
    RAISE EXCEPTION 'Fecha de pago inválida';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;
  IF p_referencia IS NOT NULL AND length(trim(p_referencia)) > 0 THEN
    IF length(trim(p_referencia)) < 3 OR length(p_referencia) > 120 THEN
      RAISE EXCEPTION 'Referencia inválida';
    END IF;
  END IF;
  IF p_comprobante_path IS NULL OR length(p_comprobante_path) < 5 THEN
    RAISE EXCEPTION 'Comprobante requerido';
  END IF;

  IF p_referencia IS NOT NULL AND length(trim(p_referencia)) > 0 THEN
    SELECT count(*) INTO v_dup FROM public.fondo_aportes
      WHERE metodo = p_metodo
        AND referencia_privada = p_referencia
        AND created_at > now() - interval '24 hours';
    IF v_dup > 0 THEN
      RAISE EXCEPTION 'Ya recibimos un aporte con esta referencia recientemente';
    END IF;
    v_ref_mask := CASE
      WHEN length(p_referencia) <= 4 THEN repeat('*', length(p_referencia))
      ELSE repeat('*', length(p_referencia) - 4) || right(p_referencia, 4)
    END;
  ELSE
    v_ref_mask := NULL;
  END IF;

  v_nota_interna := CASE
    WHEN p_sender_name IS NOT NULL AND length(trim(p_sender_name)) > 0
      THEN 'Enviado por: ' || trim(p_sender_name)
    ELSE NULL
  END;

  INSERT INTO public.fondo_aportes(
    fecha_reportada, nombre_donante, nombre_publico, es_anonimo,
    email_contacto, telefono_contacto,
    metodo, moneda_original, monto_original,
    referencia_privada, referencia_publica_enmascarada,
    comprobante_privado_url, estado, nota_interna
  ) VALUES (
    p_fecha_pago, p_nombre,
    CASE WHEN p_es_anonimo THEN NULL ELSE p_nombre END,
    COALESCE(p_es_anonimo, false),
    NULLIF(trim(COALESCE(p_email,'')),''),
    NULLIF(trim(COALESCE(p_telefono,'')),''),
    p_metodo, p_moneda, p_monto,
    NULLIF(trim(COALESCE(p_referencia,'')),''), v_ref_mask,
    p_comprobante_path, 'por_verificar', v_nota_interna
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$function$;
