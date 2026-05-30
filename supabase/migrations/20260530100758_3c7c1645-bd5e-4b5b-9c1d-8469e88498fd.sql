
-- ============ esp_settings ============
CREATE TABLE public.esp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_active boolean NOT NULL DEFAULT true,
  country text NOT NULL DEFAULT 'España',
  currency text NOT NULL DEFAULT 'EUR',
  main_city text DEFAULT 'Madrid',
  main_website text DEFAULT 'basicoclothes.es',
  data_mode text NOT NULL DEFAULT 'manual',
  woo_status text NOT NULL DEFAULT 'no_conectado',
  woo_connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.esp_settings TO authenticated;
GRANT ALL ON public.esp_settings TO service_role;
ALTER TABLE public.esp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_settings select auth" ON public.esp_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_settings manage admin/manager" ON public.esp_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ============ esp_locations ============
CREATE TABLE public.esp_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'retail',
  city text,
  country text NOT NULL DEFAULT 'España',
  currency text NOT NULL DEFAULT 'EUR',
  is_active boolean NOT NULL DEFAULT true,
  inventory_mode text NOT NULL DEFAULT 'own_stock',
  linked_location_id uuid REFERENCES public.esp_locations(id) ON DELETE SET NULL,
  connects_to_woo boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT esp_locations_inventory_mode_chk CHECK (inventory_mode IN ('own_stock','linked_stock','no_stock','woo_stock'))
);
GRANT SELECT ON public.esp_locations TO authenticated;
GRANT ALL ON public.esp_locations TO service_role;
ALTER TABLE public.esp_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_locations select auth" ON public.esp_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_locations manage admin/manager" ON public.esp_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ============ esp_sales_channels ============
CREATE TABLE public.esp_sales_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'manual',
  location_id uuid REFERENCES public.esp_locations(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.esp_sales_channels TO authenticated;
GRANT ALL ON public.esp_sales_channels TO service_role;
ALTER TABLE public.esp_sales_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_channels select auth" ON public.esp_sales_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_channels manage admin/manager" ON public.esp_sales_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ============ esp_payment_methods ============
CREATE TABLE public.esp_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  location_id uuid REFERENCES public.esp_locations(id) ON DELETE SET NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.esp_payment_methods TO authenticated;
GRANT ALL ON public.esp_payment_methods TO service_role;
ALTER TABLE public.esp_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_payments select auth" ON public.esp_payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_payments manage admin/manager" ON public.esp_payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ============ esp_user_location_access ============
CREATE TABLE public.esp_user_location_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  default_location_id uuid REFERENCES public.esp_locations(id) ON DELETE SET NULL,
  can_choose_location boolean NOT NULL DEFAULT false,
  allowed_location_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esp_user_location_access TO authenticated;
GRANT ALL ON public.esp_user_location_access TO service_role;
ALTER TABLE public.esp_user_location_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esp_ula select own or admin" ON public.esp_user_location_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "esp_ula manage admin/manager" ON public.esp_user_location_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_esp_settings_updated BEFORE UPDATE ON public.esp_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_esp_locations_updated BEFORE UPDATE ON public.esp_locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_esp_channels_updated BEFORE UPDATE ON public.esp_sales_channels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_esp_payments_updated BEFORE UPDATE ON public.esp_payment_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_esp_ula_updated BEFORE UPDATE ON public.esp_user_location_access FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Seed ============
INSERT INTO public.esp_settings (module_active, country, currency, main_city, main_website, data_mode, woo_status, woo_connected)
VALUES (true, 'España', 'EUR', 'Madrid', 'basicoclothes.es', 'manual', 'no_conectado', false);

INSERT INTO public.esp_locations (name, code, type, city, country, currency, inventory_mode, connects_to_woo) VALUES
('Web / WooCommerce España', 'WEB_ES', 'ecommerce', 'Madrid', 'España', 'EUR', 'woo_stock', true),
('Pop Up Ibiza', 'IBIZA', 'popup', 'Ibiza', 'España', 'EUR', 'own_stock', false),
('Arturo Soria', 'ARTURO_SORIA', 'retail', 'Madrid', 'España', 'EUR', 'own_stock', false),
('Stock central', 'CENTRAL_ES', 'warehouse', 'Madrid', 'España', 'EUR', 'own_stock', false),
('Otros / temporal', 'OTROS_ES', 'temporary', NULL, 'España', 'EUR', 'no_stock', false);

INSERT INTO public.esp_sales_channels (name, key, type, location_id) VALUES
('WooCommerce España', 'woocommerce_es', 'online', (SELECT id FROM public.esp_locations WHERE code='WEB_ES')),
('Pop Up Ibiza', 'popup_ibiza', 'popup', (SELECT id FROM public.esp_locations WHERE code='IBIZA')),
('Arturo Soria', 'arturo_soria', 'retail', (SELECT id FROM public.esp_locations WHERE code='ARTURO_SORIA')),
('Otros', 'otros', 'manual', (SELECT id FROM public.esp_locations WHERE code='OTROS_ES'));

INSERT INTO public.esp_payment_methods (name, key, sort_order, color) VALUES
('Tarjeta', 'tarjeta', 1, '#0A0A0A'),
('Efectivo', 'efectivo', 2, '#16A34A'),
('Bizum', 'bizum', 3, '#0EA5E9'),
('Transferencia', 'transferencia', 4, '#6366F1'),
('PayPal', 'paypal', 5, '#003087'),
('Otro', 'otro', 6, '#737373');
