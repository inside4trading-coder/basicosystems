
CREATE TABLE public.calls_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text UNIQUE,
  pbx_call_id text,
  call_start timestamp with time zone,
  call_end timestamp with time zone,
  caller text,
  destination text,
  direction text, -- 'incoming' | 'outgoing' | 'internal'
  status text, -- 'answered' | 'no_answer' | 'busy' | 'missed'
  duration integer DEFAULT 0, -- seconds total
  talk_duration integer DEFAULT 0, -- seconds talked
  sip text,
  agent_name text,
  cost numeric DEFAULT 0,
  is_recorded boolean DEFAULT false,
  recording_url text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.calls_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and manager can manage calls"
  ON public.calls_cache FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and manager can read calls"
  ON public.calls_cache FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TABLE public.sip_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sip_id text UNIQUE NOT NULL,
  agent_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sip_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and manager can manage sip_agents"
  ON public.sip_agents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin and manager can read sip_agents"
  ON public.sip_agents FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
