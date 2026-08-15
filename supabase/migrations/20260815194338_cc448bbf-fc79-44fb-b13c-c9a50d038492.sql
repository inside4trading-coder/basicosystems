CREATE TABLE public.estudio_backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  cover_path text,
  reference_path text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudio_backgrounds TO authenticated;
GRANT ALL ON public.estudio_backgrounds TO service_role;

ALTER TABLE public.estudio_backgrounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY estudio_backgrounds_admin_manager ON public.estudio_backgrounds
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TABLE public.estudio_background_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  background_id uuid NOT NULL REFERENCES public.estudio_backgrounds(id) ON DELETE CASCADE,
  model_id text NOT NULL,
  prompt_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estudio_background_prompts_unique UNIQUE (background_id, model_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudio_background_prompts TO authenticated;
GRANT ALL ON public.estudio_background_prompts TO service_role;

ALTER TABLE public.estudio_background_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY estudio_background_prompts_admin_manager ON public.estudio_background_prompts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER estudio_backgrounds_set_updated_at
  BEFORE UPDATE ON public.estudio_backgrounds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER estudio_background_prompts_set_updated_at
  BEFORE UPDATE ON public.estudio_background_prompts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.estudio_backgrounds (name, slug, cover_path, reference_path, is_active, sort_order) VALUES
  ('Asfalto POV', 'asfalto-pov', 'fondos/asfalto-pov.png', 'fondos/asfalto-pov.png', true, 1),
  ('Concreto Crudo', 'concreto-crudo', 'fondos/concreto-crudo.png', 'fondos/concreto-crudo.png', true, 2),
  ('Línea Industrial', 'linea-industrial', 'fondos/linea-industrial.png', 'fondos/linea-industrial.png', true, 3),
  ('Parking Grid', 'parking-grid', 'fondos/parking-grid.png', 'fondos/parking-grid.png', true, 4);