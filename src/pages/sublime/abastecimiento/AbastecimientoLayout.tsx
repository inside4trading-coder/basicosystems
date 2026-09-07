import { NavLink, Outlet } from "react-router-dom";
import { PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { HubHeader } from "@/components/sublime/hub/HubHeader";

const SECTIONS = [
  { to: "/sublime/abastecimiento/compras", label: "Compras" },
  { to: "/sublime/abastecimiento/transito", label: "En tránsito" },
  { to: "/sublime/abastecimiento/preparacion", label: "Preparación" },
  { to: "/sublime/abastecimiento/envios", label: "Envíos" },
  { to: "/sublime/abastecimiento/recepcion", label: "Recepción" },
];

export default function AbastecimientoLayout() {
  return (
    <div className="space-y-6">
      <HubHeader
        icon={PackagePlus}
        title="Abastecimiento"
        subtitle="Compras, envíos y preparación de producto"
      />

      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {SECTIONS.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) =>
              cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )
            }
          >
            {s.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
