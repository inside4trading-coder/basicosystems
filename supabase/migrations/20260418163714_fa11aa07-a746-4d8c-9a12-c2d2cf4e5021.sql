CREATE TABLE public.landing_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  email TEXT NOT NULL,
  message TEXT,
  interest TEXT NOT NULL DEFAULT 'unsure' CHECK (interest IN ('saas', 'tailor', 'unsure')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
ON public.landing_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can read leads"
ON public.landing_leads
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage leads"
ON public.landing_leads
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));