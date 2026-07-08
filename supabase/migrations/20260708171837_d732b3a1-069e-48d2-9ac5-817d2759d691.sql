
ALTER TABLE public.esp_locations
  ADD COLUMN IF NOT EXISTS public_pos_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_pos_slug text,
  ADD COLUMN IF NOT EXISTS public_pos_token text,
  ADD COLUMN IF NOT EXISTS public_pos_pin text,
  ADD COLUMN IF NOT EXISTS public_pos_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_pos_last_used_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS esp_locations_public_pos_slug_key
  ON public.esp_locations (public_pos_slug) WHERE public_pos_slug IS NOT NULL;
