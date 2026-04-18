-- Helper trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- rrpp_contacts
CREATE TABLE public.rrpp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url text,
  name text NOT NULL,
  alias text DEFAULT '',
  contact_type text NOT NULL DEFAULT 'influencer',
  main_channel text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  city text DEFAULT '',
  country text DEFAULT '',
  responsible text DEFAULT '',
  main_tag text DEFAULT '',
  relationship_status text NOT NULL DEFAULT 'nuevo',
  observations text DEFAULT '',
  skills text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rrpp_contacts_status ON public.rrpp_contacts(status);
CREATE INDEX idx_rrpp_contacts_rel_status ON public.rrpp_contacts(relationship_status);
CREATE INDEX idx_rrpp_contacts_type ON public.rrpp_contacts(contact_type);
CREATE TRIGGER trg_rrpp_contacts_updated BEFORE UPDATE ON public.rrpp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.rrpp_social_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.rrpp_contacts(id) ON DELETE CASCADE,
  network text NOT NULL,
  handle text NOT NULL DEFAULT '',
  followers integer NOT NULL DEFAULT 0,
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rrpp_social_contact ON public.rrpp_social_media(contact_id);

CREATE TABLE public.rrpp_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.rrpp_contacts(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT '',
  summary text DEFAULT '',
  result text DEFAULT '',
  next_action text DEFAULT '',
  responsible text DEFAULT '',
  observation text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rrpp_inter_contact ON public.rrpp_interactions(contact_id);

CREATE TABLE public.rrpp_collaborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.rrpp_contacts(id) ON DELETE CASCADE,
  send_date date,
  products text DEFAULT '',
  received boolean NOT NULL DEFAULT false,
  collab_done boolean NOT NULL DEFAULT false,
  has_coupon boolean NOT NULL DEFAULT false,
  coupon_code text DEFAULT '',
  coupon_revenue numeric NOT NULL DEFAULT 0,
  network_posted text DEFAULT '',
  post_date date,
  post_observation text DEFAULT '',
  observations text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rrpp_collab_contact ON public.rrpp_collaborations(contact_id);

CREATE TABLE public.rrpp_private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.rrpp_contacts(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  author text DEFAULT '',
  note_type text NOT NULL DEFAULT 'Observación',
  content text NOT NULL,
  privacy_level text NOT NULL DEFAULT 'Solo admins',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rrpp_notes_contact ON public.rrpp_private_notes(contact_id);

CREATE TABLE public.rrpp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rrpp_audit_contact ON public.rrpp_audit_log(contact_id);

CREATE TABLE public.rrpp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, key)
);
CREATE INDEX idx_rrpp_config_category ON public.rrpp_config(category);

-- Enable RLS
ALTER TABLE public.rrpp_contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrpp_social_media   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrpp_interactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrpp_collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrpp_private_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrpp_audit_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrpp_config         ENABLE ROW LEVEL SECURITY;

-- Policies: operational tables -> admin/rrpp/marketing
CREATE POLICY "RRPP team manage contacts" ON public.rrpp_contacts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'));

CREATE POLICY "RRPP team manage social_media" ON public.rrpp_social_media FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'));

CREATE POLICY "RRPP team manage interactions" ON public.rrpp_interactions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'));

CREATE POLICY "RRPP team manage collaborations" ON public.rrpp_collaborations FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'));

-- Private notes: only admin and rrpp
CREATE POLICY "Admin and RRPP manage private_notes" ON public.rrpp_private_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'rrpp'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'rrpp'));

-- Audit log
CREATE POLICY "Admin manages audit_log" ON public.rrpp_audit_log FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "RRPP team read audit_log" ON public.rrpp_audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'));
CREATE POLICY "RRPP team insert audit_log" ON public.rrpp_audit_log FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'));

-- Config
CREATE POLICY "Admin manages config" ON public.rrpp_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "RRPP team read config" ON public.rrpp_config FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'rrpp') OR has_role(auth.uid(),'marketing'));