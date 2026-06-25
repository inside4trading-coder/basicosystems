
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'fondo_metodo' AND e.enumlabel = 'efectivo_sublime'
  ) THEN
    ALTER TYPE fondo_metodo ADD VALUE 'efectivo_sublime';
  END IF;
END$$;

ALTER TABLE public.fondo_configuracion
  ADD COLUMN IF NOT EXISTS tasa_ves_usd numeric,
  ADD COLUMN IF NOT EXISTS tasa_fecha date,
  ADD COLUMN IF NOT EXISTS tasa_fuente text,
  ADD COLUMN IF NOT EXISTS tasa_actualizada_at timestamptz,
  ADD COLUMN IF NOT EXISTS tasa_actualizada_por uuid;

DROP VIEW IF EXISTS public.fondo_public_totales CASCADE;

CREATE VIEW public.fondo_public_totales AS
WITH ap AS (
  SELECT moneda_original AS moneda, estado, monto_original, updated_at
  FROM public.fondo_aportes
),
eg AS (
  SELECT moneda_original AS moneda, estado, monto_original, updated_at
  FROM public.fondo_egresos
),
ult AS (
  SELECT GREATEST(
    (SELECT max(updated_at) FROM public.fondo_aportes),
    (SELECT max(updated_at) FROM public.fondo_egresos)
  ) AS ts
),
cfg AS (
  SELECT tasa_ves_usd, tasa_fecha, tasa_fuente, tasa_actualizada_at
  FROM public.fondo_configuracion LIMIT 1
)
SELECT
  COALESCE((SELECT sum(monto_original) FROM ap WHERE moneda='VES' AND estado='confirmado'),0)::numeric AS ves_confirmado,
  COALESCE((SELECT sum(monto_original) FROM ap WHERE moneda='VES' AND estado IN ('por_verificar','coincidencia_encontrada')),0)::numeric AS ves_por_verificar,
  COALESCE((SELECT sum(monto_original) FROM eg WHERE moneda='VES' AND estado='ejecutado'),0)::numeric AS ves_egresos,
  (COALESCE((SELECT sum(monto_original) FROM ap WHERE moneda='VES' AND estado='confirmado'),0)
   - COALESCE((SELECT sum(monto_original) FROM eg WHERE moneda='VES' AND estado='ejecutado'),0))::numeric AS ves_saldo,

  COALESCE((SELECT sum(monto_original) FROM ap WHERE moneda='USD' AND estado='confirmado'),0)::numeric AS usd_confirmado,
  COALESCE((SELECT sum(monto_original) FROM ap WHERE moneda='USD' AND estado IN ('por_verificar','coincidencia_encontrada')),0)::numeric AS usd_por_verificar,
  COALESCE((SELECT sum(monto_original) FROM eg WHERE moneda='USD' AND estado='ejecutado'),0)::numeric AS usd_egresos,
  (COALESCE((SELECT sum(monto_original) FROM ap WHERE moneda='USD' AND estado='confirmado'),0)
   - COALESCE((SELECT sum(monto_original) FROM eg WHERE moneda='USD' AND estado='ejecutado'),0))::numeric AS usd_saldo,

  COALESCE((SELECT sum(monto_original) FROM ap WHERE moneda='USDT' AND estado='confirmado'),0)::numeric AS usdt_confirmado,
  COALESCE((SELECT sum(monto_original) FROM ap WHERE moneda='USDT' AND estado IN ('por_verificar','coincidencia_encontrada')),0)::numeric AS usdt_por_verificar,
  COALESCE((SELECT sum(monto_original) FROM eg WHERE moneda='USDT' AND estado='ejecutado'),0)::numeric AS usdt_egresos,
  (COALESCE((SELECT sum(monto_original) FROM ap WHERE moneda='USDT' AND estado='confirmado'),0)
   - COALESCE((SELECT sum(monto_original) FROM eg WHERE moneda='USDT' AND estado='ejecutado'),0))::numeric AS usdt_saldo,

  (SELECT tasa_ves_usd FROM cfg) AS tasa_ves_usd,
  (SELECT tasa_fecha FROM cfg) AS tasa_fecha,
  (SELECT tasa_fuente FROM cfg) AS tasa_fuente,
  (SELECT tasa_actualizada_at FROM cfg) AS tasa_actualizada_at,

  (SELECT count(*) FROM public.fondo_aportes WHERE estado='confirmado')::int AS aportes_confirmados_count,
  (SELECT count(*) FROM public.fondo_aportes WHERE estado IN ('por_verificar','coincidencia_encontrada'))::int AS aportes_pendientes_count,

  (SELECT ts FROM ult) AS ultima_actualizacion;

GRANT SELECT ON public.fondo_public_totales TO anon, authenticated;
