import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Factory, LayoutDashboard, Settings, Package, FileSpreadsheet, Calculator, ClipboardList, Boxes, Layers, ListChecks, QrCode, ScanLine, Wallet, Warehouse, BarChart3, FileStack, Ban, HardHat, Network, Truck, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
      { to: "/core/mapa-woo-core", label: "Mapa Woo / Core", icon: Network },
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
      { to: "/core/operarios", label: "Basico Crew (Operarios)", icon: HardHat },
      { to: "/core/nomina", label: "Nómina", icon: Wallet },
      { to: "/core/despachos", label: "Despachos", icon: Truck },
      { to: "/core/inventario", label: "Inventario", icon: Warehouse },
      { to: "/core/reportes", label: "Reportes", icon: BarChart3 },
    ],
  },
];

const STORAGE_KEY = "core-sidebar-open";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
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
                onClick={onNavigate}
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
  );
}

function CoreHeader() {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Factory className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Módulo</p>
        <h2 className="text-base font-black tracking-tight">Basico Core</h2>
      </div>
    </div>
  );
}

export default function CoreLayout() {
  const [open, setOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  });
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(desktopOpen));
  }, [desktopOpen]);

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-[1500px] mx-auto">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Factory className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-black tracking-tight">Basico Core</h2>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Abrir menú"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <div className="pt-4">
              <CoreHeader />
              <NavList onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:block shrink-0 md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto transition-all duration-300",
          desktopOpen ? "md:w-60" : "md:w-10"
        )}
      >
        <div className={cn("flex mb-3", desktopOpen ? "justify-end" : "justify-center")}>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDesktopOpen((v) => !v)}
            aria-label={desktopOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {desktopOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </Button>
        </div>
        {desktopOpen && (
          <>
            <CoreHeader />
            <NavList />
          </>
        )}
      </aside>

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
