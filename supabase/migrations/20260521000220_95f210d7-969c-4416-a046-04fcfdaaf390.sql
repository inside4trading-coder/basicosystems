
ALTER TABLE public.sublime_clock_settings
  ADD COLUMN IF NOT EXISTS hybrid_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_hours_target numeric;
