
-- Templates
CREATE TABLE public.core_import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'both',
  status TEXT NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
CREATE UNIQUE INDEX core_import_templates_active_name_uq
  ON public.core_import_templates (LOWER(name)) WHERE status = 'active';

ALTER TABLE public.core_import_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_tpl_all ON public.core_import_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER core_import_templates_set_updated_at
  BEFORE UPDATE ON public.core_import_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fields
CREATE TABLE public.core_import_template_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.core_import_templates(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  internal_field TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'text',
  is_required BOOLEAN NOT NULL DEFAULT false,
  default_value TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX core_tpl_fields_template_idx ON public.core_import_template_fields(template_id);

ALTER TABLE public.core_import_template_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_tpl_fields_all ON public.core_import_template_fields FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER core_import_template_fields_set_updated_at
  BEFORE UPDATE ON public.core_import_template_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Batches
CREATE TABLE public.core_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.core_import_templates(id) ON DELETE SET NULL,
  data_type TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'preview',
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_rows INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
CREATE INDEX core_import_batches_template_idx ON public.core_import_batches(template_id);

ALTER TABLE public.core_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_batches_all ON public.core_import_batches FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

-- Batch rows
CREATE TABLE public.core_import_batch_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.core_import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  parsed_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  action TEXT,
  target_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX core_import_batch_rows_batch_idx ON public.core_import_batch_rows(batch_id);

ALTER TABLE public.core_import_batch_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_batch_rows_all ON public.core_import_batch_rows FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('core-import-files', 'core-import-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "core_import_files_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'core-import-files' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)));
CREATE POLICY "core_import_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'core-import-files' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)));
CREATE POLICY "core_import_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'core-import-files' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)));
CREATE POLICY "core_import_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'core-import-files' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)));

-- Seed template "Materia Prima — Base"
DO $$
DECLARE v_tpl UUID;
BEGIN
  INSERT INTO public.core_import_templates (name, description, data_type, direction, status, settings)
  VALUES (
    'Materia Prima — Base',
    'Template base para importar y exportar materia prima.',
    'raw_material',
    'both',
    'active',
    jsonb_build_object(
      'on_existing_code', 'update',
      'auto_create_categories', false,
      'auto_create_units', false
    )
  ) RETURNING id INTO v_tpl;

  INSERT INTO public.core_import_template_fields
    (template_id, display_name, column_name, internal_field, data_type, is_required, sort_order) VALUES
    (v_tpl,'Código','codigo','code','text',true,1),
    (v_tpl,'Nombre','nombre','name','text',true,2),
    (v_tpl,'Categoría','categoria','category_id','lookup',true,3),
    (v_tpl,'Unidad de medida','unidad_medida','unit_of_measure_id','lookup',true,4),
    (v_tpl,'Costo unitario','costo_unitario','unit_cost','decimal',true,5),
    (v_tpl,'Moneda','moneda','currency','select',true,6),
    (v_tpl,'Proveedor','proveedor','supplier','text',false,7),
    (v_tpl,'Estado','estado','status','select',true,8),
    (v_tpl,'Observaciones','observaciones','notes','text',false,9);
END $$;
