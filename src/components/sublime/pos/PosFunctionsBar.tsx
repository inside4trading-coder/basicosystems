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

export type PosFunctionId =
  | "discount"
  | "note"
  | "coupon"
  | "suspend"
  | "resume"
  | "exchange"
  | "return"
  | "history"
  | "reprint"
  | "seller"
  | "closures";

const FUNCTIONS: { id: PosFunctionId; icon: typeof BadgePercent; label: string }[] = [
  { id: "discount", icon: BadgePercent, label: "Descuento" },
  { id: "note", icon: StickyNote, label: "Nota" },
  { id: "coupon", icon: Ticket, label: "Cupón" },
  { id: "suspend", icon: PauseCircle, label: "Suspender" },
  { id: "resume", icon: PlayCircle, label: "Recuperar" },
  { id: "exchange", icon: ArrowLeftRight, label: "Cambio" },
  { id: "return", icon: RotateCcw, label: "Devolución" },
  { id: "history", icon: History, label: "Historial" },
  { id: "reprint", icon: Printer, label: "Reimprimir" },
  { id: "seller", icon: UserSquare, label: "Vendedor" },
  { id: "closures", icon: Lock, label: "Cierres" },
];

export function PosFunctionsBar({
  className,
  onAction,
}: {
  className?: string;
  onAction?: (id: PosFunctionId, label: string) => void;
}) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {FUNCTIONS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() =>
            onAction
              ? onAction(f.id, f.label)
              : toast.info(`${f.label}: función prevista, aún sin activar.`)
          }
          className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-2 min-w-[76px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
        >
          <f.icon className="h-4 w-4" />
          <span className="text-[11px] font-semibold">{f.label}</span>
        </button>
      ))}
    </div>
  );
}
