ALTER TABLE public.estudio_image_jobs ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_estudio_image_jobs_archived_at ON public.estudio_image_jobs (archived_at);