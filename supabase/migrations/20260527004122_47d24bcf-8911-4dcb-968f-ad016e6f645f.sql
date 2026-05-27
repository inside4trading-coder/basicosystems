
ALTER TABLE public.core_production_unit_processes
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_operator_id uuid,
  ADD COLUMN IF NOT EXISTS scanned_by_user_id uuid;

CREATE TABLE public.core_production_scan_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_unit_id uuid NOT NULL,
  production_unit_process_id uuid,
  production_order_id uuid,
  production_order_line_id uuid,
  core_product_id uuid,
  core_variant_id uuid,
  unit_code text,
  sku text,
  variant_sku text,
  variant_label text,
  size text,
  process_name text,
  process_type text,
  process_order integer,
  operator_id uuid,
  operator_name_snapshot text,
  scanned_by_user_id uuid,
  event_type text NOT NULL DEFAULT 'process_completed',
  status text NOT NULL DEFAULT 'valid',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX core_pse_unit_idx ON public.core_production_scan_events (production_unit_id);
CREATE INDEX core_pse_process_idx ON public.core_production_scan_events (production_unit_process_id);
CREATE INDEX core_pse_order_idx ON public.core_production_scan_events (production_order_id);
CREATE INDEX core_pse_operator_idx ON public.core_production_scan_events (operator_id);
CREATE INDEX core_pse_event_type_idx ON public.core_production_scan_events (event_type);
CREATE INDEX core_pse_created_idx ON public.core_production_scan_events (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.core_production_scan_events TO authenticated;
GRANT ALL ON public.core_production_scan_events TO service_role;

ALTER TABLE public.core_production_scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_pse_admin_manager_all
  ON public.core_production_scan_events
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));


CREATE TABLE public.core_production_work_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_event_id uuid,
  production_unit_id uuid NOT NULL,
  production_unit_process_id uuid NOT NULL,
  production_order_id uuid,
  core_product_id uuid,
  core_variant_id uuid,
  unit_code text,
  process_name text,
  process_type text,
  operator_id uuid,
  operator_name_snapshot text,
  rate_snapshot numeric,
  currency text DEFAULT 'USD',
  payroll_amount numeric,
  payroll_status text NOT NULL DEFAULT 'pending',
  payroll_week_start date,
  payroll_week_end date,
  scanned_by_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX core_pwe_unit_process_active_uniq
  ON public.core_production_work_entries (production_unit_process_id)
  WHERE payroll_status <> 'cancelled';

CREATE INDEX core_pwe_operator_idx ON public.core_production_work_entries (operator_id);
CREATE INDEX core_pwe_status_idx ON public.core_production_work_entries (payroll_status);
CREATE INDEX core_pwe_order_idx ON public.core_production_work_entries (production_order_id);
CREATE INDEX core_pwe_week_idx ON public.core_production_work_entries (payroll_week_start);

GRANT SELECT, INSERT, UPDATE ON public.core_production_work_entries TO authenticated;
GRANT ALL ON public.core_production_work_entries TO service_role;

ALTER TABLE public.core_production_work_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_pwe_admin_manager_all
  ON public.core_production_work_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_core_pwe_updated_at
  BEFORE UPDATE ON public.core_production_work_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
