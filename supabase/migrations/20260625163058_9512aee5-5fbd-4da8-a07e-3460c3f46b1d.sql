
-- Add bizum to fondo_metodo enum
ALTER TYPE public.fondo_metodo ADD VALUE IF NOT EXISTS 'bizum';
