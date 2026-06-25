
-- Create fondo_exchange_rates table for BCV / external rate history
CREATE TABLE IF NOT EXISTS public.fondo_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'dolarapi_bcv',
  base_currency text NOT NULL DEFAULT 'USD',
  quote_currency text NOT NULL DEFAULT 'VES',
  rate numeric(18,6) NOT NULL CHECK (rate > 0),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  provider_updated_at timestamptz,
  raw_payload jsonb,
  is_active boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fondo_exchange_rates TO anon, authenticated;
GRANT ALL ON public.fondo_exchange_rates TO service_role;

ALTER TABLE public.fondo_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fondo_rates public read" ON public.fondo_exchange_rates
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "fondo_rates priv write" ON public.fondo_exchange_rates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_fondo_rates_active ON public.fondo_exchange_rates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_fondo_rates_source_fetched ON public.fondo_exchange_rates(source, fetched_at DESC);

-- Public RPC to read active BCV rate (used by public page + private)
CREATE OR REPLACE FUNCTION public.fondo_get_active_bcv_rate()
RETURNS TABLE(id uuid, rate numeric, source text, fetched_at timestamptz, provider_updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, rate, source, fetched_at, provider_updated_at
  FROM public.fondo_exchange_rates
  WHERE is_active = true AND source = 'dolarapi_bcv'
  ORDER BY fetched_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.fondo_get_active_bcv_rate() TO anon, authenticated;

-- Track which rate was used to confirm a contribution
ALTER TABLE public.fondo_aportes
  ADD COLUMN IF NOT EXISTS exchange_rate_id uuid REFERENCES public.fondo_exchange_rates(id),
  ADD COLUMN IF NOT EXISTS rate_source text;

-- Update confirm RPC to auto-apply active BCV when VES and no rate passed,
-- and to record exchange_rate_id + rate_source.
CREATE OR REPLACE FUNCTION public.fondo_confirmar_aporte(
  p_id uuid,
  p_tasa numeric DEFAULT NULL,
  p_equivalente_usd numeric DEFAULT NULL,
  p_nota_publica text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_email text; v_priv boolean;
  v_old jsonb; v_new public.fondo_aportes; v_equiv numeric;
  v_rate_id uuid; v_rate numeric; v_source text; v_moneda text; v_monto numeric;
BEGIN
  v_priv := public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'manager'::app_role);
  IF NOT v_priv THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT to_jsonb(a.*) INTO v_old FROM public.fondo_aportes a WHERE id = p_id FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Aporte no encontrado'; END IF;
  IF (v_old->>'estado') = 'confirmado' THEN RAISE EXCEPTION 'Aporte ya confirmado'; END IF;

  v_moneda := v_old->>'moneda_original';
  v_monto  := (v_old->>'monto_original')::numeric;
  v_rate := p_tasa;

  -- Auto-resolve tasa from active BCV for VES contributions when not provided
  IF v_moneda = 'VES' AND (v_rate IS NULL OR v_rate <= 0) THEN
    SELECT id, rate, source INTO v_rate_id, v_rate, v_source
      FROM public.fondo_exchange_rates
     WHERE is_active = true AND source = 'dolarapi_bcv'
     ORDER BY fetched_at DESC LIMIT 1;
  ELSIF v_moneda = 'VES' AND v_rate IS NOT NULL THEN
    -- Manual override: try to attach the active rate id for audit, but keep manual value
    SELECT id, source INTO v_rate_id, v_source
      FROM public.fondo_exchange_rates
     WHERE is_active = true AND source = 'dolarapi_bcv'
     ORDER BY fetched_at DESC LIMIT 1;
    v_source := COALESCE(v_source, 'manual');
  END IF;

  v_equiv := COALESCE(
    p_equivalente_usd,
    CASE
      WHEN v_moneda IN ('USD','USDT') THEN v_monto
      WHEN v_rate IS NOT NULL AND v_rate > 0 THEN v_monto / v_rate
      ELSE NULLIF((v_old->>'equivalente_usd'),'')::numeric
    END
  );
  IF v_equiv IS NULL OR v_equiv <= 0 THEN
    RAISE EXCEPTION 'Equivalente USD requerido (especifica tasa o monto USD)';
  END IF;

  UPDATE public.fondo_aportes SET
    estado = 'confirmado',
    tasa_usada = COALESCE(v_rate, tasa_usada),
    equivalente_usd = v_equiv,
    nota_publica = COALESCE(p_nota_publica, nota_publica),
    exchange_rate_id = COALESCE(v_rate_id, exchange_rate_id),
    rate_source = COALESCE(v_source, rate_source),
    fecha_confirmada = now(),
    fecha_verificacion = now(),
    verificado_por = v_uid,
    updated_at = now()
  WHERE id = p_id RETURNING * INTO v_new;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  INSERT INTO public.fondo_audit_log(user_id,user_email,accion,tabla,record_id,valor_anterior,valor_nuevo)
    VALUES (v_uid, v_email, 'confirmar_aporte','fondo_aportes', p_id, v_old, to_jsonb(v_new));
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'equivalente_usd', v_equiv, 'tasa', v_rate, 'rate_source', v_source);
END;
$$;
