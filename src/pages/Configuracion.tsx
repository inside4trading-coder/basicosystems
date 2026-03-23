import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, UserPlus } from "lucide-react";

const mockUsers = [
  { name: "Admin Basico", email: "admin@basicoclothes.es", role: "admin" },
  { name: "Manager Uno", email: "manager@basicoclothes.es", role: "manager" },
  { name: "Partner Demo", email: "partner@basicoclothes.es", role: "partner" },
];

const integrations = [
  { name: "WooCommerce", description: "basicoclothes.es", connected: true },
  { name: "Trello", description: "Workspace Basico", connected: true },
  { name: "Brevo", description: "Email marketing", connected: false },
];

const roleLabel: Record<string, string> = {
  admin: "Admin Basico",
  manager: "Manager Basico",
  partner: "Partner Basico",
};

export default function Configuracion() {
  return (
    <div className="space-y-8 max-w-4xl">
      <h2 className="text-2xl font-black tracking-tight">Configuración</h2>

      {/* Users */}
      <section className="animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Usuarios del hub</h3>
          <Button variant="brand" size="sm">
            <UserPlus className="h-4 w-4 mr-1" /> Invitar usuario
          </Button>
        </div>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {mockUsers.map((user) => (
            <div key={user.email} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
              <div>
                <p className="font-bold text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  defaultValue={user.role}
                  className="text-xs border border-border rounded-md px-2 py-1 bg-background font-semibold"
                >
                  <option value="admin">Admin Basico</option>
                  <option value="manager">Manager Basico</option>
                  <option value="partner">Partner Basico</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Integraciones</h3>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {integrations.map((integ) => (
            <div key={integ.name} className="flex items-center justify-between px-4 py-4 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                {integ.connected ? (
                  <CheckCircle className="h-5 w-5 text-status-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-status-error" />
                )}
                <div>
                  <p className="font-bold text-sm">{integ.name}</p>
                  <p className="text-xs text-muted-foreground">{integ.description}</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Probar conexión</Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
