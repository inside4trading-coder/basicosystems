// Helper central de autorización funcional para Edge Functions.
// Regla: admin puede todo. Otros roles pueden ejecutar una acción si su rol
// tiene acceso configurado (tabla public.role_routes) al módulo de esa acción.
// No basta con ver la ruta en UI: cada acción sensible valida aquí.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Mapa acción funcional -> módulo (ruta raíz configurable en Configuración / Permisos por rol). */
export const ACTION_MODULE: Record<string, string> = {
  "espana.orders.view": "/espana",
  "espana.orders.read": "/espana",
  "espana.orders.sync": "/espana",
  "espana.orders.reclassify": "/espana",
  "espana.orders.create_fabrication_queue": "/espana",
  "espana.orders.manage_problems": "/espana",
  "espana.catalog.sync": "/espana",
  "core.woo.sync": "/core",
  "core.production.manage": "/core",
  "sublime.manage": "/sublime",
  "estudio.generate": "/estudio-visual",
};

/** Fallback si la fila del rol no existe todavía en role_routes. */
const DEFAULT_ROLE_ROUTES: Record<string, string[]> = {
  admin: ["*"],
  manager: ["/pedidos", "/crm", "/planning", "/campaigns", "/llamadas", "/core", "/espana", "/estudio-visual"],
  partner: ["/planning"],
  rrpp: ["/rrpp"],
  marketing: ["/rrpp", "/campaigns", "/espana"],
};

export interface AuthzResult {
  ok: boolean;
  status: number;
  userId: string | null;
  email: string | null;
  roles: string[];
  errorCode?: "unauthorized" | "forbidden";
  message?: string;
}

function routeAllows(routes: string[], module: string) {
  return routes.some((r) => r === "*" || r === module || module.startsWith(r + "/"));
}

/**
 * Valida token + permiso funcional. Devuelve el resultado y loguea (sin secretos)
 * user_id / email / role / required_permission / permission_result / action.
 */
export async function authorizeAction(
  req: Request,
  permission: string,
  action: string,
): Promise<{ result: AuthzResult; admin: SupabaseClient }> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    console.log(JSON.stringify({ action, required_permission: permission, permission_result: "denied", error_code: "unauthorized" }));
    return { result: { ok: false, status: 401, userId: null, email: null, roles: [], errorCode: "unauthorized", message: "Sesión no válida." }, admin };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) {
    console.log(JSON.stringify({ action, required_permission: permission, permission_result: "denied", error_code: "unauthorized" }));
    return { result: { ok: false, status: 401, userId: null, email: null, roles: [], errorCode: "unauthorized", message: "Sesión no válida." }, admin };
  }

  const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);

  let allowed = roles.includes("admin");
  if (!allowed && roles.length > 0) {
    const module = ACTION_MODULE[permission] ?? null;
    if (module) {
      const { data: rr } = await admin.from("role_routes").select("role, routes").in("role", roles);
      for (const role of roles) {
        const row = ((rr ?? []) as { role: string; routes: string[] }[]).find((x) => x.role === role);
        const routes = row?.routes ?? DEFAULT_ROLE_ROUTES[role] ?? [];
        if (routeAllows(routes, module)) { allowed = true; break; }
      }
    }
  }

  console.log(JSON.stringify({
    user_id: user.id,
    email: user.email ?? null,
    role: roles.join(",") || null,
    required_permission: permission,
    permission_result: allowed ? "allowed" : "denied",
    action,
    error_code: allowed ? null : "forbidden",
  }));

  if (!allowed) {
    return {
      result: {
        ok: false, status: 403, userId: user.id, email: user.email ?? null, roles,
        errorCode: "forbidden", message: "No tienes permiso para ejecutar esta acción.",
      },
      admin,
    };
  }

  return { result: { ok: true, status: 200, userId: user.id, email: user.email ?? null, roles }, admin };
}
