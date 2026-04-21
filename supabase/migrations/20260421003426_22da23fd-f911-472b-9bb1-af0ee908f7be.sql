ALTER TABLE public.admin_instances ADD COLUMN IF NOT EXISTS payment_proof_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-payments', 'admin-payments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read admin-payments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'admin-payments');

CREATE POLICY "Authenticated upload admin-payments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'admin-payments');

CREATE POLICY "Authenticated update admin-payments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'admin-payments');

CREATE POLICY "Authenticated delete admin-payments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'admin-payments');