import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCoreRoles } from "@/hooks/useCoreRoles";
import { Shield, UserCog, Wallet, ClipboardCheck, Hammer } from "lucide-react";

const icons: Record<string, any> = {
  admin: Shield,
  manager: UserCog,
  administracion: Wallet,
  responsable: ClipboardCheck,
  operario: Hammer,
};

export default function RolesTab() {
  const { data: roles = [], isLoading } = useCoreRoles();

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Definición de roles del módulo CORE. La asignación de usuarios a roles operativos se habilitará en un bloque futuro.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((r) => {
          const Icon = icons[r.key] ?? Shield;
          return (
            <Card key={r.id} className="p-5 rounded-2xl border-border/60">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold">{r.display_name}</h4>
                    <Badge variant="outline" className="text-xs">{r.key}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                  {r.permissions && Object.keys(r.permissions).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {Object.entries(r.permissions).map(([k, v]) => (
                        <Badge key={k} variant="secondary" className="text-xs">
                          {k}: {String(v)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
