import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCoreSettings } from "@/hooks/useCoreSettings";
import { ClipboardList, Factory, PackageCheck, Wallet, Layers, AlertTriangle, RefreshCcw } from "lucide-react";

const cards = [
  { label: "Órdenes activas", icon: ClipboardList },
  { label: "Prendas en producción", icon: Factory },
  { label: "Prendas listas para inventario", icon: PackageCheck },
  { label: "Nómina semanal pendiente", icon: Wallet },
  { label: "Partida de fabricación disponible", icon: Layers },
  { label: "Productos no restockeables vendidos", icon: AlertTriangle },
  { label: "Última sincronización WooCommerce", icon: RefreshCcw, placeholder: "—" },
];

export default function CoreDashboard() {
  const { data: settings } = useCoreSettings();
  const active = settings?.status === "activo";
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard Core</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vista general de fábrica. Datos en vivo se activarán en próximos bloques.
          </p>
        </div>
        <Badge variant={active ? "default" : "secondary"}>
          Módulo {active ? "activo" : "inactivo"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5 rounded-2xl border-border/60">
            <div className="flex items-start justify-between">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <c.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Próximamente</span>
            </div>
            <p className="text-3xl font-black mt-4">{c.placeholder ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">{c.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
