-- Estudio Visual v2: catálogo de modelos curado por admin + generación de video (motion).
-- Migración aditiva: no altera ni borra nada de la v1.
--
-- Nota de alcance: la mejora "candidatos" (varias opciones por generación) NO entra aquí.
-- Su esquema llegará en la migración que la implemente, para no dejar tablas que nada usa.

-- ---------------------------------------------------------------------------
-- Dimensión de salida exigida a la IA — es lo que hace que "estandarizado" sea cierto.
-- ---------------------------------------------------------------------------
ALTER TABLE public.estudio_prompt_presets
  ADD COLUMN output_size text NOT NULL DEFAULT '1080x1350';

-- ---------------------------------------------------------------------------
-- B · Catálogo de modelos habilitados (curado por admin)
-- ---------------------------------------------------------------------------
CREATE TABLE public.estudio_enabled_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','video')),
  label text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, kind)
);

-- ---------------------------------------------------------------------------
-- C · Movimiento (imagen → video)
-- ---------------------------------------------------------------------------
CREATE TABLE public.estudio_motion_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prompt_text text NOT NULL,
  default_duration_seconds int NOT NULL DEFAULT 5,
  video_model text NOT NULL DEFAULT 'alibaba/wan-2.7',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.estudio_video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_image_path text NOT NULL,
  motion_preset_id uuid REFERENCES public.estudio_motion_presets(id),
  prompt_used text NOT NULL,
  video_model text NOT NULL,
  duration_seconds int NOT NULL,
  resolution text,
  aspect_ratio text,
  -- OpenRouter genera audio por defecto; para loops de producto no lo queremos.
  generate_audio boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','failed')),
  -- Clave para reconciliar un video cuyo navegador se cerró a mitad de la generación.
  openrouter_job_id text,
  video_storage_path text,
  cost_usd numeric,
  error_message text
);

CREATE INDEX estudio_video_jobs_pending_idx
  ON public.estudio_video_jobs(status)
  WHERE status IN ('pending','in_progress');

-- ---------------------------------------------------------------------------
-- RLS — admin|manager, idéntico al resto del módulo
-- ---------------------------------------------------------------------------
ALTER TABLE public.estudio_enabled_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudio_motion_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudio_video_jobs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY estudio_models_admin_manager ON public.estudio_enabled_models FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY estudio_motion_admin_manager ON public.estudio_motion_presets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY estudio_video_admin_manager ON public.estudio_video_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- ---------------------------------------------------------------------------
-- Semillas
-- ---------------------------------------------------------------------------

-- Modelos habilitados por defecto. IDs verificados contra GET /api/v1/models de OpenRouter
-- (ojo: "openai/gpt-image-1" y "openai/gpt-image-2" NO existen en su catálogo).
INSERT INTO public.estudio_enabled_models (model_id, kind, label, is_enabled) VALUES
  ('google/gemini-2.5-flash-image', 'image', 'Gemini 2.5 Flash Image (económico)', true),
  ('google/gemini-3.1-flash-image', 'image', 'Gemini 3.1 Flash Image',             true),
  ('google/gemini-3-pro-image',     'image', 'Gemini 3 Pro Image (calidad)',       true),
  ('openai/gpt-5-image-mini',       'image', 'GPT-5 Image Mini (borradores)',      true),
  ('openai/gpt-5-image',            'image', 'GPT-5 Image',                        true),
  ('alibaba/wan-2.7',               'video', 'Wan 2.7',                            true),
  ('kwaivgi/kling-v3.0-std',        'video', 'Kling 3.0 Standard',                 true),
  ('google/veo-3.1-fast',           'video', 'Veo 3.1 Fast',                       true),
  ('bytedance/seedance-2.0-fast',   'video', 'Seedance 2.0 Fast',                  true);

-- Presets de movimiento pensados para prendas de ropa.
INSERT INTO public.estudio_motion_presets (name, prompt_text, default_duration_seconds, is_default) VALUES
  ('Giro de producto',
   'La prenda rota lentamente sobre su eje vertical, centrada en el encuadre, con iluminación de estudio constante. Movimiento suave y continuo, sin cortes. La prenda mantiene exactamente su color, corte y diseño en todo momento.',
   5, true),
  ('Push-in al detalle',
   'La cámara se acerca lentamente hacia el estampado de la prenda con un movimiento de dolly suave y estable. Sin sacudidas. El diseño y el texto de la prenda permanecen nítidos y sin alterarse.',
   4, false),
  ('Tela en movimiento',
   'Una brisa sutil mueve ligeramente la tela, mostrando su caída y textura. La prenda permanece centrada y legible, sin deformar el estampado.',
   5, false),
  ('Modelo en movimiento',
   'El modelo cambia el peso de un pie al otro con un movimiento natural y relajado, mirando a cámara. Iluminación de estudio constante. La prenda mantiene su color, corte y diseño exactos.',
   6, false),
  ('Reveal',
   'La cámara parte de un primer plano del detalle de la prenda y se aleja suavemente hasta revelar la prenda completa, centrada en el encuadre.',
   6, false);
