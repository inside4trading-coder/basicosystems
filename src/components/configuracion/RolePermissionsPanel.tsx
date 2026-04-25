import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_ROUTES, loadRoleRoutes, useAuth, type ProfileRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";

const EDITABLE_ROLES: ProfileRole[] = ["manager", "partner", "rrpp", "marketing"];
const ROLE_LABELS: Record<ProfileRole, string> = {
  admin: "Admin",
  manager: "Manager",
  partner: "Partner",
  rrpp: "RRPP",
  marketing: "Marketing",
};

export function RolePermissionsPanel() {
  const { role: currentUserRole } = useAuth();
  const [matrix, setMatrix] = useState<Record<ProfileRole, string[]>>({
    admin: [],
    manager: [],
    partner: [],
    rrpp: [],
    marketing: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("role_routes").select("role, routes");
      if (error) {
        toast.error("No se pudo cargar la matriz de permisos");
        setLoading(false);
        return;
      }
      const next: Record<ProfileRole, string[]> = { ...matrix };
      (data as any[]).forEach((row) => {
        next[row.role as ProfileRole] = row.routes || [];
      });
      setMatrix(next);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (currentUserRole !== "admin") return null;

  const toggle = (role: ProfileRole, path: string) => {
    setMatrix((prev) => {
      const has = prev[role].includes(path);
      const next = has ? prev[role].filter((r) => r !== path) : [...prev[role], path];
      return { ...prev, [role]: next };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const rows = EDITABLE_ROLES.map((r) => ({
        role: r,
        routes: matrix[r],
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("role_routes").upsert(rows, { onConflict: "role" });
      if (error) throw new Error(error.message);
      await loadRoleRoutes();
      toast.success("Permisos actualizados");
      setDirty(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="animate-fade-in" style={{ animationDelay: "0.05s" }}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" /> Permisos por rol
      </h3>
      <div className="bg-card rounded-lg border border-border p-5">
        <p className="text-xs text-muted-foreground mb-4">
          Marca los módulos accesibles para cada rol. <span className="font-semibold">Admin</span> siempre tiene acceso total y no es editable.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 font-bold">Módulo</th>
                  {EDITABLE_ROLES.map((r) => (
                    <th key={r} className="text-center px-2 py-2 font-bold">
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_ROUTES.map((route) => (
                  <tr key={route.path} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-2 py-2">
                      <div className="font-medium">{route.label}</div>
                      <div className="text-xs text-muted-foreground font-mono">{route.path}</div>
                    </td>
                    {EDITABLE_ROLES.map((r) => (
                      <td key={r} className="text-center px-2 py-2">
                        <Checkbox
                          checked={matrix[r].includes(route.path)}
                          onCheckedChange={() => toggle(r, route.path)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <Button onClick={save} disabled={!dirty || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </section>
  );
}
