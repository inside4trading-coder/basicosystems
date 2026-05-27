
-- Operators
CREATE TABLE public.core_factory_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  alias text,
  phone text,
  document_id text,
  photo_url text,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  base_rate numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT core_factory_operators_status_chk CHECK (status IN ('active','inactive'))
);

CREATE INDEX core_factory_operators_status_idx ON public.core_factory_operators (status);
CREATE INDEX core_factory_operators_name_idx ON public.core_factory_operators (first_name, last_name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_factory_operators TO authenticated;
GRANT ALL ON public.core_factory_operators TO service_role;

ALTER TABLE public.core_factory_operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage factory operators"
  ON public.core_factory_operators FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER set_core_factory_operators_updated_at
  BEFORE UPDATE ON public.core_factory_operators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Operator roles
CREATE TABLE public.core_factory_operator_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.core_factory_operators(id) ON DELETE CASCADE,
  role_type text NOT NULL,
  role_label text,
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT core_factory_operator_roles_type_chk CHECK (role_type IN ('cutter','sewer','printer','embroiderer','logistics','packing','quality','other')),
  CONSTRAINT core_factory_operator_roles_status_chk CHECK (status IN ('active','inactive')),
  UNIQUE (operator_id, role_type)
);

CREATE INDEX core_factory_operator_roles_op_idx ON public.core_factory_operator_roles (operator_id);
CREATE INDEX core_factory_operator_roles_type_idx ON public.core_factory_operator_roles (role_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_factory_operator_roles TO authenticated;
GRANT ALL ON public.core_factory_operator_roles TO service_role;

ALTER TABLE public.core_factory_operator_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage factory operator roles"
  ON public.core_factory_operator_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER set_core_factory_operator_roles_updated_at
  BEFORE UPDATE ON public.core_factory_operator_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed test operator
INSERT INTO public.core_factory_operators (first_name, last_name, alias, status, notes)
VALUES ('Operario Corte Test', NULL, 'Corte Test', 'active', 'Operario de prueba para validación de escaneo.');

INSERT INTO public.core_factory_operator_roles (operator_id, role_type, role_label, is_primary, status)
SELECT id, 'cutter', 'Cortador', true, 'active'
FROM public.core_factory_operators
WHERE first_name = 'Operario Corte Test';
