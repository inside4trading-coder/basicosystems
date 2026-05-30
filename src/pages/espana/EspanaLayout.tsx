import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Settings,
  FileBarChart,
  ShoppingCart,
  Smartphone,
  Globe,
  Package,
  Warehouse,
  Hammer,
  Shirt,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    label: "General",
    items: [
      { to: "/espana", end: true, label: "Dashboard", icon: BarChart3 },
      { to: "/espana/reportes", label: "Reportes", icon: FileBarChart },
      { to: "/espana/configuracion", label: "Configuración", icon: Settings },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/espana/ventas", label: "Ventas", icon: ShoppingCart },
      { to: "/espana/pos", label: "POS Móvil", icon: Smartphone },
      { to: "/espana/woocommerce", label: "WooCommerce España", icon: Globe },
    ],
  },
  {
    label: "Catálogo e inventario",
    items: [
      { to: "/espana/productos", label: "Productos", icon: Package },
      { to: "/espana/inventario", label: "Inventario por sedes", icon: Warehouse },
    ],
  },
  {
    label: "Fabricación ES",
    items: [
      { to: "/espana/fabricacion", label: "Listado de fabricación", icon: Hammer },
      { to: "/espana/blanks-dtf", label: "Blanks / DTF", icon: Shirt },
    ],
  },
];

export default function EspanaLayout() {
  const { pathname } = useLocation();
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Basico España
        </div>
        <h1 className="text-3xl font-black tracking-tight">Basico España</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Operación comercial España: ventas, POS móvil, inventario por sedes, WooCommerce España y fabricación ligera.
        </p>
      </div>

      <nav className="flex flex-wrap gap-x-6 gap-y-3 border-b border-border pb-3">
        {sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
              {section.label}
            </span>
            <div className="flex flex-wrap gap-1">
              {section.items.map((item) => {
                const active = item.end
                  ? pathname === item.to
                  : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end as boolean | undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/70 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
