ALTER TABLE public.estudio_image_jobs
  ADD COLUMN IF NOT EXISTS catalog_background_color text,
  ADD COLUMN IF NOT EXISTS background_color_source text;