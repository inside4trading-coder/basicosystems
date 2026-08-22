ALTER TABLE public.core_payroll_runs
  ADD COLUMN IF NOT EXISTS generated_by_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generation_source text;

CREATE TABLE IF NOT EXISTS public.core_payroll_auto_close_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  payment_date date,
  status text NOT NULL DEFAULT 'running',
  message text,
  payroll_run_id uuid REFERENCES public.core_payroll_runs(id) ON DELETE SET NULL,
  work_entries_count integer NOT NULL DEFAULT 0,
  operators_count integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  lock_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS core_payroll_auto_close_runs_period_uidx
  ON public.core_payroll_auto_close_runs(period_start);

GRANT SELECT ON public.core_payroll_auto_close_runs TO authenticated;
GRANT ALL ON public.core_payroll_auto_close_runs TO service_role;

ALTER TABLE public.core_payroll_auto_close_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auto close runs readable by staff" ON public.core_payroll_auto_close_runs;
CREATE POLICY "auto close runs readable by staff"
  ON public.core_payroll_auto_close_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'partner'));