ALTER TABLE public.admin_instances
  ALTER COLUMN payment_proof_url TYPE text[]
  USING CASE
    WHEN payment_proof_url IS NULL OR payment_proof_url = '' THEN NULL
    ELSE ARRAY[payment_proof_url]
  END;