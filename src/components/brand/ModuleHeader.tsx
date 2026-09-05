import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ModuleHeaderProps {
  /** Etiqueta técnica pequeña sobre el título, p. ej. "03 · FÁBRICA" */
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  /** Acciones alineadas a la derecha */
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabecera de módulo del manual de marca [B] SYSTEMS:
 * etiqueta mono en mayúsculas + título display + subtítulo de lectura.
 */
export function ModuleHeader({ eyebrow, title, subtitle, actions, className }: ModuleHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mono-cap text-[10px] text-primary">{eyebrow}</p>}
        <h1 className="brand-heading mt-1 text-xl sm:text-2xl">{title}</h1>
        {subtitle && (
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  );
}
