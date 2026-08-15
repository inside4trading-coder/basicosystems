ALTER TABLE public.estudio_image_jobs
  ADD COLUMN IF NOT EXISTS composition_params jsonb;