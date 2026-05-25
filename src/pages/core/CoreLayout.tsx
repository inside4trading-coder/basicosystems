import { NavLink, Outlet } from "react-router-dom";
import { Factory, LayoutDashboard, Settings, Package, FileSpreadsheet, Calculator, ClipboardList, Boxes, Layers, ListChecks, QrCode, ScanLine, Wallet, Warehouse, BarChart3, FileStack } from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  { to: "/core", label: "Dashboard Core", icon: LayoutDashboard, end: true },
  { to: "/core/configuracion", label: "Configuración Core", icon: Settings },
  { to: "/core/materia-prima", label: "Materia Prima", icon: Package },
  { to: "/core/templates-carga", label: "Templates de Carga", icon: FileSpreadsheet },
  { to: "/core/estructuras-costos", label: "Estructuras de Costos", icon: Calculator },
  { to: "/core/templates-costos", label: "Templates de Costos / Producción", icon: FileStack },
  { to: "/core/productos", label: "Productos Core", icon: Boxes },
  { to: "/core/partidas-fabricacion", label: "Partidas de Fabricación", icon: Layers },
  { to: "/core/necesidades", label: "Necesidades de Producción", icon: ListChecks },
  { to: "/core/ordenes-produccion", label: "Órdenes de Producción", icon: ClipboardList },
  { to: "/core/qr", label: "QR / Ficha Viajera", icon: QrCode },
  { to: "/core/escaneo", label: "Escaneo", icon: ScanLine },
  { to: "/core/nomina", label: "Nómina", icon: Wallet },
  { to: "/core/inventario", label: "Inventario", icon: Warehouse },
  { to: "/core/reportes", label: "Reportes", icon: BarChart3 },
];

export default function CoreLayout() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1500px] mx-auto">
      <aside className="lg:w-64 shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Factory className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Módulo</p>
            <h2 className="text-base font-black tracking-tight">BASICO CORE</h2>
          </div>
        </div>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <span>{s.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
