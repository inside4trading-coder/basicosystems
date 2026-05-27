
-- Sequence per OP+size unit numbering done in code (safe within tx),
-- but we add a unique index on unit_code globally.

CREATE TABLE public.core_production_units (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_code text NOT NULL,
  production_order_id uuid NOT NULL,
  production_order_line_id uuid,
  core_product_id uuid,
  core_variant_id uuid,
  sku text,
  variant_sku text,
  variant_label text,
  size text,
  status text NOT NULL DEFAULT 'created',
  qr_payload text,
  qr_token text,
  qr_generated_at timestamptz,
  qr_generated_by uuid,
  printed_at timestamptz,
  printed_by uuid,
  print_count integer NOT NULL DEFAULT 0,
  cancelled_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE UNIQUE INDEX core_production_units_unit_code_uniq
  ON public.core_production_units (unit_code);
CREATE UNIQUE INDEX core_production_units_qr_token_uniq
  ON public.core_production_units (qr_token) WHERE qr_token IS NOT NULL;
CREATE INDEX core_production_units_order_idx
  ON public.core_production_units (production_order_id);
CREATE INDEX core_production_units_line_idx
  ON public.core_production_units (production_order_line_id);
CREATE INDEX core_production_units_product_idx
  ON public.core_production_units (core_product_id);
CREATE INDEX core_production_units_variant_idx
  ON public.core_production_units (core_variant_id);
CREATE INDEX core_production_units_status_idx
  ON public.core_production_units (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_production_units TO authenticated;
GRANT ALL ON public.core_production_units TO service_role;

ALTER TABLE public.core_production_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_pu_admin_manager_all
  ON public.core_production_units
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_core_production_units_updated_at
  BEFORE UPDATE ON public.core_production_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.core_production_unit_processes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_unit_id uuid NOT NULL,
  production_order_process_id uuid,
  process_name text NOT NULL,
  process_type text,
  process_order integer NOT NULL DEFAULT 0,
  adds_to_payroll boolean NOT NULL DEFAULT false,
  suggested_role text,
  rate_snapshot jsonb,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX core_pup_unit_idx ON public.core_production_unit_processes (production_unit_id);
CREATE INDEX core_pup_status_idx ON public.core_production_unit_processes (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_production_unit_processes TO authenticated;
GRANT ALL ON public.core_production_unit_processes TO service_role;

ALTER TABLE public.core_production_unit_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_pup_admin_manager_all
  ON public.core_production_unit_processes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_core_pup_updated_at
  BEFORE UPDATE ON public.core_production_unit_processes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.core_production_unit_print_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_unit_id uuid,
  production_order_id uuid,
  print_type text NOT NULL,
  printed_at timestamptz NOT NULL DEFAULT now(),
  printed_by uuid,
  notes text
);

CREATE INDEX core_pupl_unit_idx ON public.core_production_unit_print_logs (production_unit_id);
CREATE INDEX core_pupl_order_idx ON public.core_production_unit_print_logs (production_order_id);
CREATE INDEX core_pupl_type_idx ON public.core_production_unit_print_logs (print_type);

GRANT SELECT, INSERT ON public.core_production_unit_print_logs TO authenticated;
GRANT ALL ON public.core_production_unit_print_logs TO service_role;

ALTER TABLE public.core_production_unit_print_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_pupl_admin_manager_read
  ON public.core_production_unit_print_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE POLICY core_pupl_admin_manager_insert
  ON public.core_production_unit_print_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
