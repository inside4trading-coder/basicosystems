
-- ============ core_locations ============
CREATE TABLE public.core_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'sede',
  is_main boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'activa',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT core_locations_type_check CHECK (type IN ('sede','transito','futura')),
  CONSTRAINT core_locations_status_check CHECK (status IN ('activa','inactiva'))
);
ALTER TABLE public.core_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_locations_admin_manager_all ON public.core_locations FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE TRIGGER core_locations_set_updated_at BEFORE UPDATE ON public.core_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ core_settings (singleton) ============
CREATE TABLE public.core_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL DEFAULT 'BASICO CORE',
  description text NOT NULL DEFAULT 'Sistema de fábrica de BASICO',
  status text NOT NULL DEFAULT 'activo',
  main_location_id uuid REFERENCES public.core_locations(id) ON DELETE SET NULL,
  allow_stock_in_transit boolean NOT NULL DEFAULT true,
  update_woocommerce_inventory boolean NOT NULL DEFAULT true,
  multi_location_mode text NOT NULL DEFAULT 'preparado',
  sku_prefix text NOT NULL DEFAULT 'CORE',
  sku_digits int NOT NULL DEFAULT 6,
  sku_last_number int NOT NULL DEFAULT 0,
  qr_width_mm numeric NOT NULL DEFAULT 57,
  qr_height_mm numeric NOT NULL DEFAULT 40,
  qr_include_qr boolean NOT NULL DEFAULT true,
  qr_include_human_code boolean NOT NULL DEFAULT true,
  qr_include_sku boolean NOT NULL DEFAULT true,
  qr_include_size boolean NOT NULL DEFAULT true,
  qr_include_production_order boolean NOT NULL DEFAULT true,
  qr_include_unit_number boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT core_settings_status_check CHECK (status IN ('activo','inactivo')),
  CONSTRAINT core_settings_multi_check CHECK (multi_location_mode IN ('preparado','no_activo','activo'))
);
ALTER TABLE public.core_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_settings_admin_manager_all ON public.core_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE TRIGGER core_settings_set_updated_at BEFORE UPDATE ON public.core_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ core_woocommerce_status_rules ============
CREATE TABLE public.core_woocommerce_status_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  canonical_name text NOT NULL,
  status_group text NOT NULL,
  enters_production boolean NOT NULL DEFAULT false,
  monitored boolean NOT NULL DEFAULT false,
  excluded boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT core_woo_group_check CHECK (status_group IN ('confirmado','pendiente','excluido'))
);
ALTER TABLE public.core_woocommerce_status_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_woo_admin_manager_all ON public.core_woocommerce_status_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE POLICY core_woo_authenticated_read ON public.core_woocommerce_status_rules FOR SELECT TO authenticated USING (true);
CREATE TRIGGER core_woo_set_updated_at BEFORE UPDATE ON public.core_woocommerce_status_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ core_role_definitions ============
CREATE TABLE public.core_role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
ALTER TABLE public.core_role_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_roles_admin_manager_all ON public.core_role_definitions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE POLICY core_roles_authenticated_read ON public.core_role_definitions FOR SELECT TO authenticated USING (true);
CREATE TRIGGER core_roles_set_updated_at BEFORE UPDATE ON public.core_role_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ core_audit_logs ============
CREATE TABLE public.core_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.core_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_audit_read ON public.core_audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE POLICY core_audit_insert ON public.core_audit_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

-- ============ Seed data ============
INSERT INTO public.core_locations (name, type, is_main, status, notes) VALUES
  ('Pop Up Sublime Barquicenter', 'sede', true, 'activa', 'Sede principal de fábrica.'),
  ('Stock en tránsito', 'transito', false, 'activa', 'Inventario en movimiento entre sedes.');

INSERT INTO public.core_settings (main_location_id)
  SELECT id FROM public.core_locations WHERE is_main = true LIMIT 1;

INSERT INTO public.core_woocommerce_status_rules (slug, canonical_name, status_group, enters_production, monitored, excluded, active) VALUES
  ('processing',        'Pago confirmado automáticamente: pedido en proceso', 'confirmado', true,  false, false, true),
  ('pick-up-listo-par', 'Pick-Up Listo para entrega – Pago efectivo',         'confirmado', true,  false, false, true),
  ('pedido-pick-up-re', 'Pick-Up Recibido – Pago en efectivo',                'confirmado', true,  false, false, true),
  ('el-pedido-esta-si', 'El pedido esta siendo procesado',                    'confirmado', true,  false, false, true),
  ('pedido-recibido-p', 'Pedido recibido – Por cobrar',                       'confirmado', true,  false, false, true),
  ('recordartorio-de-', 'Recordartorio de calificación',                      'confirmado', true,  false, false, true),
  ('tu-pedido-ha-sido', 'Tu pedido ha sido enviado',                          'confirmado', true,  false, false, true),
  ('pedido-listo-para', 'Pedido listo para entrega/despacho',                 'confirmado', true,  false, false, true),
  ('tu-pago-fue-confi', 'Pago confirmado: pedido listo para procesar',        'confirmado', true,  false, false, true),
  ('completed',         'Pedido recibido por POS – Pago por confirmar',       'confirmado', true,  false, false, true),
  ('pending',           'Pending payment',                                    'pendiente',  false, true,  false, true),
  ('on-hold',           'On hold',                                            'pendiente',  false, true,  false, true),
  ('ml-pago-por-confi', 'ML – Pago por confirmar',                            'pendiente',  false, true,  false, true),
  ('pedido-pending-pa', 'Pago por confirmar',                                 'pendiente',  false, true,  false, true),
  ('draft',             'Draft',                                              'pendiente',  false, true,  false, true),
  ('cancelled',         'Cancelled',                                          'excluido',   false, false, true,  true),
  ('refunded',          'Refunded',                                           'excluido',   false, false, true,  true),
  ('failed',            'Failed',                                             'excluido',   false, false, true,  true),
  ('pago-pendiente-po', 'ERROR EN PAGO: Pago pendiente por confirmar',        'excluido',   false, false, true,  true);

INSERT INTO public.core_role_definitions (key, display_name, description, permissions, sort_order) VALUES
  ('admin',          'Admin',          'Puede hacer todo en BASICO CORE.',
    '{"all":true}'::jsonb, 1),
  ('manager',        'Manager',        'Puede hacer todo excepto editar costos y cerrar órdenes.',
    '{"edit_costs":false,"close_orders":false,"all_other":true}'::jsonb, 2),
  ('administracion', 'Administración', 'Gestiona pagos de nómina, capturas, tasa BCV y registro de pagos.',
    '{"payroll_mark_paid":true,"payroll_upload_proof":true,"bcv_rate":true,"payroll_amount":true,"payroll_notes":true}'::jsonb, 3),
  ('responsable',    'Responsable',    'Selecciona proceso, operario, escanea prendas y registra producción.',
    '{"select_process":true,"select_operator":true,"scan":true,"register_production":true}'::jsonb, 4),
  ('operario',       'Operario',       'Realiza el trabajo productivo: costura, corte, estampado, bordado, empaque.',
    '{"perform_work":true}'::jsonb, 5);
