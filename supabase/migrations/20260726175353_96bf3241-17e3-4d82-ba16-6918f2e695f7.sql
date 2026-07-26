ALTER TABLE public.sublime_merch_items
  ADD COLUMN IF NOT EXISTS size_group text NOT NULL DEFAULT 'franelas_hoodies',
  ADD COLUMN IF NOT EXISTS no_size boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS size_quantities jsonb NOT NULL DEFAULT '{}'::jsonb;