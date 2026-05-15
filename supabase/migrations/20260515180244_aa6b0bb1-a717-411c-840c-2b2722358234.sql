
CREATE TABLE IF NOT EXISTS public.sublime_clock_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  test_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.sublime_clock_config (id, test_mode) VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sublime_clock_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config readable by authenticated"
ON public.sublime_clock_config FOR SELECT
TO authenticated USING (true);

CREATE POLICY "config updatable by admin or manager"
ON public.sublime_clock_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Eliminar tienda inactiva y sus referencias
DELETE FROM public.sublime_clock_events WHERE store_id = 'd8782f4d-5e21-4025-8d2a-a9a78bd93d71';
UPDATE public.sublime_clock_settings SET store_id = NULL WHERE store_id = 'd8782f4d-5e21-4025-8d2a-a9a78bd93d71';
DELETE FROM public.sublime_stores WHERE id = 'd8782f4d-5e21-4025-8d2a-a9a78bd93d71';
