-- Estudio Visual: generador de imágenes IA (e-commerce + Instagram) para Basico Clothes.
-- Tres tipos de fotografía (fondo_blanco, modelo, mockup), cada uno con su propio preset de
-- prompt/modelo editable desde Configuración. RLS por rol (admin|manager), mismo patrón que el
-- resto del proyecto.

CREATE TABLE public.estudio_prompt_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_type text NOT NULL CHECK (photo_type IN ('fondo_blanco', 'modelo', 'mockup')),
  prompt_text text NOT NULL,
  image_model text NOT NULL DEFAULT 'google/gemini-2.5-flash-image',
  garment_category text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Solo un preset default activo por tipo de fotografía.
CREATE UNIQUE INDEX estudio_prompt_presets_one_default_per_type
  ON public.estudio_prompt_presets (photo_type)
  WHERE is_default;

CREATE TABLE public.estudio_brand_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_storage_path text,
  primary_color text NOT NULL DEFAULT '#E41414',
  secondary_color text NOT NULL DEFAULT '#000000',
  logo_position text NOT NULL DEFAULT 'bottom-right'
    CHECK (logo_position IN ('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
  show_product_name boolean NOT NULL DEFAULT true,
  show_price boolean NOT NULL DEFAULT false,
  generate_story_variant boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE public.estudio_image_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  source_photo_path text NOT NULL,
  photo_type text NOT NULL CHECK (photo_type IN ('fondo_blanco', 'modelo', 'mockup')),
  prompt_preset_id uuid REFERENCES public.estudio_prompt_presets(id),
  prompt_used text NOT NULL,
  image_model text NOT NULL,
  product_name text,
  product_price text,
  generated_image_path text,
  instagram_feed_path text,
  instagram_story_path text,
  cost_usd numeric,
  error_message text
);

ALTER TABLE public.estudio_prompt_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudio_brand_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudio_image_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY estudio_presets_admin_manager ON public.estudio_prompt_presets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY estudio_brand_admin_manager ON public.estudio_brand_template FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY estudio_jobs_admin_manager ON public.estudio_image_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- Semillas: un preset default por tipo de fotografía.
-- "fondo_blanco" usa el prompt real que ya comparte el equipo de Basico Clothes.
-- "modelo" y "mockup" son borradores de partida — deben revisarse y ajustarse desde
-- Configuración una vez el equipo confirme el detalle exacto que quieren.

INSERT INTO public.estudio_prompt_presets (name, photo_type, prompt_text, is_default) VALUES (
  'Fondo blanco — default',
  'fondo_blanco',
  'Necesito que generes un mockup hiperrealista tipo estudio, debe tener las siguientes características: Fondo limpio, iluminación neutra, alta resolución, vista frontal. Sombras mínimas, estilo de e-commerce de moda, estética moderna y neutral. Respetar de la prenda el corte, cuello, textura de la tela, color de la prenda en el tono exacto, cuidando detalladamente de eliminar las arrugas de las prendas. Imitar de forma exacta el diseño de la prenda cuidando hasta el más mínimo detalle en diseño, color o texto.',
  true
);

INSERT INTO public.estudio_prompt_presets (name, photo_type, prompt_text, is_default) VALUES (
  'Con modelo — borrador',
  'modelo',
  'Genera una fotografía hiperrealista de e-commerce de moda en la que un modelo o una modelo de apariencia venezolana/latinoamericana (representativa de la diversidad étnica y fenotípica real de Venezuela, sin caer en un solo estereotipo) luce la prenda. Iluminación de estudio profesional, pose natural, encuadre de cuerpo completo o 3/4, fondo neutro o levemente ambientado. Respetar de la prenda el corte, cuello, textura de la tela, color exacto y todo detalle de diseño o texto, sin alterarlos. Expresión natural, composición propia de una campaña de moda urbana/streetwear.',
  true
);

INSERT INTO public.estudio_prompt_presets (name, photo_type, prompt_text, is_default) VALUES (
  'Mockup lifestyle — borrador',
  'mockup',
  'Genera una fotografía de e-commerce de moda estilo lifestyle/editorial: la prenda en un entorno urbano o cotidiano (no un fondo de estudio liso), con iluminación natural, composición espontánea propia de una campaña de streetwear. Puede incluir elementos de contexto (calle, luz solar, texturas urbanas) sin que distraigan de la prenda. Respetar de la prenda el corte, cuello, textura de la tela, color exacto y todo detalle de diseño o texto, sin alterarlos.',
  true
);

INSERT INTO public.estudio_brand_template (primary_color, secondary_color) VALUES ('#E41414', '#000000');

-- Storage bucket privado + políticas (mismo patrón que crew-documents / core-import-files)
INSERT INTO storage.buckets (id, name, public) VALUES ('estudio-visual', 'estudio-visual', false);

CREATE POLICY "estudio-visual admin manager select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'estudio-visual' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "estudio-visual admin manager insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'estudio-visual' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "estudio-visual admin manager update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'estudio-visual' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "estudio-visual admin manager delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'estudio-visual' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));

-- Sembrar la nueva ruta en role_routes para admin y manager.
UPDATE public.role_routes
  SET routes = array_append(routes, '/estudio-visual')
  WHERE role IN ('admin', 'manager') AND NOT ('/estudio-visual' = ANY(routes));
