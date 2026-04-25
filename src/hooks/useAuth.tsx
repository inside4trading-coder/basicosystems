import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type ProfileRole = "admin" | "manager" | "partner" | "rrpp" | "marketing";

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

const ROLE_ROUTES: Record<ProfileRole, string[]> = {
  admin: ["/dashboard", "/pedidos", "/crm", "/planning", "/crew", "/rrpp", "/campaigns", "/llamadas", "/configuracion", "/administracion"],
  manager: ["/dashboard", "/pedidos", "/crm", "/planning", "/campaigns", "/llamadas"],
  partner: ["/dashboard", "/planning"],
  rrpp: ["/dashboard", "/rrpp"],
  marketing: ["/dashboard", "/rrpp", "/campaigns"],
};

export function canAccessRoute(role: ProfileRole | null, path: string): boolean {
  if (!role) return false;
  const allowed = ROLE_ROUTES[role] || [];
  return allowed.some((r) => path === r || path.startsWith(r + "/"));
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
          setTimeout(() => fetchRole(session.user.id), 0);
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
