import { AlertTriangle, CalendarClock, CheckCircle2, Clock, DollarSign, Flame, Star } from "lucide-react";
import type { ObligationInstance } from "@/types/admin";
import { cn } from "@/lib/utils";
import { formatDMY } from "@/lib/dateUtils";

interface Props {
  instances: ObligationInstance[];
  monthDate: Date;
}

const fmtMoney = (n: number, c = "USD") =>
  new Intl.NumberFormat("es-VE", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

export function AdminKPIs({ instances, monthDate }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);

  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const monthInst = instances.filter((i) => {
    const d = new Date(i.due_date);
    return d.getFullYear() === y && d.getMonth() === m;
  });

  const pendingMonth = monthInst.filter((i) => i.status === "pendiente" || i.status === "proximo_vencer");
  const pendingAmount = pendingMonth.reduce((s, i) => s + (i.amount || 0), 0);

  const dueWeek = instances.filter((i) => {
    const d = new Date(i.due_date);
    d.setHours(0, 0, 0, 0);
    return d >= today && d <= in7 && i.status !== "pagado";
  });

  const overdue = instances.filter((i) => {
    const d = new Date(i.due_date);
    d.setHours(0, 0, 0, 0);
    return i.status === "vencido" || (d < today && i.status === "pendiente");
  });

  const criticals = instances.filter((i) => {
    const d = new Date(i.due_date);
    d.setHours(0, 0, 0, 0);
    return i.importance === "critica" && i.status !== "pagado" && d >= today;
  });

  const nextImportant = instances
    .filter((i) => {
      const d = new Date(i.due_date);
      d.setHours(0, 0, 0, 0);
      return (i.importance === "critica" || i.importance === "alta") && i.status !== "pagado" && d >= today;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  const noOverdue = overdue.length === 0;
  const cards = [
    { label: "Pendientes del mes", value: pendingMonth.length, icon: Clock, tint: "" },
    { label: "Monto pendiente", value: fmtMoney(pendingAmount), icon: DollarSign, tint: "" },
    { label: "Vencen esta semana", value: dueWeek.length, icon: CalendarClock, tint: "" },
    {
      label: "Vencidas",
      value: overdue.length,
      icon: noOverdue ? CheckCircle2 : AlertTriangle,
      tint: noOverdue
        ? "bg-status-success/10 border-status-success/30"
        : "bg-status-error/10 border-status-error/30",
    },
    {
      label: "Críticas próximas",
      value: criticals.length,
      icon: Flame,
      tint: criticals.length > 0 ? "bg-status-warning/10 border-status-warning/30" : "",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((k, i) => {
        const Icon = k.icon;
        return (
          <div
            key={k.label}
            className={cn("kpi-card animate-fade-in", k.tint)}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{k.label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-black tracking-tight">{k.value}</div>
          </div>
        );
      })}
      <div
        className="kpi-card animate-fade-in"
        style={{ animationDelay: `${cards.length * 60}ms` }}
      >
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Próximo importante</span>
          <Star className="h-4 w-4 text-muted-foreground" />
        </div>
        {nextImportant ? (
          <div className="space-y-0.5">
            <div className="text-sm font-bold truncate">{nextImportant.obligation_name ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {formatDMY(nextImportant.due_date)}
            </div>
            <div className="text-base font-black">{!nextImportant.amount || nextImportant.amount <= 0 ? "Variable" : fmtMoney(nextImportant.amount, nextImportant.currency)}</div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-status-success" /> Sin pendientes
          </div>
        )}
      </div>
    </div>
  );
}
