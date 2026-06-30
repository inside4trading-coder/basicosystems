
-- Add optional barcode/qr columns on variants (used by importer/exporter)
ALTER TABLE public.core_product_variants
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS qr_code text;

-- Import jobs (header)
CREATE TABLE IF NOT EXISTS public.core_product_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text,
  status text NOT NULL DEFAULT 'preview',
  total_rows int NOT NULL DEFAULT 0,
  products_created int NOT NULL DEFAULT 0,
  products_updated int NOT NULL DEFAULT 0,
  variants_created int NOT NULL DEFAULT 0,
  variants_updated int NOT NULL DEFAULT 0,
  errors_count int NOT NULL DEFAULT 0,
  warnings_count int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  applied_at timestamptz,
  applied_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.core_product_import_jobs TO authenticated;
GRANT ALL ON public.core_product_import_jobs TO service_role;
ALTER TABLE public.core_product_import_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS core_pij_read ON public.core_product_import_jobs;
CREATE POLICY core_pij_read ON public.core_product_import_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
DROP POLICY IF EXISTS core_pij_write ON public.core_product_import_jobs;
CREATE POLICY core_pij_write ON public.core_product_import_jobs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
DROP POLICY IF EXISTS core_pij_update ON public.core_product_import_jobs;
CREATE POLICY core_pij_update ON public.core_product_import_jobs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

-- Import job rows (audit detail)
CREATE TABLE IF NOT EXISTS public.core_product_import_job_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.core_product_import_jobs(id) ON DELETE CASCADE,
  row_number int NOT NULL,
  action text,
  core_sku text,
  product_name text,
  variant_label text,
  result text,
  errors jsonb,
  warnings jsonb,
  raw_payload jsonb,
  created_product_id uuid,
  created_variant_id uuid,
  updated_product_id uuid,
  updated_variant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_core_pijr_job ON public.core_product_import_job_rows(job_id);
GRANT SELECT, INSERT ON public.core_product_import_job_rows TO authenticated;
GRANT ALL ON public.core_product_import_job_rows TO service_role;
ALTER TABLE public.core_product_import_job_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS core_pijr_read ON public.core_product_import_job_rows;
CREATE POLICY core_pijr_read ON public.core_product_import_job_rows FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
DROP POLICY IF EXISTS core_pijr_write ON public.core_product_import_job_rows;
CREATE POLICY core_pijr_write ON public.core_product_import_job_rows FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
