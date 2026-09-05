import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface BrandWindowProps {
  /** Etiqueta técnica que aparece a la derecha de la barra */
  label?: string;
  /** Contenido opcional alineado a la derecha, después de la etiqueta */
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Motivo "ventana" del manual de marca [B] SYSTEMS.
 * Barra de 38px, radio 16, tres controles a la izquierda y etiqueta mono a la derecha.
 */
export function BrandWindow({ label, actions, className, bodyClassName, children }: BrandWindowProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className
      )}
      style={{ borderRadius: 16 }}
    >
      <div className="flex h-[38px] items-center gap-2 border-b border-border bg-muted/60 px-4">
        <span className="h-[10px] w-[10px] rounded-full bg-[hsl(var(--status-error))]/70" />
        <span className="h-[10px] w-[10px] rounded-full bg-[hsl(var(--status-warning))]/70" />
        <span className="h-[10px] w-[10px] rounded-full bg-[hsl(var(--status-success))]/70" />
        <div className="ml-auto flex items-center gap-3">
          {label && <span className="mono-cap text-[10px] text-muted-foreground">{label}</span>}
          {actions}
        </div>
      </div>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  );
}
