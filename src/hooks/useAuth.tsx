import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type ProfileRole = "admin" | "manager" | "partner" | "rrpp" | "marketing";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: ProfileRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export const ALL_ROUTES: { path: string; label: string }[] = [
  { path: "/dashboard", label: "Resumen de ventas" },
  { path: "/pedidos", label: "Pedidos" },
  { path: "/administracion", label: "Administración" },
  { path: "/crew", label: "Crew" },
  { path: "/planning", label: "Planificación" },
  { path: "/rrpp", label: "RRPP" },
  { path: "/llamadas", label: "Llamadas" },
  { path: "/campaigns", label: "Campañas" },
  { path: "/crm", label: "CRM" },
  { path: "/configuracion", label: "Configuración" },
  { path: "/core", label: "BASICO CORE" },
  { path: "/espana", label: "BASICO ESPAÑA" },
  { path: "/estudio-visual", label: "Estudio Visual" },
];

const DEFAULT_ROLE_ROUTES: Record<ProfileRole, string[]> = {
  admin: ["/dashboard", "/pedidos", "/crm", "/planning", "/crew", "/rrpp", "/campaigns", "/llamadas", "/configuracion", "/administracion", "/sublime", "/core", "/espana", "/estudio-visual"],
  manager: ["/pedidos", "/crm", "/planning", "/campaigns", "/llamadas", "/core", "/espana", "/estudio-visual"],
  partner: ["/planning"],
  rrpp: ["/rrpp"],
  marketing: ["/rrpp", "/campaigns", "/espana"],
};

// Mutable in-memory cache, hydrated from DB (table: role_routes).
let ROLE_ROUTES: Record<ProfileRole, string[]> = { ...DEFAULT_ROLE_ROUTES };
const subscribers = new Set<() => void>();

export function getRoleRoutes(): Record<ProfileRole, string[]> {
  return ROLE_ROUTES;
}

export async function loadRoleRoutes() {
  const { data, error } = await supabase.from("role_routes").select("role, routes");
  if (error || !data) return;
  const next: Record<ProfileRole, string[]> = { ...DEFAULT_ROLE_ROUTES };
  for (const row of data as any[]) {
    next[row.role as ProfileRole] = row.routes || [];
  }
  ROLE_ROUTES = next;
  subscribers.forEach((cb) => cb());
}

export function subscribeRoleRoutes(cb: () => void) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function canAccessRoute(role: ProfileRole | null, path: string): boolean {
  if (!role) return false;
  // Admin always has full access — cannot be locked out via UI.
  if (role === "admin") return true;
  const allowed = ROLE_ROUTES[role] || [];
  return allowed.some((r) => path === r || path.startsWith(r + "/"));
}

export function defaultRouteForRole(role: ProfileRole | null): string {
  if (!role) return "/login";
  if (role === "admin") return "/dashboard";
  return ROLE_ROUTES[role]?.[0] || "/login";
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    // Source of truth: user_roles table (RBAC). Falls back to profiles.role for legacy users.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roles && roles.length > 0) {
      const priority: ProfileRole[] = ["admin", "manager", "rrpp", "marketing", "partner"];
      const found = priority.find((p) => roles.some((r: any) => r.role === p));
      setRole(found ?? "partner");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    // No role assigned → user is in "pending approval" state.
    // Do NOT fall back to a default role; ProtectedRoute shows a "pending" screen.
    setRole((profile?.role as ProfileRole) ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            fetchRole(session.user.id);
            loadRoleRoutes();
          }, 0);
        } else {
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
        loadRoleRoutes();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
