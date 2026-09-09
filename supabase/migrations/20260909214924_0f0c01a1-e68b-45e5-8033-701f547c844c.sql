CREATE TABLE public.sublime_woo_read_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  total_items integer NOT NULL DEFAULT 0,
  processed_items integer NOT NULL DEFAULT 0,
  mapped_count integer NOT NULL DEFAULT 0,
  possible_match_count integer NOT NULL DEFAULT 0,
  unmapped_count integer NOT NULL DEFAULT 0,
  incomplete_count integer NOT NULL DEFAULT 0,
  ignored_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sublime_woo_read_jobs TO authenticated;
GRANT ALL ON public.sublime_woo_read_jobs TO service_role;

ALTER TABLE public.sublime_woo_read_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sublime woo jobs read" ON public.sublime_woo_read_jobs
FOR SELECT TO authenticated USING (true);

CREATE POLICY "sublime woo jobs write" ON public.sublime_woo_read_jobs
FOR ALL TO authenticated
USING (public.has_module_access(auth.uid(), '/sublime'))
WITH CHECK (public.has_module_access(auth.uid(), '/sublime'));

CREATE UNIQUE INDEX sublime_woo_read_jobs_one_active
  ON public.sublime_woo_read_jobs ((status IN ('queued','fetching_woo','matching')))
  WHERE status IN ('queued','fetching_woo','matching');

CREATE TRIGGER sublime_woo_read_jobs_touch
BEFORE UPDATE ON public.sublime_woo_read_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();