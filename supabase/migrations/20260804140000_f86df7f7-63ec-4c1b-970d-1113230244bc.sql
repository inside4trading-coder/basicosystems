-- Estudio Visual v3: sesión multi-vista + limpieza del banner de texto de Instagram.
-- Migración aditiva sobre la v1 y la v2 (ninguna de las dos se edita).

-- ---------------------------------------------------------------------------
-- A · Se elimina el banner de texto (nombre/precio) de las variantes de Instagram.
--     El equipo no lo usa: la foto se publica limpia y el texto va en el copy del post.
-- ---------------------------------------------------------------------------
ALTER TABLE public.estudio_brand_template
  DROP COLUMN IF EXISTS show_product_name,
  DROP COLUMN IF EXISTS show_price;

ALTER TABLE public.estudio_image_jobs
  DROP COLUMN IF EXISTS product_name,
  DROP COLUMN IF EXISTS product_price;

-- ---------------------------------------------------------------------------
-- B · Sesión multi-vista: varias vistas de la misma prenda en una sola tanda.
--
--     `is_inferred` marca las vistas que la IA dedujo desde la foto frontal en vez de
--     partir de una foto real de esa vista. No es un detalle cosmético: una espalda
--     inferida puede no coincidir con la prenda real, y sin esta marca el equipo no
--     tiene forma de distinguirla al momento de publicar.
-- ---------------------------------------------------------------------------
ALTER TABLE public.estudio_image_jobs
  ADD COLUMN session_id uuid,
  ADD COLUMN view_type text NOT NULL DEFAULT 'frente'
    CHECK (view_type IN ('frente', 'espalda', 'detalle', 'tres_cuartos')),
  ADD COLUMN is_inferred boolean NOT NULL DEFAULT false,
  -- Dimensión realmente pedida a la IA: ya no queda fija al preset, se elige por corrida.
  ADD COLUMN output_size text;

CREATE INDEX estudio_image_jobs_session_idx ON public.estudio_image_jobs(session_id);

-- ---------------------------------------------------------------------------
-- C · Un segundo estilo de fotografía por tipo, como punto de partida editable.
--     Ahora que el estilo es un solo desplegable, tener más de una opción por tipo es
--     lo que le da sentido.
-- ---------------------------------------------------------------------------
INSERT INTO public.estudio_prompt_presets (name, photo_type, prompt_text, is_default) VALUES
  ('Editorial urbano — borrador',
   'modelo',
   'Genera una fotografía editorial de moda urbana: el modelo o la modelo, de apariencia venezolana/latinoamericana, luce la prenda en un entorno de calle con luz natural dura, composición de campaña y actitud segura. Respetar de la prenda el corte, cuello, textura de la tela, color exacto y todo detalle de diseño o texto, sin alterarlos.',
   false),
  ('Flat lay editorial — borrador',
   'mockup',
   'Genera una fotografía cenital (flat lay) de la prenda extendida sobre una superficie con textura —madera clara o tela neutra—, luz suave lateral y composición editorial minimalista. Respetar de la prenda el corte, textura de la tela, color exacto y todo detalle de diseño o texto, sin alterarlos.',
   false);
