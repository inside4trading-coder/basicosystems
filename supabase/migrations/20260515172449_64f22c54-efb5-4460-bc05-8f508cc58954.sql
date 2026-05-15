
ALTER TABLE public.sublime_clock_settings
  ADD COLUMN IF NOT EXISTS pin_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS temp_pin_hash text,
  ADD COLUMN IF NOT EXISTS temp_pin_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_pin_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sublime_clock_pin_hash ON public.sublime_clock_settings (pin_hash) WHERE pin_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sublime_clock_temp_pin_hash ON public.sublime_clock_settings (temp_pin_hash) WHERE temp_pin_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sublime_pin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  action text NOT NULL,
  performed_by text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sublime_pin_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages pin audit" ON public.sublime_pin_audit;
CREATE POLICY "Admin manages pin audit"
  ON public.sublime_pin_audit FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Manager reads pin audit" ON public.sublime_pin_audit;
CREATE POLICY "Manager reads pin audit"
  ON public.sublime_pin_audit FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_sublime_pin_audit_employee ON public.sublime_pin_audit (employee_id, created_at DESC);
