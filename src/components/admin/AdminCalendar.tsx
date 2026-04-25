import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ObligationInstance, InstanceStatus } from "@/types/admin";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dateUtils";

interface Props {
  monthDate: Date;
  instances: ObligationInstance[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onChipClick: (instance: ObligationInstance) => void;
  onDayClick: (date: Date) => void;
}

const STATUS_COLORS: Record<InstanceStatus, string> = {
  pagado: "bg-status-success/15 text-status-success border-status-success/30",
  pendiente: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
  proximo_vencer: "bg-status-warning/15 text-status-warning border-status-warning/30",
  vencido: "bg-status-error/15 text-status-error border-status-error/30",
  pausado: "bg-muted text-muted-foreground border-border",
  anulado: "bg-muted text-muted-foreground border-border line-through",
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const fmtAmount = (n: number, c = "USD") => {
  if (!n) return "";
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
};

export function AdminCalendar({ monthDate, instances, onPrevMonth, onNextMonth, onChipClick, onDayClick }: Props) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  // Mon=0...Sun=6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byDay = new Map<string, ObligationInstance[]>();
  for (const inst of instances) {
    const d = parseLocalDate(inst.due_date);
    if (d.getFullYear() === y && d.getMonth() === m) {
      const key = String(d.getDate());
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(inst);
    }
  }

  const monthLabel = monthDate.toLocaleDateString("es-VE", { month: "long", year: "numeric" });

  return (
    <div className="kpi-card !p-0 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onPrevMonth} aria-label="Mes anterior">
          <ChevronLeft />
        </Button>
        <div className="text-base font-black uppercase tracking-wide">{monthLabel}</div>
        <Button variant="ghost" size="icon" onClick={onNextMonth} aria-label="Siguiente mes">
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={idx} className="min-h-[110px] border-r border-b bg-muted/20" />;
          const items = byDay.get(String(cell.getDate())) ?? [];
          const isToday = cell.getTime() === today.getTime();
          const hasCritical = items.some((i) => i.importance === "critica");
          const visible = items.slice(0, 2);
          const extra = items.length - visible.length;

          return (
            <div
              key={idx}
              className={cn(
                "min-h-[110px] border-r border-b p-1.5 flex flex-col gap-1 transition-colors",
                isToday && "bg-primary/5",
              )}
            >
              <button
                type="button"
                onClick={() => onDayClick(cell)}
                className={cn(
                  "self-start flex items-center gap-1 text-xs font-bold rounded px-1.5 py-0.5 hover:bg-accent",
                  isToday && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {cell.getDate()}
                {hasCritical && (
                  <span className={cn("h-1.5 w-1.5 rounded-full bg-status-error", isToday && "bg-primary-foreground")} />
                )}
              </button>

              <div className="flex flex-col gap-1">
                {visible.map((inst) => (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => onChipClick(inst)}
                    className={cn(
                      "text-left text-[10px] leading-tight border rounded px-1.5 py-1 truncate transition-transform hover:scale-[1.02]",
                      STATUS_COLORS[inst.status],
                    )}
                    title={`${inst.obligation_name ?? ""} · ${fmtAmount(inst.amount, inst.currency)}`}
                  >
                    <div className="font-bold truncate">{inst.obligation_name ?? "—"}</div>
                    {inst.amount > 0 && <div className="opacity-80">{fmtAmount(inst.amount, inst.currency)}</div>}
                  </button>
                ))}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={() => onDayClick(cell)}
                    className="text-[10px] font-bold text-muted-foreground hover:text-foreground text-left px-1.5"
                  >
                    +{extra} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
