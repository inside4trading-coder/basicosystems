
ALTER TABLE public.sublime_merch_items
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'franelas_hoodies',
  ADD COLUMN IF NOT EXISTS use_manual_pvp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pvp_manual numeric;

CREATE TABLE IF NOT EXISTS public.sublime_merch_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type text UNIQUE NOT NULL,
  label text NOT NULL,
  profit_percentage numeric NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublime_merch_pricing_rules TO authenticated;
GRANT ALL ON public.sublime_merch_pricing_rules TO service_role;

ALTER TABLE public.sublime_merch_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sublime_merch_pricing_rules admin/manager all"
ON public.sublime_merch_pricing_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "sublime_merch_pricing_rules read all authenticated"
ON public.sublime_merch_pricing_rules FOR SELECT TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.sublime_merch_pricing_rules_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sublime_merch_pricing_rules_updated_at
BEFORE UPDATE ON public.sublime_merch_pricing_rules
FOR EACH ROW EXECUTE FUNCTION public.sublime_merch_pricing_rules_touch_updated_at();

INSERT INTO public.sublime_merch_pricing_rules (product_type, label, profit_percentage) VALUES
  ('franelas_hoodies', 'Franelas / Hoodies', 100),
  ('pantalones', 'Pantalones', 100),
  ('chaquetas', 'Chaquetas', 100),
  ('zapatos', 'Zapatos', 100),
  ('gorras', 'Gorras', 100),
  ('accesorios', 'Accesorios', 100),
  ('otros', 'Otros', 100)
ON CONFLICT (product_type) DO NOTHING;
