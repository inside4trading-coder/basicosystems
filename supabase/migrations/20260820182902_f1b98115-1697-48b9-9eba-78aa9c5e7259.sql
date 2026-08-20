ALTER TABLE public.core_factory_operators
  ADD COLUMN IF NOT EXISTS portal_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS pin_failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS portal_last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS allowed_processes text[];

ALTER TABLE public.core_production_scan_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin';

ALTER TABLE public.core_production_work_entries
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin';

CREATE TABLE IF NOT EXISTS public.core_operator_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.core_factory_operators(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_operator_portal_sessions_hash ON public.core_operator_portal_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_operator_portal_sessions_operator ON public.core_operator_portal_sessions(operator_id);

GRANT SELECT ON public.core_operator_portal_sessions TO authenticated;
GRANT ALL ON public.core_operator_portal_sessions TO service_role;
ALTER TABLE public.core_operator_portal_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "core_operator_portal_sessions_admin_read" ON public.core_operator_portal_sessions;
CREATE POLICY "core_operator_portal_sessions_admin_read"
  ON public.core_operator_portal_sessions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));