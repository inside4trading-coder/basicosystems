import {
  ArrowLeftRight,
  BadgePercent,
  History,
  Lock,
  PauseCircle,
  PlayCircle,
  Printer,
  RotateCcw,
  StickyNote,
  Ticket,
  UserSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FUNCTIONS = [
  { icon: BadgePercent, label: "Descuento" },
  { icon: StickyNote, label: "Nota" },
  { icon: Ticket, label: "Cupón" },
  { icon: PauseCircle, label: "Suspender" },
  { icon: PlayCircle, label: "Recuperar" },
  { icon: ArrowLeftRight, label: "Cambio" },
  { icon: RotateCcw, label: "Devolución" },
  { icon: History, label: "Historial" },
  { icon: Printer, label: "Reimprimir" },
  { icon: UserSquare, label: "Vendedor" },
  { icon: Lock, label: "Caja" },
];

export function PosFunctionsBar({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {FUNCTIONS.map((f) => (
        <button
          key={f.label}
          type="button"
          onClick={() => toast.info(`${f.label}: función prevista, aún sin activar.`)}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-2 min-w-[76px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
        >
          <f.icon className="h-4 w-4" />
          <span className="text-[11px] font-semibold">{f.label}</span>
        </button>
      ))}
    </div>
  );
}
