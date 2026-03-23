
-- 1. App role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'partner');

-- 2. User roles table (separate from profiles per security guidelines)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function for role checks (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Customers cache (from WooCommerce API fields)
CREATE TABLE public.customers_cache (
  id bigint PRIMARY KEY,
  email text,
  first_name text,
  last_name text,
  username text,
  avatar_url text,
  billing_company text,
  billing_city text,
  billing_state text,
  billing_country text,
  billing_phone text,
  shipping_city text,
  shipping_state text,
  shipping_country text,
  orders_count integer DEFAULT 0,
  total_spent numeric(12,2) DEFAULT 0,
  date_created timestamptz,
  date_modified timestamptz,
  last_order_id bigint,
  last_order_date timestamptz,
  meta_data jsonb DEFAULT '[]'::jsonb,
  synced_at timestamptz DEFAULT now()
);
ALTER TABLE public.customers_cache ENABLE ROW LEVEL SECURITY;

-- 6. Segments (saved filters for campaigns)
CREATE TABLE public.segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

-- 7. Campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text,
  content text,
  segment_id uuid REFERENCES public.segments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- 8. Campaign stats
CREATE TABLE public.campaign_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  emails_sent integer DEFAULT 0,
  emails_delivered integer DEFAULT 0,
  emails_opened integer DEFAULT 0,
  emails_clicked integer DEFAULT 0,
  emails_bounced integer DEFAULT 0,
  emails_unsubscribed integer DEFAULT 0,
  open_rate numeric(5,2) DEFAULT 0,
  click_rate numeric(5,2) DEFAULT 0,
  recorded_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id)
);
ALTER TABLE public.campaign_stats ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- user_roles: users can read own, admins can manage all
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- profiles: users read/update own, admins read all
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- customers_cache: admin and manager
CREATE POLICY "Admin and manager can read customers"
  ON public.customers_cache FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admin and manager can manage customers"
  ON public.customers_cache FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager')
  );

-- segments: admin and manager
CREATE POLICY "Admin and manager can read segments"
  ON public.segments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admin and manager can manage segments"
  ON public.segments FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager')
  );

-- campaigns: admin and manager
CREATE POLICY "Admin and manager can read campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admin and manager can manage campaigns"
  ON public.campaigns FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager')
  );

-- campaign_stats: admin and manager
CREATE POLICY "Admin and manager can read campaign_stats"
  ON public.campaign_stats FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admin and manager can manage campaign_stats"
  ON public.campaign_stats FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager')
  );
