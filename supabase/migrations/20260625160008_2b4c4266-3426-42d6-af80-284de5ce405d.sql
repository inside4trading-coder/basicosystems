
-- Add private phone column for donor contact
ALTER TABLE public.fondo_aportes
  ADD COLUMN IF NOT EXISTS telefono_contacto text;

-- Storage policies for fondo-comprobantes bucket
-- Anonymous and authenticated users can upload under aportes/ prefix
CREATE POLICY "fondo-comprobantes anon insert aportes"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'fondo-comprobantes'
  AND (storage.foldername(name))[1] = 'aportes'
);

-- Only admin/manager can read
CREATE POLICY "fondo-comprobantes priv read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'fondo-comprobantes'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "fondo-comprobantes priv delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fondo-comprobantes'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

-- Public RPC: register a new aporte (anyone can submit)
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
  p_es_anonimo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_dup int;
  v_ref_mask text;
BEGIN
  -- Basic validation
  IF p_nombre IS NULL OR length(trim(p_nombre)) < 2 OR length(p_nombre) > 120 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF p_email IS NULL OR p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 200 THEN
    RAISE EXCEPTION 'Correo inválido';
  END IF;
  IF p_telefono IS NULL OR length(trim(p_telefono)) < 6 OR length(p_telefono) > 40 THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;
  IF p_fecha_pago IS NULL OR p_fecha_pago > current_date THEN
    RAISE EXCEPTION 'Fecha de pago inválida';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;
  IF p_referencia IS NULL OR length(trim(p_referencia)) < 3 OR length(p_referencia) > 120 THEN
    RAISE EXCEPTION 'Referencia inválida';
  END IF;
  IF p_comprobante_path IS NULL OR length(p_comprobante_path) < 5 THEN
    RAISE EXCEPTION 'Comprobante requerido';
  END IF;

  -- Soft anti-duplicate: same method + reference in last 24h
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

  INSERT INTO public.fondo_aportes(
    fecha_reportada, nombre_donante, nombre_publico, es_anonimo,
    email_contacto, telefono_contacto,
    metodo, moneda_original, monto_original,
    referencia_privada, referencia_publica_enmascarada,
    comprobante_privado_url, estado
  ) VALUES (
    p_fecha_pago, p_nombre,
    CASE WHEN p_es_anonimo THEN NULL ELSE p_nombre END,
    COALESCE(p_es_anonimo, false),
    p_email, p_telefono,
    p_metodo, p_moneda, p_monto,
    p_referencia, v_ref_mask,
    p_comprobante_path, 'por_verificar'
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fondo_registrar_aporte_publico(
  fondo_metodo, text, text, text, date, numeric, fondo_moneda, text, text, boolean
) TO anon, authenticated;
