ALTER TABLE public.rrpp_collaborations
  ADD COLUMN IF NOT EXISTS no_shipping_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_shipping_method text;