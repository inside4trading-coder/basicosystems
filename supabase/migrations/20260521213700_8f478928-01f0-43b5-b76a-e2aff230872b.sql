DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'escalonamzair@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    -- Remove any non-admin role rows for this user, then ensure admin role exists
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role <> 'admin'::public.app_role;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Make sure a profile row exists
    INSERT INTO public.profiles (id, email, full_name, role)
    SELECT v_uid, u.email, COALESCE(u.raw_user_meta_data ->> 'full_name', ''), 'admin'
    FROM auth.users u
    WHERE u.id = v_uid
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
  END IF;
END$$;