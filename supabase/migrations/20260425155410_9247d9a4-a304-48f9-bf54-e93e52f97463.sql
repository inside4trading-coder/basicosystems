CREATE TABLE public.role_routes (
  role app_role PRIMARY KEY,
  routes TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.role_routes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (needed so non-admin users know what they can access)
CREATE POLICY "Authenticated can read role_routes"
ON public.role_routes
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage role_routes"
ON public.role_routes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed defaults (matches current ROLE_ROUTES)
INSERT INTO public.role_routes (role, routes) VALUES
  ('admin',     ARRAY['/dashboard','/pedidos','/crm','/planning','/crew','/rrpp','/campaigns','/llamadas','/configuracion','/administracion']),
  ('manager',   ARRAY['/pedidos','/crm','/planning','/campaigns','/llamadas']),
  ('partner',   ARRAY['/planning']),
  ('rrpp',      ARRAY['/rrpp']),
  ('marketing', ARRAY['/rrpp','/campaigns'])
ON CONFLICT (role) DO NOTHING;