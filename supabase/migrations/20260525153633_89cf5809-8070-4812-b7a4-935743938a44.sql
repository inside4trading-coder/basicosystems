
-- Categorías de materia prima
CREATE TABLE public.core_raw_material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

ALTER TABLE public.core_raw_material_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "core_rm_cat_admin_manager_all"
ON public.core_raw_material_categories
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_core_rm_cat_updated_at
BEFORE UPDATE ON public.core_raw_material_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Unidades de medida
CREATE TABLE public.core_units_of_measure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  abbreviation text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

ALTER TABLE public.core_units_of_measure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "core_uom_admin_manager_all"
ON public.core_units_of_measure
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_core_uom_updated_at
BEFORE UPDATE ON public.core_units_of_measure
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Materias primas
CREATE TABLE public.core_raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category_id uuid REFERENCES public.core_raw_material_categories(id) ON DELETE RESTRICT,
  unit_of_measure_id uuid REFERENCES public.core_units_of_measure(id) ON DELETE RESTRICT,
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  currency text NOT NULL DEFAULT 'USD',
  supplier text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

ALTER TABLE public.core_raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "core_rm_admin_manager_all"
ON public.core_raw_materials
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_core_rm_updated_at
BEFORE UPDATE ON public.core_raw_materials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_core_rm_code ON public.core_raw_materials(code);
CREATE INDEX idx_core_rm_category ON public.core_raw_materials(category_id);
CREATE INDEX idx_core_rm_status ON public.core_raw_materials(status);

-- Seeds categorías
INSERT INTO public.core_raw_material_categories (name) VALUES
  ('Tela'), ('Rib'), ('Mercería'), ('Etiqueta'), ('Packaging'),
  ('Estampado'), ('Bordado'), ('Insumo técnico'), ('Logística'), ('Otro')
ON CONFLICT (name) DO NOTHING;

-- Seeds unidades
INSERT INTO public.core_units_of_measure (name, abbreviation) VALUES
  ('Kilogramo', 'kg'),
  ('Metro', 'm'),
  ('Unidad', 'und'),
  ('Paquete', 'paq'),
  ('Litro', 'l'),
  ('Servicio', 'serv'),
  ('Otro', 'otro')
ON CONFLICT (name) DO NOTHING;
