
-- Sequence for payroll code
CREATE SEQUENCE IF NOT EXISTS public.core_payroll_run_seq START 1;

-- 1. core_payroll_runs
CREATE TABLE public.core_payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_code text UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  payment_date date,
  status text NOT NULL DEFAULT 'draft',
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  operators_count integer NOT NULL DEFAULT 0,
  work_entries_count integer NOT NULL DEFAULT 0,
  adjustments_total numeric(14,2) NOT NULL DEFAULT 0,
  bcv_rate numeric(14,4),
  total_paid_amount numeric(14,2),
  payment_notes text,
  approved_by uuid,
  approved_at timestamptz,
  paid_by uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT core_payroll_runs_status_chk CHECK (status IN ('draft','review','approved','paid','cancelled')),
  CONSTRAINT core_payroll_runs_period_chk CHECK (period_end >= period_start)
);
CREATE UNIQUE INDEX core_payroll_runs_period_active_uniq
  ON public.core_payroll_runs (period_start, period_end)
  WHERE status <> 'cancelled';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_payroll_runs TO authenticated;
GRANT ALL ON public.core_payroll_runs TO service_role;
ALTER TABLE public.core_payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_payroll_runs_adm_mgr ON public.core_payroll_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_core_payroll_runs_upd
  BEFORE UPDATE ON public.core_payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.assign_payroll_run_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.payroll_code IS NULL OR NEW.payroll_code = '' THEN
    NEW.payroll_code := 'NM-' || LPAD(nextval('public.core_payroll_run_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_core_payroll_runs_code
  BEFORE INSERT ON public.core_payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.assign_payroll_run_code();

-- 2. core_payroll_operator_lines
CREATE TABLE public.core_payroll_operator_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.core_payroll_runs(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL,
  operator_name_snapshot text,
  total_processes integer NOT NULL DEFAULT 0,
  subtotal_amount numeric(14,2) NOT NULL DEFAULT 0,
  adjustments_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending_review',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT core_payroll_opl_status_chk CHECK (status IN ('pending_review','approved','paid','adjusted','cancelled')),
  CONSTRAINT core_payroll_opl_uniq UNIQUE (payroll_run_id, operator_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_payroll_operator_lines TO authenticated;
GRANT ALL ON public.core_payroll_operator_lines TO service_role;
ALTER TABLE public.core_payroll_operator_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_payroll_opl_adm_mgr ON public.core_payroll_operator_lines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_core_payroll_opl_upd
  BEFORE UPDATE ON public.core_payroll_operator_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. core_payroll_work_entry_links
CREATE TABLE public.core_payroll_work_entry_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.core_payroll_runs(id) ON DELETE CASCADE,
  payroll_operator_line_id uuid NOT NULL REFERENCES public.core_payroll_operator_lines(id) ON DELETE CASCADE,
  work_entry_id uuid NOT NULL REFERENCES public.core_production_work_entries(id) ON DELETE RESTRICT,
  operator_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT core_payroll_wel_we_uniq UNIQUE (work_entry_id)
);
CREATE INDEX core_payroll_wel_run_idx ON public.core_payroll_work_entry_links(payroll_run_id);
CREATE INDEX core_payroll_wel_line_idx ON public.core_payroll_work_entry_links(payroll_operator_line_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_payroll_work_entry_links TO authenticated;
GRANT ALL ON public.core_payroll_work_entry_links TO service_role;
ALTER TABLE public.core_payroll_work_entry_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_payroll_wel_adm_mgr ON public.core_payroll_work_entry_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

-- 4. core_payroll_adjustments
CREATE TABLE public.core_payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.core_payroll_runs(id) ON DELETE CASCADE,
  payroll_operator_line_id uuid NOT NULL REFERENCES public.core_payroll_operator_lines(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL,
  adjustment_type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  reason text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT core_payroll_adj_type_chk CHECK (adjustment_type IN ('increase','decrease','correction','bonus','penalty','other'))
);
CREATE INDEX core_payroll_adj_line_idx ON public.core_payroll_adjustments(payroll_operator_line_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_payroll_adjustments TO authenticated;
GRANT ALL ON public.core_payroll_adjustments TO service_role;
ALTER TABLE public.core_payroll_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_payroll_adj_adm_mgr ON public.core_payroll_adjustments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

-- 5. core_payroll_payment_proofs
CREATE TABLE public.core_payroll_payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.core_payroll_runs(id) ON DELETE CASCADE,
  operator_id uuid,
  payroll_operator_line_id uuid REFERENCES public.core_payroll_operator_lines(id) ON DELETE SET NULL,
  file_url text,
  file_name text,
  amount_paid numeric(14,2),
  currency text DEFAULT 'USD',
  bcv_rate numeric(14,4),
  payment_reference text,
  notes text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX core_payroll_pp_run_idx ON public.core_payroll_payment_proofs(payroll_run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_payroll_payment_proofs TO authenticated;
GRANT ALL ON public.core_payroll_payment_proofs TO service_role;
ALTER TABLE public.core_payroll_payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_payroll_pp_adm_mgr ON public.core_payroll_payment_proofs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

-- Storage bucket for proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('core-payroll-proofs', 'core-payroll-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "core_payroll_proofs_read_adm_mgr" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'core-payroll-proofs' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

CREATE POLICY "core_payroll_proofs_write_adm_mgr" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'core-payroll-proofs' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

CREATE POLICY "core_payroll_proofs_update_adm_mgr" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'core-payroll-proofs' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role)));

CREATE POLICY "core_payroll_proofs_delete_adm_mgr" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'core-payroll-proofs' AND public.has_role(auth.uid(),'admin'::app_role));
