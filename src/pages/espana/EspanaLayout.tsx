import { NavLink, Outlet } from "react-router-dom";
import {
  Flag,
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
  AlertTriangle,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Section = { to: string; label: string; icon: typeof BarChart3; end?: boolean };

const groups: { label: string; items: Section[] }[] = [
  {
    label: "General",
    items: [
      { to: "/espana", label: "Dashboard", icon: BarChart3, end: true },
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
      { to: "/espana/woocommerce/pedidos", label: "Pedidos Woo", icon: ShoppingCart },
      { to: "/espana/woocommerce/problemas", label: "Problemas Woo", icon: AlertTriangle },
    ],
  },
  {
    label: "Catálogo e Inventario",
    items: [
      { to: "/espana/productos", label: "Productos", icon: Package },
      { to: "/espana/inventario", label: "Inventario por sedes", icon: Warehouse },
      { to: "/espana/etiquetas", label: "Etiquetas / QR", icon: QrCode },
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
  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-[1500px] mx-auto">
      <aside className="md:w-60 shrink-0 md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Flag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Módulo</p>
            <h2 className="text-base font-black tracking-tight">Basico España</h2>
            <p className="text-[11px] text-muted-foreground">Operación comercial España</p>
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
