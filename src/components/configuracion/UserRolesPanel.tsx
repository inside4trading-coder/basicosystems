import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, UserPlus, Mail, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "manager" | "partner" | "rrpp" | "marketing";

interface HubUser {
  id: string;
  email: string;
  full_name: string;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  roles: AppRole[];
}

const ROLE_OPTIONS: { value: AppRole | ""; label: string }[] = [
  { value: "", label: "— Sin rol —" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "partner", label: "Partner" },
  { value: "rrpp", label: "RRPP" },
  { value: "marketing", label: "Marketing" },
];

const ROLE_CAPABILITIES: { role: string; access: string }[] = [
  { role: "Admin", access: "Acceso total: dashboard, pedidos, CRM, planning, crew, RRPP, campañas, llamadas, configuración, administración." },
  { role: "Manager", access: "Dashboard, pedidos, CRM, planning, campañas, llamadas. Sin acceso a configuración ni crew." },
  { role: "Partner", access: "Solo lectura: dashboard y planning. Pensado para socios externos." },
  { role: "RRPP", access: "Dashboard y RRPP (contactos, colaboraciones, notas privadas)." },
  { role: "Marketing", access: "Dashboard, RRPP (sin notas privadas) y campañas." },
  { role: "Sin rol", access: "No ve nada del sistema. Pantalla de cuenta pendiente de aprobación." },
];

export function UserRolesPanel() {
  const [users, setUsers] = useState<HubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setUsers((data as any).users ?? []);
    } catch (e: any) {
      toast.error(e.message || "No se pudo cargar la lista de usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRoleChange = async (user: HubUser, newRole: AppRole | "") => {
    setUpdatingId(user.id);
    try {
      // Drop all existing roles for this user
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id);
      if (delErr) throw delErr;

      // Insert new role if any
      if (newRole) {
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role: newRole });
        if (insErr) throw insErr;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, roles: newRole ? [newRole] : [] } : u
        )
      );
      toast.success(
        newRole
          ? `Rol "${newRole}" asignado a ${user.email}`
          : `Acceso revocado a ${user.email}`
      );
    } catch (e: any) {
      toast.error(e.message || "Error al actualizar rol");
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = users.filter((u) => u.roles.length === 0).length;

  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Usuarios del hub
          </h3>
          {pendingCount > 0 && (
            <p className="text-xs text-status-warning font-semibold mt-1">
              {pendingCount} usuario{pendingCount > 1 ? "s" : ""} pendiente
              {pendingCount > 1 ? "s" : ""} de asignar rol
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refrescar
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando usuarios…
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No hay usuarios registrados
          </div>
        ) : (
          users.map((user) => {
            const currentRole = user.roles[0] ?? "";
            const isPending = user.roles.length === 0;
            return (
              <div
                key={user.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-border last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm truncate">
                      {user.full_name || user.email.split("@")[0]}
                    </p>
                    {!user.email_confirmed && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-status-warning/20 text-status-warning">
                        <Mail className="h-3 w-3" /> Email sin verificar
                      </span>
                    )}
                    {isPending && user.email_confirmed && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-status-warning/20 text-status-warning">
                        <Clock className="h-3 w-3" /> Pendiente
                      </span>
                    )}
                    {!isPending && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-status-success/20 text-status-success">
                        <CheckCircle2 className="h-3 w-3" /> Activo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {updatingId === user.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  <select
                    value={currentRole}
                    onChange={(e) =>
                      handleRoleChange(user, e.target.value as AppRole | "")
                    }
                    disabled={updatingId === user.id}
                    className="text-xs border border-border rounded-md px-2 py-1.5 bg-background font-semibold w-full sm:w-auto disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* How to add new users */}
      <div className="mt-3 text-xs text-muted-foreground flex items-start gap-2">
        <UserPlus className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Para añadir un usuario: pídele que se registre en{" "}
          <code className="bg-muted px-1 py-0.5 rounded font-mono">/login</code>, verifique
          su email, y luego asígnale rol desde esta tabla.
        </span>
      </div>
    </section>
  );
}
