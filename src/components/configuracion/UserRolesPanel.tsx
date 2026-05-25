import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  UserPlus,
  Mail,
  CheckCircle2,
  Clock,
  Trash2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

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

export function UserRolesPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<HubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "manager" as AppRole,
  });

  const [deleteTarget, setDeleteTarget] = useState<HubUser | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id);
      if (delErr) throw delErr;

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

  const handleCreate = async () => {
    if (!form.email || !form.password) {
      toast.error("Email y contraseña son obligatorios");
      return;
    }
    if (form.password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "create", ...form },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Usuario ${form.email} creado`);
      setCreateOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "manager" });
      load();
    } catch (e: any) {
      toast.error(e.message || "Error al crear usuario");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "delete", user_id: deleteTarget.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Usuario ${deleteTarget.email} eliminado`);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar usuario");
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPassword = async (user: HubUser) => {
    setUpdatingId(user.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "reset_password", email: user.email },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Email de recuperación enviado a ${user.email}`);
    } catch (e: any) {
      toast.error(e.message || "Error al enviar email");
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
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Nuevo usuario
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
            const isSelf = currentUser?.id === user.id;
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
                    {isSelf && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary">
                        Tú
                      </span>
                    )}
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
                <div className="flex items-center gap-2 flex-wrap">
                  {updatingId === user.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  <select
                    value={currentRole}
                    onChange={(e) =>
                      handleRoleChange(user, e.target.value as AppRole | "")
                    }
                    disabled={updatingId === user.id}
                    className="text-xs border border-border rounded-md px-2 py-1.5 bg-background font-semibold disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Enviar email de recuperación"
                    onClick={() => handleResetPassword(user)}
                    disabled={updatingId === user.id}
                    className="h-8 w-8"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={isSelf ? "No puedes eliminarte" : "Eliminar usuario"}
                    onClick={() => setDeleteTarget(user)}
                    disabled={isSelf || updatingId === user.id}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nu-name">Nombre completo</Label>
              <Input
                id="nu-name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Nombre y apellido"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nu-email">Email</Label>
              <Input
                id="nu-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="usuario@basico.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nu-pass">Contraseña (mín. 8 caracteres)</Label>
              <Input
                id="nu-pass"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nu-role">Rol</Label>
              <select
                id="nu-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
                className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background"
              >
                {ROLE_OPTIONS.filter((o) => o.value !== "").map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente a <strong>{deleteTarget?.email}</strong>, su perfil y todos sus roles. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-3 text-xs text-muted-foreground flex items-start gap-2">
        <UserPlus className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Usá "Nuevo usuario" para crear cuentas directamente con email, contraseña y rol asignado.
        </span>
      </div>
    </section>
  );
}
