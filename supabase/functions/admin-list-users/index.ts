import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller's identity using anon client + their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client for privileged reads
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller is admin
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (callerRoles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List auth users (paginated, take first 200)
    const { data: authList, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;

    const userIds = authList.users.map((u) => u.id);

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const rolesMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesMap.get((r as any).user_id) ?? [];
      arr.push((r as any).role);
      rolesMap.set((r as any).user_id, arr);
    }

    const users = authList.users.map((u) => {
      const profile = profileMap.get(u.id) as any;
      const userRoles = rolesMap.get(u.id) ?? [];
      return {
        id: u.id,
        email: u.email,
        full_name: profile?.full_name ?? "",
        email_confirmed: !!u.email_confirmed_at,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: userRoles,
      };
    });

    // Sort: pending (no roles) first, then by name
    users.sort((a, b) => {
      const aPending = a.roles.length === 0 ? 0 : 1;
      const bPending = b.roles.length === 0 ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return (a.full_name || a.email || "").localeCompare(
        b.full_name || b.email || ""
      );
    });

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Error inesperado" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
