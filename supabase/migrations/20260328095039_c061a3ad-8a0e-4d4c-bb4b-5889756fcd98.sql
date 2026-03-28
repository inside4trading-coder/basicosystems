ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS brevo_campaign_id bigint,
  ADD COLUMN IF NOT EXISTS sender_name text DEFAULT 'Basico',
  ADD COLUMN IF NOT EXISTS sender_email text DEFAULT 'hola@basicoclothes.com',
  ADD COLUMN IF NOT EXISTS segment_filter jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stats_json jsonb DEFAULT '{}'::jsonb;