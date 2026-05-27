
-- 1) Modo de escritura Woo en core_settings
ALTER TABLE public.core_settings
  ADD COLUMN IF NOT EXISTS woo_write_mode text NOT NULL DEFAULT 'dry_run'
    CHECK (woo_write_mode IN ('off','dry_run','manual_confirm','enabled'));

-- 2) Logs de escritura
CREATE TABLE IF NOT EXISTS public.core_woo_write_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL CHECK (action_type IN ('stock_increase','stock_decrease','stock_set')),
  mode text NOT NULL CHECK (mode IN ('off','dry_run','manual_confirm','enabled')),
  source_type text,
  source_id uuid,
  inventory_entry_id uuid,
  production_unit_id uuid,
  production_order_id uuid,
  core_product_id uuid,
  core_variant_id uuid,
  woo_product_id bigint,
  woo_variation_id bigint,
  sku text,
  variant_sku text,
  stock_before numeric,
  quantity_delta numeric,
  stock_after_expected numeric,
  stock_after_confirmed numeric,
  request_payload jsonb,
  response_payload jsonb,
  status text NOT NULL DEFAULT 'preview'
    CHECK (status IN ('preview','confirmed','success','failed','skipped','reverted')),
  error_message text,
  idempotency_key text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT ON public.core_woo_write_logs TO authenticated;
GRANT ALL ON public.core_woo_write_logs TO service_role;

ALTER TABLE public.core_woo_write_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager read woo write logs"
ON public.core_woo_write_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Inserts/updates solo vía service_role (edge function). No policies para authenticated.

-- Índices
CREATE INDEX IF NOT EXISTS idx_cwwl_prod_unit       ON public.core_woo_write_logs(production_unit_id);
CREATE INDEX IF NOT EXISTS idx_cwwl_woo_product     ON public.core_woo_write_logs(woo_product_id);
CREATE INDEX IF NOT EXISTS idx_cwwl_woo_variation   ON public.core_woo_write_logs(woo_variation_id);
CREATE INDEX IF NOT EXISTS idx_cwwl_sku             ON public.core_woo_write_logs(sku);
CREATE INDEX IF NOT EXISTS idx_cwwl_status          ON public.core_woo_write_logs(status);
CREATE INDEX IF NOT EXISTS idx_cwwl_created_at      ON public.core_woo_write_logs(created_at DESC);

-- Idempotencia: una unidad no puede tener dos logs activos (confirmed/success) con la misma idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS uq_cwwl_idem_active
  ON public.core_woo_write_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status IN ('confirmed','success');
