ALTER TABLE public.estudio_image_jobs
  ADD COLUMN IF NOT EXISTS mask_path text,
  ADD COLUMN IF NOT EXISTS cutout_path text,
  ADD COLUMN IF NOT EXISTS background_reference_path text,
  ADD COLUMN IF NOT EXISTS composition_path text,
  ADD COLUMN IF NOT EXISTS composition_mode text NOT NULL DEFAULT 'generative',
  ADD COLUMN IF NOT EXISTS fidelity_pipeline_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.estudio_image_jobs
  DROP CONSTRAINT IF EXISTS chk_estudio_composition_mode;

ALTER TABLE public.estudio_image_jobs
  ADD CONSTRAINT chk_estudio_composition_mode
  CHECK (composition_mode IN ('generative', 'cutout_ready', 'composited'));