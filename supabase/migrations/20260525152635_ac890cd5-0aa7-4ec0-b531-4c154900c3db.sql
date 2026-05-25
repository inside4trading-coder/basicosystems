
ALTER TABLE public.rrpp_collaborations
  ADD COLUMN IF NOT EXISTS shipping_last_name text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS shipping_id_number text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS shipping_email text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS shipping_postal_code text DEFAULT ''::text;
