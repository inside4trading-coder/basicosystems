
-- Secuencia para código OP
CREATE SEQUENCE IF NOT EXISTS public.core_production_order_seq START 1;

-- =========================
-- 1) core_production_orders
-- =========================
CREATE TABLE public.core_production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  order_type text NOT NULL DEFAULT 'from_needs',
  priority text NOT NULL DEFAULT 'media',
  core_product_id uuid,
  sku text,
  product_name text,
  total_quantity numeric NOT NULL DEFAULT 0,
  completed_quantity numeric NOT NULL DEFAULT 0,
  pending_quantity numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'needs',
  expected_date date,
  responsible_user_id uuid,
  reason text,
  notes text,
  is_overproduction boolean NOT NULL DEFAULT false,
  manual_close_reason text,
  manual_close_notes text,
  manually_closed_at timestamptz,
  manually_closed_by uuid,
  cancelled_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_production_orders TO authenticated;
GRANT ALL ON public.core_production_orders TO service_role;
ALTER TABLE public.core_production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_po_admin_manager_all ON public.core_production_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX idx_core_po_status ON public.core_production_orders(status);
CREATE INDEX idx_core_po_product ON public.core_production_orders(core_product_id);
CREATE INDEX idx_core_po_created ON public.core_production_orders(created_at DESC);

-- Trigger updated_at
CREATE TRIGGER trg_core_po_updated_at
  BEFORE UPDATE ON public.core_production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para auto-asignar order_code OP-000001
CREATE OR REPLACE FUNCTION public.assign_production_order_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_code IS NULL OR NEW.order_code = '' THEN
    NEW.order_code := 'OP-' || LPAD(nextval('public.core_production_order_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_core_po_order_code
  BEFORE INSERT ON public.core_production_orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_production_order_code();

-- =========================
-- 2) core_production_order_lines
-- =========================
CREATE TABLE public.core_production_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL,
  core_product_id uuid,
  core_variant_id uuid,
  sku text,
  variant_sku text,
  variant_label text,
  size text,
  quantity_ordered numeric NOT NULL DEFAULT 0,
  quantity_completed numeric NOT NULL DEFAULT 0,
  quantity_pending numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_production_order_lines TO authenticated;
GRANT ALL ON public.core_production_order_lines TO service_role;
ALTER TABLE public.core_production_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_pol_admin_manager_all ON public.core_production_order_lines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX idx_core_pol_order ON public.core_production_order_lines(production_order_id);
CREATE INDEX idx_core_pol_variant ON public.core_production_order_lines(core_variant_id);

CREATE TRIGGER trg_core_pol_updated_at
  BEFORE UPDATE ON public.core_production_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- 3) core_production_order_need_links
-- =========================
CREATE TABLE public.core_production_order_need_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL,
  production_need_id uuid NOT NULL,
  quantity_taken numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_production_order_need_links TO authenticated;
GRANT ALL ON public.core_production_order_need_links TO service_role;
ALTER TABLE public.core_production_order_need_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_ponl_admin_manager_all ON public.core_production_order_need_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX idx_core_ponl_order ON public.core_production_order_need_links(production_order_id);
CREATE INDEX idx_core_ponl_need ON public.core_production_order_need_links(production_need_id);

-- =========================
-- 4) core_production_order_processes
-- =========================
CREATE TABLE public.core_production_order_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL,
  process_name text NOT NULL,
  process_type text,
  process_order integer NOT NULL DEFAULT 0,
  adds_to_payroll boolean NOT NULL DEFAULT false,
  suggested_role text,
  rate_snapshot jsonb,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_production_order_processes TO authenticated;
GRANT ALL ON public.core_production_order_processes TO service_role;
ALTER TABLE public.core_production_order_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY core_pop_admin_manager_all ON public.core_production_order_processes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX idx_core_pop_order ON public.core_production_order_processes(production_order_id);

CREATE TRIGGER trg_core_pop_updated_at
  BEFORE UPDATE ON public.core_production_order_processes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
