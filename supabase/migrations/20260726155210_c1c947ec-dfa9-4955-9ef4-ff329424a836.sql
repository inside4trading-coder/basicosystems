
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.sublime_merch_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number text UNIQUE NOT NULL,
  sent_at timestamptz,
  received_at timestamptz,
  carrier text,
  tracking_number text,
  cost_per_kg_eur numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_transit','partially_received','received','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_merch_shipments TO authenticated;
GRANT ALL ON public.sublime_merch_shipments TO service_role;
ALTER TABLE public.sublime_merch_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_merch_shipments admin/manager all"
ON public.sublime_merch_shipments FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_sublime_merch_shipments_updated_at
BEFORE UPDATE ON public.sublime_merch_shipments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sublime_merch_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.sublime_merch_shipments(id) ON DELETE CASCADE,
  box_number text NOT NULL,
  weight_kg numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_transit','received')),
  received_at timestamptz,
  received_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, box_number)
);
CREATE INDEX idx_sublime_merch_boxes_shipment ON public.sublime_merch_boxes(shipment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_merch_boxes TO authenticated;
GRANT ALL ON public.sublime_merch_boxes TO service_role;
ALTER TABLE public.sublime_merch_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_merch_boxes admin/manager all"
ON public.sublime_merch_boxes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_sublime_merch_boxes_updated_at
BEFORE UPDATE ON public.sublime_merch_boxes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sublime_merch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  precio_compra numeric NOT NULL DEFAULT 0,
  codigo_fabricante text,
  peso_kg numeric NOT NULL DEFAULT 0,
  pvp numeric,
  sku_web text UNIQUE,
  fotos_origen text[] NOT NULL DEFAULT '{}',
  fotos_web text[] NOT NULL DEFAULT '{}',
  shipment_id uuid REFERENCES public.sublime_merch_shipments(id) ON DELETE SET NULL,
  box_id uuid REFERENCES public.sublime_merch_boxes(id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'purchased' CHECK (estado IN ('purchased','in_transit','received','available','cancelled')),
  subido_al_sistema boolean NOT NULL DEFAULT false,
  uploaded_at timestamptz,
  uploaded_by uuid,
  received_at timestamptz,
  received_by uuid,
  tax_enabled boolean NOT NULL DEFAULT false,
  tax_amount numeric NOT NULL DEFAULT 0,
  tax_note text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX idx_sublime_merch_items_shipment ON public.sublime_merch_items(shipment_id);
CREATE INDEX idx_sublime_merch_items_box ON public.sublime_merch_items(box_id);
CREATE INDEX idx_sublime_merch_items_estado ON public.sublime_merch_items(estado);
CREATE INDEX idx_sublime_merch_items_sku ON public.sublime_merch_items(sku_web);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_merch_items TO authenticated;
GRANT ALL ON public.sublime_merch_items TO service_role;
ALTER TABLE public.sublime_merch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublime_merch_items admin/manager all"
ON public.sublime_merch_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_sublime_merch_items_updated_at
BEFORE UPDATE ON public.sublime_merch_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
