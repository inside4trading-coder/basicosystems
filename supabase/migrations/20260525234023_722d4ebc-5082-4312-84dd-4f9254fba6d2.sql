
-- Templates de Costos / Producción
CREATE TABLE public.core_cost_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  product_type text,
  base_currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  notes text,
  total_raw_materials numeric NOT NULL DEFAULT 0,
  total_labor numeric NOT NULL DEFAULT 0,
  total_technical_processes numeric NOT NULL DEFAULT 0,
  total_variable_costs numeric NOT NULL DEFAULT 0,
  total_logistics numeric NOT NULL DEFAULT 0,
  total_other_costs numeric NOT NULL DEFAULT 0,
  total_estimated_cost numeric NOT NULL DEFAULT 0,
  source_cost_structure_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.core_cost_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_template_id uuid NOT NULL REFERENCES public.core_cost_templates(id) ON DELETE CASCADE,
  section text NOT NULL,
  item_type text,
  raw_material_id uuid,
  name text NOT NULL,
  description text,
  unit_of_measure text,
  unit_cost numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  process_name text,
  process_order integer,
  adds_to_payroll boolean NOT NULL DEFAULT false,
  suggested_role text,
  supplier text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.core_cost_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_cost_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_ct_admin_manager_all ON public.core_cost_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY core_ct_items_admin_manager_all ON public.core_cost_template_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_core_cost_templates_updated_at
  BEFORE UPDATE ON public.core_cost_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_core_cost_template_items_updated_at
  BEFORE UPDATE ON public.core_cost_template_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_core_cost_template_items_template ON public.core_cost_template_items(cost_template_id);
