
CREATE TABLE public.core_restock_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type text NOT NULL CHECK (reference_type IN ('woocommerce_product','woocommerce_variation','core_product','core_variant','manual_sku')),
  sku text,
  product_name text,
  variant_label text,
  woo_product_id bigint,
  woo_variation_id bigint,
  core_product_id uuid,
  core_variant_id uuid,
  reason text NOT NULL,
  custom_reason text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','temporary','replaced','review')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  replacement_core_product_id uuid,
  replacement_sku text,
  responsible_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX idx_restock_sku ON public.core_restock_control(sku);
CREATE INDEX idx_restock_woo_product ON public.core_restock_control(woo_product_id);
CREATE INDEX idx_restock_woo_variation ON public.core_restock_control(woo_variation_id);
CREATE INDEX idx_restock_core_product ON public.core_restock_control(core_product_id);
CREATE INDEX idx_restock_core_variant ON public.core_restock_control(core_variant_id);
CREATE INDEX idx_restock_status ON public.core_restock_control(status);

-- Prevent duplicate active rules for the same reference
CREATE UNIQUE INDEX uniq_restock_active_sku ON public.core_restock_control(sku) WHERE status = 'active' AND sku IS NOT NULL AND woo_variation_id IS NULL AND core_variant_id IS NULL;
CREATE UNIQUE INDEX uniq_restock_active_woo_var ON public.core_restock_control(woo_variation_id) WHERE status = 'active' AND woo_variation_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_restock_active_core_var ON public.core_restock_control(core_variant_id) WHERE status = 'active' AND core_variant_id IS NOT NULL;

ALTER TABLE public.core_restock_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "core_restock_admin_manager_all" ON public.core_restock_control
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER set_core_restock_updated_at
BEFORE UPDATE ON public.core_restock_control
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
