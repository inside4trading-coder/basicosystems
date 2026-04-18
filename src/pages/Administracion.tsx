import { useMemo, useState } from "react";
import { AlertTriangle, Building2, Calendar as CalendarIcon, CheckCircle2, List, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAdminData } from "@/hooks/useAdminData";
import { AdminKPIs } from "@/components/admin/AdminKPIs";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AdminInstanceSheet } from "@/components/admin/AdminInstanceSheet";
import type { ObligationInstance } from "@/types/admin";
import { cn } from "@/lib/utils";

type View = "calendar" | "list";

export default function Administracion() {
  const { instances, obligations, loading, error } = useAdminData();
  const [view, setView] = useState<View>("calendar");
  const [monthDate, setMonthDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [sheetInstance, setSheetInstance] = useState<ObligationInstance | null>(null);
  const [dismissedOverdue, setDismissedOverdue] = useState(false);
  const [dismissedCritical, setDismissedCritical] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const overdueCount = useMemo(
    () =>
      instances.filter((i) => {
        const d = new Date(i.due_date);
        d.setHours(0, 0, 0, 0);
        return i.status === "vencido" || (d < today && i.status === "pendiente");
      }).length,
    [instances, today],
  );

  const criticalSoonCount = useMemo(() => {
    const in3 = new Date(today);
    in3.setDate(in3.getDate() + 3);
    return instances.filter((i) => {
      const d = new Date(i.due_date);
      d.setHours(0, 0, 0, 0);
      return i.importance === "critica" && i.status !== "pagado" && d >= today && d <= in3;
    }).length;
  }, [instances, today]);

  const monthLabel = monthDate.toLocaleDateString("es-VE", { month: "long", year: "numeric" });

  const goPrev = () => {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() - 1);
    setMonthDate(d);
    setSelectedDay(null);
  };
  const goNext = () => {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() + 1);
    setMonthDate(d);
    setSelectedDay(null);
  };

  const dayFiltered = useMemo(() => {
    if (!selectedDay) return null;
    return instances.filter((i) => {
      const d = new Date(i.due_date);
      return (
        d.getFullYear() === selectedDay.getFullYear() &&
        d.getMonth() === selectedDay.getMonth() &&
        d.getDate() === selectedDay.getDate()
      );
    });
  }, [instances, selectedDay]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  const noObligations = obligations.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Administración</h1>
            <p className="text-muted-foreground text-sm">
              Control de obligaciones fijas y recurrentes de la empresa
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as View)}
            className="border rounded-md p-0.5 bg-card"
          >
            <ToggleGroupItem value="calendar" aria-label="Vista calendario" className="h-8 px-3 gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-bold">Calendario</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Vista lista" className="h-8 px-3 gap-1.5">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-bold">Lista</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="brand" size="sm" disabled>
            <Plus className="h-4 w-4" />
            Agregar obligación
          </Button>
        </div>
      </div>

      {/* Empty state: no obligations at all */}
      {noObligations ? (
        <div className="kpi-card text-center py-16">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">Sin obligaciones registradas</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Empieza creando una plantilla de obligación recurrente.
          </p>
          <Button variant="brand" disabled>
            <Plus className="h-4 w-4" />
            Agregar primera obligación
          </Button>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <AdminKPIs instances={instances} monthDate={monthDate} />

          {/* Alert strips */}
          {overdueCount > 0 && !dismissedOverdue && (
            <div className="flex items-center gap-3 rounded-md border border-status-error/30 bg-status-error/10 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-status-error shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-bold">{overdueCount} obligaciones vencidas</span> requieren atención
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDismissedOverdue(true)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {criticalSoonCount > 0 && !dismissedCritical && (
            <div className="flex items-center gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-status-warning shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-bold">{criticalSoonCount} obligaciones críticas</span> vencen en los próximos 3 días
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDismissedCritical(true)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* View */}
          {view === "calendar" ? (
            <AdminCalendar
              monthDate={monthDate}
              instances={instances}
              onPrevMonth={goPrev}
              onNextMonth={goNext}
              onChipClick={(inst) => setSheetInstance(inst)}
              onDayClick={(d) => {
                setSelectedDay(d);
                setView("list");
              }}
            />
          ) : (
            <ListShell
              monthLabel={monthLabel}
              instances={dayFiltered ?? instances}
              selectedDay={selectedDay}
              onClearDay={() => setSelectedDay(null)}
              onRowClick={(inst) => setSheetInstance(inst)}
            />
          )}
        </>
      )}

      <AdminInstanceSheet
        instance={sheetInstance}
        open={!!sheetInstance}
        onOpenChange={(v) => !v && setSheetInstance(null)}
      />
    </div>
  );
}

/* Lista shell — full columns will be implemented in Prompt 3 */
function ListShell({
  monthLabel,
  instances,
  selectedDay,
  onClearDay,
  onRowClick,
}: {
  monthLabel: string;
  instances: ObligationInstance[];
  selectedDay: Date | null;
  onClearDay: () => void;
  onRowClick: (inst: ObligationInstance) => void;
}) {
  if (instances.length === 0) {
    return (
      <div className="kpi-card text-center py-16">
        <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">
          {selectedDay ? "Sin obligaciones este día" : `Sin obligaciones para ${monthLabel}`}
        </h3>
        {selectedDay && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onClearDay}>
            Ver todas
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="kpi-card !p-0 overflow-hidden">
      {selectedDay && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40 text-sm">
          <span className="font-bold">
            Filtrando por{" "}
            {selectedDay.toLocaleDateString("es-VE", { weekday: "long", day: "2-digit", month: "long" })}
          </span>
          <Button variant="ghost" size="sm" onClick={onClearDay}>
            <X className="h-4 w-4" /> Quitar
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase font-bold text-muted-foreground">
            <tr>
              <th className="text-left p-3">Obligación</th>
              <th className="text-left p-3">Vence</th>
              <th className="text-left p-3">Monto</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-left p-3">Importancia</th>
              <th className="text-left p-3">Responsable</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((i) => (
              <tr
                key={i.id}
                onClick={() => onRowClick(i)}
                className="border-t hover:bg-accent/40 cursor-pointer transition-colors"
              >
                <td className="p-3 font-bold">{i.obligation_name ?? "—"}</td>
                <td className="p-3">{new Date(i.due_date).toLocaleDateString("es-VE")}</td>
                <td className="p-3">
                  {new Intl.NumberFormat("es-VE", { style: "currency", currency: i.currency || "USD" }).format(i.amount)}
                </td>
                <td className="p-3 capitalize">{i.status.replace("_", " ")}</td>
                <td className="p-3 capitalize">{i.importance ?? "—"}</td>
                <td className="p-3">{i.responsible ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// keep `cn` import used (avoid TS unused warning if list grows)
void cn;
