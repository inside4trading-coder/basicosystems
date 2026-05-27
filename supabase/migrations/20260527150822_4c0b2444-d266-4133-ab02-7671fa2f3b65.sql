
ALTER TABLE public.core_factory_operators ADD COLUMN IF NOT EXISTS birth_date date;

CREATE TABLE IF NOT EXISTS public.core_factory_operator_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.core_factory_operators(id) ON DELETE CASCADE,
  name text NOT NULL,
  doc_type text NOT NULL,
  file_url text NOT NULL,
  expiry_date date,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_factory_operator_documents TO authenticated;
GRANT ALL ON public.core_factory_operator_documents TO service_role;

ALTER TABLE public.core_factory_operator_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage operator documents"
ON public.core_factory_operator_documents
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

INSERT INTO storage.buckets (id, name, public)
VALUES ('core-operator-documents', 'core-operator-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read operator docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'core-operator-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Admins upload operator docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'core-operator-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Admins update operator docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'core-operator-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Admins delete operator docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'core-operator-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));
