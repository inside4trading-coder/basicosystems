ALTER TABLE public.esp_fabrication_requests
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legacy_reason text,
  ADD COLUMN IF NOT EXISTS test_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

CREATE INDEX IF NOT EXISTS idx_esp_fab_req_flags ON public.esp_fabrication_requests (is_legacy, is_test, status);