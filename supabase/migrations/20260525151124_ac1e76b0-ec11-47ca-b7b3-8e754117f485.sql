
-- 1. Add brand to rrpp_contacts
ALTER TABLE public.rrpp_contacts
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'basico_ve';

ALTER TABLE public.rrpp_contacts
  DROP CONSTRAINT IF EXISTS rrpp_contacts_brand_check;
ALTER TABLE public.rrpp_contacts
  ADD CONSTRAINT rrpp_contacts_brand_check
  CHECK (brand IN ('basico_ve','sublime','basico_es'));

CREATE INDEX IF NOT EXISTS idx_rrpp_contacts_brand ON public.rrpp_contacts(brand);

-- 2. New fields on rrpp_collaborations
ALTER TABLE public.rrpp_collaborations
  ADD COLUMN IF NOT EXISTS order_details text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_city text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_country text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tracking_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_url text DEFAULT '';

-- 3. Brand monthly goals
CREATE TABLE IF NOT EXISTS public.rrpp_brand_goals (
  brand text NOT NULL CHECK (brand IN ('basico_ve','sublime','basico_es')),
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  captaciones int NOT NULL DEFAULT 0,
  activaciones int NOT NULL DEFAULT 0,
  colaboraciones int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand, year, month)
);

ALTER TABLE public.rrpp_brand_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RRPP team manage brand_goals" ON public.rrpp_brand_goals;
CREATE POLICY "RRPP team manage brand_goals"
ON public.rrpp_brand_goals
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rrpp'::app_role) OR has_role(auth.uid(),'marketing'::app_role));

-- 4. Seed default goals for current month if missing
INSERT INTO public.rrpp_brand_goals (brand, year, month, captaciones, activaciones, colaboraciones)
VALUES
  ('basico_ve', EXTRACT(YEAR FROM now())::int, EXTRACT(MONTH FROM now())::int, 10, 8, 7),
  ('sublime',   EXTRACT(YEAR FROM now())::int, EXTRACT(MONTH FROM now())::int,  6, 4, 3),
  ('basico_es', EXTRACT(YEAR FROM now())::int, EXTRACT(MONTH FROM now())::int, 10, 8, 7)
ON CONFLICT (brand, year, month) DO NOTHING;
