
-- Employee documents
CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  name text NOT NULL,
  doc_type text NOT NULL DEFAULT 'Otro',
  file_url text NOT NULL,
  expiry_date date,
  uploaded_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage employee_documents" ON public.employee_documents FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can read employee_documents" ON public.employee_documents FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

-- Salary history
CREATE TABLE public.salary_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  base_salary numeric NOT NULL DEFAULT 0,
  bonus numeric DEFAULT 0,
  commission numeric DEFAULT 0,
  reason text NOT NULL,
  approved_by text,
  observations text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage salary_history" ON public.salary_history FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Private notes
CREATE TABLE public.private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  note_type text NOT NULL DEFAULT 'Observación',
  content text NOT NULL,
  privacy_level text NOT NULL DEFAULT 'Solo admins',
  author text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.private_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage private_notes" ON public.private_notes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for crew documents
INSERT INTO storage.buckets (id, name, public) VALUES ('crew-documents', 'crew-documents', false);

-- Storage policies
CREATE POLICY "Admin can upload crew docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'crew-documents' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can read crew docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'crew-documents' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can read crew docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'crew-documents' AND has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin can delete crew docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'crew-documents' AND has_role(auth.uid(), 'admin'::app_role));
