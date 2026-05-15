ALTER TABLE public.sublime_stores
  ADD COLUMN IF NOT EXISTS latitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS radius_meters integer NOT NULL DEFAULT 75;

INSERT INTO public.sublime_stores (name, address, latitude, longitude, radius_meters, active)
SELECT 'Sublime - C.C. Barquicenter',
       'C.C. Barquicenter, Barquisimeto, Lara, Venezuela',
       10.067667, -69.313389, 75, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.sublime_stores WHERE name = 'Sublime - C.C. Barquicenter'
);