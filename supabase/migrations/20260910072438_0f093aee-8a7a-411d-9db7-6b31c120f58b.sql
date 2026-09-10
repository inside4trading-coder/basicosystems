ALTER TABLE public.sublime_woo_read_jobs
  ADD COLUMN IF NOT EXISTS cursor_page integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS batch_size integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS error_items jsonb NOT NULL DEFAULT '[]'::jsonb;