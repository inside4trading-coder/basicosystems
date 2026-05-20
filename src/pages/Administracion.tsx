import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Calendar as CalendarIcon, List, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAdminData } from "@/hooks/useAdminData";
import { AdminKPIs } from "@/components/admin/AdminKPIs";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AdminInstanceSheet } from "@/components/admin/AdminInstanceSheet";
import { AdminListView } from "@/components/admin/AdminListView";
import { AdminListFilters, type ListFilters } from "@/components/admin/AdminListFilters";
import { CreateObligationSheet } from "@/components/admin/CreateObligationSheet";
import { EditInstanceSheet } from "@/components/admin/EditInstanceSheet";
import {
  AdminCalendarSkeleton,
  AdminKPIsSkeleton,
  AdminListSkeleton,
} from "@/components/admin/AdminSkeletons";
import { useAdminScope } from "@/contexts/AdminScope";
import type { ObligationInstance } from "@/types/admin";

type View = "calendar" | "list";

export default function Administracion() {
  const { instances, obligations, loading, error, refetch } = useAdminData();
  const scope = useAdminScope();
  const [view, setView] = useState<View>("calendar");
  const [createOpen, setCreateOpen] = useState(false);

  const initialMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [filters, setFilters] = useState<ListFilters>({
    monthDate: initialMonth,
    category: null,
    responsible: null,
    status: null,
    importance: null,
    onlyOverdue: false,
    next7Days: false,
  });

  const [sheetInstance, setSheetInstance] = useState<ObligationInstance | null>(null);
  const [editInstance, setEditInstance] = useState<ObligationInstance | null>(null);
  const [dismissedOverdue, setDismissedOverdue] = useState(false);
  const [dismissedCritical, setDismissedCritical] = useState(false);
  const [dismissedSoon, setDismissedSoon] = useState(false);

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
      return (
        (i.importance === "critica" || i.importance === "alta") &&
        i.status !== "pagado" &&
        d >= today &&
        d <= in3
      );
    }).length;
  }, [instances, today]);

  const upcomingWeekCount = useMemo(() => {
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    return instances.filter((i) => {
      const d = new Date(i.due_date);
      d.setHours(0, 0, 0, 0);
      return i.status === "proximo_vencer" || (d >= today && d <= in7 && i.status === "pendiente");
    }).length;
  }, [instances, today]);

  // Filtered instances for List view
  const listInstances = useMemo(() => {
    const y = filters.monthDate.getFullYear();
    const m = filters.monthDate.getMonth();
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);

    return instances
      .filter((i) => {
        const d = new Date(i.due_date);
        if (!filters.next7Days && !filters.onlyOverdue) {
          if (d.getFullYear() !== y || d.getMonth() !== m) return false;
        }
        if (filters.category && i.category !== filters.category) return false;
        if (filters.responsible && i.responsible !== filters.responsible) return false;
        if (filters.status && i.status !== filters.status) return false;
        if (filters.importance && i.importance !== filters.importance) return false;
        if (filters.onlyOverdue) {
          const dd = new Date(i.due_date);
          dd.setHours(0, 0, 0, 0);
          if (!(i.status === "vencido" || (dd < today && i.status === "pendiente"))) return false;
        }
        if (filters.next7Days) {
          const dd = new Date(i.due_date);
          dd.setHours(0, 0, 0, 0);
          if (!(dd >= today && dd <= in7 && i.status !== "pagado")) return false;
        }
        return true;
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [instances, filters, today]);

  // Reset alert dismissal when counts go to zero
  useEffect(() => {
    if (overdueCount === 0) setDismissedOverdue(false);
    if (criticalSoonCount === 0) setDismissedCritical(false);
    if (upcomingWeekCount === 0) setDismissedSoon(false);
  }, [overdueCount, criticalSoonCount, upcomingWeekCount]);

  const goPrev = () => {
    const d = new Date(filters.monthDate);
    d.setMonth(d.getMonth() - 1);
    setFilters({ ...filters, monthDate: d });
  };
  const goNext = () => {
    const d = new Date(filters.monthDate);
    d.setMonth(d.getMonth() + 1);
    setFilters({ ...filters, monthDate: d });
  };

  const clearListFilters = () =>
    setFilters({
      ...filters,
      category: null,
      responsible: null,
      status: null,
      importance: null,
      onlyOverdue: false,
      next7Days: false,
    });

  const hasActiveListFilters =
    !!filters.category ||
    !!filters.responsible ||
    !!filters.status ||
    !!filters.importance ||
    filters.onlyOverdue ||
    filters.next7Days;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">{scope.title}</h1>
            <p className="text-muted-foreground text-sm">
              {scope.subtitle}
            </p>
          </div>
        </div>
        <AdminKPIsSkeleton />
        {view === "calendar" ? <AdminCalendarSkeleton /> : <AdminListSkeleton />}
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
          <Building2 className="h-6 w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">{scope.title}</h1>
            <p className="text-muted-foreground text-sm">
              {scope.subtitle}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="brand" size="sm" onClick={() => setCreateOpen(true)}>
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
          <Button variant="brand" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Agregar primera obligación
          </Button>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <AdminKPIs instances={instances} monthDate={filters.monthDate} />

          {/* Alert strips */}
          {overdueCount > 0 && !dismissedOverdue && (
            <button
              type="button"
              onClick={() => {
                setView("list");
                setFilters({ ...filters, onlyOverdue: true });
              }}
              className="w-full flex items-center gap-3 rounded-md border border-status-error/30 bg-status-error/10 px-4 py-3 hover:bg-status-error/15 transition-colors text-left"
            >
              <AlertTriangle className="h-5 w-5 text-status-error shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-bold">{overdueCount} obligaciones vencidas</span> requieren atención
              </div>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissedOverdue(true);
                }}
                className="p-1 rounded hover:bg-status-error/20"
              >
                <X className="h-4 w-4" />
              </span>
            </button>
          )}
          {criticalSoonCount > 0 && !dismissedCritical && (
            <button
              type="button"
              onClick={() => {
                setView("list");
                setFilters({ ...filters, importance: "critica", next7Days: true });
              }}
              className="w-full flex items-center gap-3 rounded-md border border-orange-500/30 bg-orange-500/10 px-4 py-3 hover:bg-orange-500/15 transition-colors text-left"
            >
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-bold">{criticalSoonCount} obligación(es) crítica(s)</span> vencen en los próximos 3 días
              </div>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissedCritical(true);
                }}
                className="p-1 rounded hover:bg-orange-500/20"
              >
                <X className="h-4 w-4" />
              </span>
            </button>
          )}
          {upcomingWeekCount > 0 && !dismissedSoon && (
            <button
              type="button"
              onClick={() => {
                setView("list");
                setFilters({ ...filters, next7Days: true });
              }}
              className="w-full flex items-center gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 px-4 py-3 hover:bg-status-warning/15 transition-colors text-left"
            >
              <AlertTriangle className="h-5 w-5 text-status-warning shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-bold">{upcomingWeekCount} obligación(es)</span> próximas a vencer esta semana
              </div>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissedSoon(true);
                }}
                className="p-1 rounded hover:bg-status-warning/20"
              >
                <X className="h-4 w-4" />
              </span>
            </button>
          )}

          {/* View */}
          {view === "calendar" ? (
            instances.filter((i) => {
              const d = new Date(i.due_date);
              return (
                d.getFullYear() === filters.monthDate.getFullYear() &&
                d.getMonth() === filters.monthDate.getMonth()
              );
            }).length === 0 ? (
              <div className="kpi-card text-center py-16 animate-fade-in">
                <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold">Sin obligaciones este mes</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Puedes crear obligaciones recurrentes para que aparezcan aquí.
                </p>
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Agregar obligación
                </Button>
              </div>
            ) : (
              <AdminCalendar
                monthDate={filters.monthDate}
                instances={instances}
                onPrevMonth={goPrev}
                onNextMonth={goNext}
                onChipClick={(inst) => setSheetInstance(inst)}
                onDayClick={(d) => {
                  setView("list");
                  setFilters({
                    ...filters,
                    monthDate: new Date(d.getFullYear(), d.getMonth(), 1),
                  });
                }}
              />
            )
          ) : (
            <>
              <AdminListFilters filters={filters} onChange={setFilters} />
              <AdminListView
                instances={listInstances}
                onRowClick={(inst) => setSheetInstance(inst)}
                onEdit={(inst) => setEditInstance(inst)}
                onPaid={() => refetch()}
                onClearFilters={clearListFilters}
                hasActiveFilters={hasActiveListFilters}
              />
            </>
          )}
        </>
      )}

      <AdminInstanceSheet
        instance={sheetInstance}
        open={!!sheetInstance}
        onOpenChange={(v) => !v && setSheetInstance(null)}
        onEdit={(inst) => {
          setSheetInstance(null);
          setEditInstance(inst);
        }}
        onPaid={() => {
          setSheetInstance(null);
          refetch();
        }}
      />

      <EditInstanceSheet
        instance={editInstance}
        open={!!editInstance}
        onOpenChange={(v) => !v && setEditInstance(null)}
        onSaved={() => refetch()}
      />

      <CreateObligationSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => refetch()}
      />
    </div>
  );
}
