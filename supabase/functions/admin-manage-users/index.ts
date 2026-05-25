import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json(401, { error: "No autorizado" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Sesión inválida" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (callerRoles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return json(403, { error: "Solo administradores" });

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    if (action === "create") {
      const { email, password, full_name, role } = body ?? {};
      if (!email || !password || password.length < 8) {
        return json(400, { error: "Email válido y contraseña de mínimo 8 caracteres requeridos" });
      }
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name ?? "" },
      });
      if (cErr) return json(400, { error: cErr.message });

      const newId = created.user!.id;
      // Ensure profile (trigger usually handles it, but upsert for safety)
      await admin.from("profiles").upsert({
        id: newId,
        email,
        full_name: full_name ?? "",
      });

      if (role) {
        const { error: rErr } = await admin
          .from("user_roles")
          .insert({ user_id: newId, role });
        if (rErr) return json(400, { error: `Usuario creado, pero falló asignar rol: ${rErr.message}` });
      }

      return json(200, { ok: true, user_id: newId });
    }

    if (action === "delete") {
      const { user_id } = body ?? {};
      if (!user_id) return json(400, { error: "user_id requerido" });
      if (user_id === userData.user.id) return json(400, { error: "No puedes eliminarte a ti mismo" });

      await admin.from("user_roles").delete().eq("user_id", user_id);
      await admin.from("profiles").delete().eq("id", user_id);
      const { error: dErr } = await admin.auth.admin.deleteUser(user_id);
      if (dErr) return json(400, { error: dErr.message });
      return json(200, { ok: true });
    }

    if (action === "reset_password") {
      const { email } = body ?? {};
      if (!email) return json(400, { error: "email requerido" });
      const redirectTo =
        req.headers.get("origin") ? `${req.headers.get("origin")}/login` : undefined;
      const { error: rErr } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (rErr) return json(400, { error: rErr.message });
      return json(200, { ok: true });
    }

    return json(400, { error: "Acción no soportada" });
  } catch (e) {
    return json(500, { error: (e as Error).message ?? "Error inesperado" });
  }
});
