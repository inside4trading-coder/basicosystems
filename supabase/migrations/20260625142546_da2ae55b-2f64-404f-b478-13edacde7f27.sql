
CREATE TYPE public.fondo_metodo AS ENUM ('pago_movil','binance','zelle');
CREATE TYPE public.fondo_moneda AS ENUM ('VES','USD','USDT');
CREATE TYPE public.fondo_aporte_estado AS ENUM (
  'por_verificar','coincidencia_encontrada','confirmado','rechazado','duplicado','monto_incorrecto'
);
CREATE TYPE public.fondo_movimiento_estado AS ENUM (
  'sin_conciliar','conciliado','usado_en_confirmacion','duplicado','ignorado'
);
CREATE TYPE public.fondo_egreso_estado AS ENUM ('pendiente','aprobado','ejecutado','anulado');
CREATE TYPE public.fondo_egreso_categoria AS ENUM (
  'comida','agua','medicina','transporte','logistica','refugio','otro'
);

CREATE TABLE public.fondo_aportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  fecha_reportada date,
  fecha_confirmada timestamptz,
  nombre_donante text,
  nombre_publico text,
  es_anonimo boolean NOT NULL DEFAULT false,
  email_contacto text,
  metodo public.fondo_metodo NOT NULL,
  moneda_original public.fondo_moneda NOT NULL,
  monto_original numeric(18,4) NOT NULL CHECK (monto_original > 0),
  tasa_usada numeric(18,6),
  equivalente_usd numeric(18,4),
  referencia_privada text,
  referencia_publica_enmascarada text,
  comprobante_privado_url text,
  estado public.fondo_aporte_estado NOT NULL DEFAULT 'por_verificar',
  nota_publica text,
  nota_interna text,
  verificado_por uuid REFERENCES auth.users(id),
  fecha_verificacion timestamptz,
  created_by uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_fondo_aportes_estado ON public.fondo_aportes(estado);
CREATE INDEX idx_fondo_aportes_metodo ON public.fondo_aportes(metodo);
CREATE INDEX idx_fondo_aportes_fecha_conf ON public.fondo_aportes(fecha_confirmada DESC);
GRANT SELECT, INSERT, UPDATE ON public.fondo_aportes TO authenticated;
GRANT ALL ON public.fondo_aportes TO service_role;
ALTER TABLE public.fondo_aportes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fondo_aportes priv read" ON public.fondo_aportes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "fondo_aportes priv insert" ON public.fondo_aportes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "fondo_aportes priv update" ON public.fondo_aportes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TABLE public.fondo_movimientos_cargados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  fecha date NOT NULL,
  metodo public.fondo_metodo NOT NULL,
  referencia text,
  monto numeric(18,4) NOT NULL,
  moneda public.fondo_moneda NOT NULL,
  origen text,
  nota text,
  estado public.fondo_movimiento_estado NOT NULL DEFAULT 'sin_conciliar',
  raw_data jsonb,
  batch_id uuid,
  created_by uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_fondo_movs_estado ON public.fondo_movimientos_cargados(estado);
GRANT SELECT, INSERT, UPDATE ON public.fondo_movimientos_cargados TO authenticated;
GRANT ALL ON public.fondo_movimientos_cargados TO service_role;
ALTER TABLE public.fondo_movimientos_cargados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fondo_movs priv all" ON public.fondo_movimientos_cargados FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TABLE public.fondo_egresos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  fecha_gasto date,
  categoria public.fondo_egreso_categoria NOT NULL DEFAULT 'otro',
  descripcion text,
  proveedor text,
  moneda_original public.fondo_moneda NOT NULL,
  monto_original numeric(18,4) NOT NULL CHECK (monto_original > 0),
  tasa_usada numeric(18,6),
  equivalente_usd numeric(18,4),
  comprobante_publico_url text,
  comprobante_privado_url text,
  estado public.fondo_egreso_estado NOT NULL DEFAULT 'pendiente',
  nota_publica text,
  nota_interna text,
  created_by uuid REFERENCES auth.users(id),
  aprobado_por uuid REFERENCES auth.users(id),
  fecha_ejecucion timestamptz
);
CREATE INDEX idx_fondo_egresos_estado ON public.fondo_egresos(estado);
GRANT SELECT, INSERT, UPDATE ON public.fondo_egresos TO authenticated;
GRANT ALL ON public.fondo_egresos TO service_role;
ALTER TABLE public.fondo_egresos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fondo_egresos priv all" ON public.fondo_egresos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TABLE public.fondo_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  accion text NOT NULL,
  tabla text NOT NULL,
  record_id uuid,
  valor_anterior jsonb,
  valor_nuevo jsonb
);
CREATE INDEX idx_fondo_audit_created ON public.fondo_audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.fondo_audit_log TO authenticated;
GRANT ALL ON public.fondo_audit_log TO service_role;
ALTER TABLE public.fondo_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fondo_audit priv read" ON public.fondo_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "fondo_audit priv insert" ON public.fondo_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TABLE public.fondo_configuracion (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  titulo_publico text NOT NULL DEFAULT 'fuerza venezuela',
  subtitulo_publico text NOT NULL DEFAULT 'fondo transparente de ayuda por [BASICO]',
  disclaimer text NOT NULL DEFAULT '[BASICO] publica este registro para mostrar de forma transparente los aportes recibidos y los gastos ejecutados. Los aportes se verifican manualmente antes de sumarse al total confirmado. Los datos sensibles serán protegidos. Este fondo no garantiza deducción fiscal.',
  tasa_sugerida numeric(18,6),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.fondo_configuracion(id) VALUES (true);
GRANT SELECT ON public.fondo_configuracion TO anon, authenticated;
GRANT INSERT, UPDATE ON public.fondo_configuracion TO authenticated;
GRANT ALL ON public.fondo_configuracion TO service_role;
ALTER TABLE public.fondo_configuracion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fondo_config read all" ON public.fondo_configuracion FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fondo_config priv update" ON public.fondo_configuracion FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_fondo_aportes_uat BEFORE UPDATE ON public.fondo_aportes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fondo_movs_uat BEFORE UPDATE ON public.fondo_movimientos_cargados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fondo_egresos_uat BEFORE UPDATE ON public.fondo_egresos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fondo_config_uat BEFORE UPDATE ON public.fondo_configuracion
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE VIEW public.fondo_public_aportes
WITH (security_invoker = true) AS
SELECT
  id,
  fecha_reportada,
  fecha_confirmada,
  CASE WHEN es_anonimo THEN 'anónimo' ELSE COALESCE(NULLIF(nombre_publico,''), 'anónimo') END AS donante_publico,
  metodo,
  moneda_original,
  monto_original,
  equivalente_usd,
  referencia_publica_enmascarada,
  estado,
  nota_publica
FROM public.fondo_aportes
WHERE estado IN ('confirmado','por_verificar','coincidencia_encontrada');
GRANT SELECT ON public.fondo_public_aportes TO anon, authenticated;

CREATE OR REPLACE VIEW public.fondo_public_egresos
WITH (security_invoker = true) AS
SELECT
  id, fecha_gasto, fecha_ejecucion, categoria, descripcion, proveedor,
  moneda_original, monto_original, equivalente_usd,
  comprobante_publico_url, estado, nota_publica
FROM public.fondo_egresos
WHERE estado = 'ejecutado';
GRANT SELECT ON public.fondo_public_egresos TO anon, authenticated;

CREATE OR REPLACE VIEW public.fondo_public_totales
WITH (security_invoker = true) AS
SELECT
  COALESCE((SELECT SUM(equivalente_usd) FROM public.fondo_aportes WHERE estado='confirmado'),0)::numeric AS total_confirmado_usd,
  COALESCE((SELECT SUM(COALESCE(equivalente_usd, monto_original)) FROM public.fondo_aportes WHERE estado IN ('por_verificar','coincidencia_encontrada')),0)::numeric AS total_por_verificar_aprox,
  COALESCE((SELECT SUM(equivalente_usd) FROM public.fondo_egresos WHERE estado='ejecutado'),0)::numeric AS total_egresos_usd,
  COALESCE((SELECT SUM(equivalente_usd) FROM public.fondo_aportes WHERE estado='confirmado'),0)::numeric
    - COALESCE((SELECT SUM(equivalente_usd) FROM public.fondo_egresos WHERE estado='ejecutado'),0)::numeric AS saldo_disponible_usd,
  (SELECT COUNT(*) FROM public.fondo_aportes WHERE estado='confirmado')::int AS aportes_confirmados_count,
  (SELECT COUNT(*) FROM public.fondo_aportes WHERE estado IN ('por_verificar','coincidencia_encontrada'))::int AS aportes_pendientes_count,
  GREATEST(
    COALESCE((SELECT MAX(updated_at) FROM public.fondo_aportes),'1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(updated_at) FROM public.fondo_egresos),'1970-01-01'::timestamptz)
  ) AS ultima_actualizacion;
GRANT SELECT ON public.fondo_public_totales TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.fondo_confirmar_aporte(
  p_id uuid, p_tasa numeric DEFAULT NULL,
  p_equivalente_usd numeric DEFAULT NULL, p_nota_publica text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_email text; v_priv boolean;
  v_old jsonb; v_new public.fondo_aportes; v_equiv numeric;
BEGIN
  v_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT to_jsonb(a.*) INTO v_old FROM public.fondo_aportes a WHERE id = p_id FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Aporte no encontrado'; END IF;
  IF (v_old->>'estado') = 'confirmado' THEN RAISE EXCEPTION 'Aporte ya confirmado'; END IF;

  v_equiv := COALESCE(
    p_equivalente_usd,
    CASE
      WHEN (v_old->>'moneda_original') IN ('USD','USDT') THEN (v_old->>'monto_original')::numeric
      WHEN p_tasa IS NOT NULL AND p_tasa > 0 THEN (v_old->>'monto_original')::numeric / p_tasa
      ELSE NULLIF((v_old->>'equivalente_usd'),'')::numeric
    END
  );
  IF v_equiv IS NULL OR v_equiv <= 0 THEN
    RAISE EXCEPTION 'Equivalente USD requerido (especifica tasa o monto USD)';
  END IF;

  UPDATE public.fondo_aportes SET
    estado = 'confirmado',
    tasa_usada = COALESCE(p_tasa, tasa_usada),
    equivalente_usd = v_equiv,
    nota_publica = COALESCE(p_nota_publica, nota_publica),
    fecha_confirmada = now(),
    fecha_verificacion = now(),
    verificado_por = v_uid,
    updated_at = now()
  WHERE id = p_id RETURNING * INTO v_new;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  INSERT INTO public.fondo_audit_log(user_id,user_email,accion,tabla,record_id,valor_anterior,valor_nuevo)
    VALUES (v_uid, v_email, 'confirmar_aporte','fondo_aportes', p_id, v_old, to_jsonb(v_new));
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'equivalente_usd', v_equiv);
END;
$$;

CREATE OR REPLACE FUNCTION public.fondo_cambiar_estado_aporte(
  p_id uuid, p_nuevo_estado public.fondo_aporte_estado, p_nota_interna text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_email text; v_priv boolean;
  v_old jsonb; v_new public.fondo_aportes;
BEGIN
  v_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_nuevo_estado NOT IN ('rechazado','duplicado','monto_incorrecto','por_verificar') THEN
    RAISE EXCEPTION 'Estado no permitido por este RPC';
  END IF;
  SELECT to_jsonb(a.*) INTO v_old FROM public.fondo_aportes a WHERE id = p_id FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Aporte no encontrado'; END IF;

  UPDATE public.fondo_aportes SET
    estado = p_nuevo_estado,
    nota_interna = COALESCE(p_nota_interna, nota_interna),
    fecha_verificacion = now(), verificado_por = v_uid, updated_at = now()
  WHERE id = p_id RETURNING * INTO v_new;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  INSERT INTO public.fondo_audit_log(user_id,user_email,accion,tabla,record_id,valor_anterior,valor_nuevo)
    VALUES (v_uid, v_email, 'cambiar_estado_aporte','fondo_aportes', p_id, v_old, to_jsonb(v_new));
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'estado', p_nuevo_estado);
END;
$$;

UPDATE public.role_routes
  SET routes = (SELECT ARRAY(SELECT DISTINCT unnest(routes || ARRAY['/fondo-transparente'])))
  WHERE role IN ('admin','manager');
