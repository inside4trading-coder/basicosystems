import { cn } from "@/lib/utils";

export interface SystemStatusCounter {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "error";
}

interface SystemStatusBarProps {
  /** Texto tipo "actualizado hace 2 min" */
  updatedLabel?: string;
  counters?: SystemStatusCounter[];
  className?: string;
}

const toneClass: Record<NonNullable<SystemStatusCounter["tone"]>, string> = {
  default: "text-foreground",
  success: "text-[hsl(var(--status-success))]",
  warning: "text-[hsl(var(--status-warning))]",
  error: "text-[hsl(var(--status-error))]",
};

/** Franja de estado del sistema: última actualización + contadores operativos. */
export function SystemStatusBar({ updatedLabel, counters = [], className }: SystemStatusBarProps) {
  if (!updatedLabel && counters.length === 0) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-2",
        className
      )}
    >
      {updatedLabel && (
        <span className="mono-cap text-[10px] text-muted-foreground">{updatedLabel}</span>
      )}
      {counters.map((c) => (
        <span key={c.label} className="flex items-baseline gap-2">
          <span className="mono-cap text-[10px] text-muted-foreground">{c.label}</span>
          <span className={cn("num text-sm font-bold", toneClass[c.tone ?? "default"])}>{c.value}</span>
        </span>
      ))}
    </div>
  );
}
