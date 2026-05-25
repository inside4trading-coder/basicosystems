
-- Estructuras de costos
CREATE TABLE public.core_cost_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  product_type text,
  base_currency text NOT NULL DEFAULT 'USD',
  estimated_sale_price numeric,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  total_raw_materials numeric NOT NULL DEFAULT 0,
  total_labor numeric NOT NULL DEFAULT 0,
  total_technical_processes numeric NOT NULL DEFAULT 0,
  total_variable_costs numeric NOT NULL DEFAULT 0,
  total_logistics numeric NOT NULL DEFAULT 0,
  total_other_costs numeric NOT NULL DEFAULT 0,
  total_unit_cost numeric NOT NULL DEFAULT 0,
  estimated_gross_margin numeric,
  estimated_gross_margin_percent numeric,
  suggested_fabrication_fund numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

ALTER TABLE public.core_cost_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "core_cs_admin_manager_all" ON public.core_cost_structures
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_core_cs_set_updated_at
  BEFORE UPDATE ON public.core_cost_structures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_core_cs_status ON public.core_cost_structures(status);
CREATE INDEX idx_core_cs_product_type ON public.core_cost_structures(product_type);

-- Líneas de costos
CREATE TABLE public.core_cost_structure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_structure_id uuid NOT NULL REFERENCES public.core_cost_structures(id) ON DELETE CASCADE,
  section text NOT NULL,
  item_type text,
  raw_material_id uuid REFERENCES public.core_raw_materials(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  unit_of_measure text,
  unit_cost numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  cost_snapshot jsonb,
  process_name text,
  process_order integer,
  adds_to_payroll boolean NOT NULL DEFAULT false,
  suggested_role text,
  supplier text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT core_cs_items_section_check CHECK (section IN ('raw_material','labor','technical_process','variable_cost','logistics','other'))
);

ALTER TABLE public.core_cost_structure_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "core_cs_items_admin_manager_all" ON public.core_cost_structure_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_core_cs_items_set_updated_at
  BEFORE UPDATE ON public.core_cost_structure_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_core_cs_items_structure ON public.core_cost_structure_items(cost_structure_id);
CREATE INDEX idx_core_cs_items_section ON public.core_cost_structure_items(section);
CREATE INDEX idx_core_cs_items_raw_material ON public.core_cost_structure_items(raw_material_id);
