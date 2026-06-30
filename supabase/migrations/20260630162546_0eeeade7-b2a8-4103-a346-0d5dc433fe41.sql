CREATE TABLE IF NOT EXISTS public.core_import_value_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_type text NOT NULL CHECK (alias_type IN ('raw_material_category','raw_material_unit','supplier')),
  source_value text NOT NULL,
  normalized_source_value text NOT NULL,
  target_value text,
  target_id uuid,
  action text NOT NULL CHECK (action IN ('map','create','skip')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (alias_type, normalized_source_value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_import_value_aliases TO authenticated;
GRANT ALL ON public.core_import_value_aliases TO service_role;

ALTER TABLE public.core_import_value_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alias admin manager read"
  ON public.core_import_value_aliases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "alias admin manager write"
  ON public.core_import_value_aliases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_core_import_value_aliases_updated
  BEFORE UPDATE ON public.core_import_value_aliases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_core_import_value_aliases_type_norm
  ON public.core_import_value_aliases (alias_type, normalized_source_value);