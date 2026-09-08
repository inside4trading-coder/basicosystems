import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Store,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Clock,
  Building2,
  Warehouse,
  ArrowLeftRight,
  Sparkles,
  Wallet,
  Menu,
  Truck,
  Ship,
  PackageCheck,
  Boxes,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Section = { to: string; label: string; icon: typeof BarChart3; end?: boolean };

const groups: { label: string; items: Section[] }[] = [
  {
    label: "General",
    items: [
      { to: "/sublime", label: "Inicio Sublime", icon: Store, end: true },
      { to: "/sublime/resumen", label: "Resumen", icon: LayoutDashboard },
      { to: "/sublime/dashboard", label: "Dashboard comercial", icon: BarChart3 },
    ],
  },
  {
    label: "Abastecimiento",
    items: [
      { to: "/sublime/abastecimiento/compras", label: "Compras", icon: Package },
      { to: "/sublime/abastecimiento/transito", label: "En tránsito", icon: Truck },
      { to: "/sublime/abastecimiento/preparacion", label: "Preparación", icon: Sparkles },
      { to: "/sublime/abastecimiento/envios", label: "Envíos", icon: Ship },
      { to: "/sublime/abastecimiento/recepcion", label: "Recepción", icon: PackageCheck },
    ],
  },
  {
    label: "Inventario",
    items: [
      { to: "/sublime/inventario", label: "Inventario Maestro", icon: Boxes },
      { to: "/sublime/inventario/validacion", label: "Validación inicial", icon: ClipboardList },
      { to: "/sublime/inventario/pendientes", label: "Pendientes", icon: PackageCheck },
      { to: "/sublime/inventario/almacen", label: "Almacén", icon: Warehouse },
      { to: "/sublime/inventario/tienda", label: "Tienda", icon: Store },
      { to: "/sublime/inventario/movimientos", label: "Movimientos", icon: ArrowLeftRight },
      { to: "/sublime/inventario/unidades", label: "Unidades", icon: Boxes },
      { to: "/sublime/inventario/conteos", label: "Conteos", icon: ClipboardList },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/pos", label: "Abrir POS", icon: ShoppingCart },
      { to: "/sublime/pos/ventas", label: "Historial POS", icon: BarChart3 },
      { to: "/sublime/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    label: "Administración",
    items: [
      { to: "/sublime/cierres", label: "Cierres", icon: Wallet },
      { to: "/sublime/admin/obligaciones", label: "Administración", icon: Building2 },
      { to: "/sublime/admin/fichaje", label: "Fichaje", icon: Clock },
    ],
  },
];

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

function SublimeBrand() {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Store className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Módulo</p>
        <h2 className="text-base font-black tracking-tight">Sublime</h2>
        <p className="text-[11px] text-muted-foreground">Operación de tienda</p>
      </div>
    </div>
  );
}

export default function SublimeLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-[1500px] mx-auto p-4 sm:p-6">
      <div className="md:hidden flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Store className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-black tracking-tight">Sublime</h2>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <div className="pt-4">
              <SublimeBrand />
              <NavList onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden md:block md:w-60 shrink-0 md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto">
        <SublimeBrand />
        <NavList />
      </aside>

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
