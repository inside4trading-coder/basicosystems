
ALTER TABLE public.sublime_clock_settings
  ADD COLUMN IF NOT EXISTS extra_store_ids uuid[] NOT NULL DEFAULT '{}';

INSERT INTO public.sublime_stores (name, address, latitude, longitude, radius_meters, active)
SELECT 'Basico Core', 'Los Cedros, Cabudare, Venezuela', 10.035111, -69.264556, 75, true
WHERE NOT EXISTS (SELECT 1 FROM public.sublime_stores WHERE name = 'Basico Core');
