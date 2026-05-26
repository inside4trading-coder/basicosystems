import { NavLink, Outlet } from "react-router-dom";
import { Factory, LayoutDashboard, Settings, Package, FileSpreadsheet, Calculator, ClipboardList, Boxes, Layers, ListChecks, QrCode, ScanLine, Wallet, Warehouse, BarChart3, FileStack, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

type Section = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };

const groups: { label: string; items: Section[] }[] = [
  {
    label: "General",
    items: [
      { to: "/core", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/core/configuracion", label: "Configuración", icon: Settings },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { to: "/core/materia-prima", label: "Materia Prima", icon: Package },
      { to: "/core/templates-carga", label: "Template de Carga materia prima", icon: FileSpreadsheet },
      { to: "/core/estructuras-costos", label: "Estructuras de Costos", icon: Calculator },
      { to: "/core/templates-costos", label: "Templates Costos / Prod.", icon: FileStack },
      { to: "/core/productos", label: "Catálogo de Fabricación", icon: Boxes },
      { to: "/core/control-reposicion", label: "Control de Reposición", icon: Ban },
    ],
  },
  {
    label: "Producción",
    items: [
      { to: "/core/partidas-fabricacion", label: "Partidas de Fabricación", icon: Layers },
      { to: "/core/necesidades", label: "Necesidades", icon: ListChecks },
      { to: "/core/ordenes-produccion", label: "Órdenes de Producción", icon: ClipboardList },
      { to: "/core/qr", label: "QR / Ficha Viajera", icon: QrCode },
      { to: "/core/escaneo", label: "Escaneo", icon: ScanLine },
    ],
  },
  {
    label: "Operación",
    items: [
      { to: "/core/nomina", label: "Nómina", icon: Wallet },
      { to: "/core/inventario", label: "Inventario", icon: Warehouse },
      { to: "/core/reportes", label: "Reportes", icon: BarChart3 },
    ],
  },
];

export default function CoreLayout() {
  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-[1500px] mx-auto">
      <aside className="md:w-60 shrink-0 md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Factory className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Módulo</p>
            <h2 className="text-base font-black tracking-tight">Basico Core</h2>
          </div>
        </div>
        <nav className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">
                {g.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((s) => (
                  <NavLink
                    key={s.to}
                    to={s.to}
                    end={s.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )
                    }
                  >
                    <s.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
