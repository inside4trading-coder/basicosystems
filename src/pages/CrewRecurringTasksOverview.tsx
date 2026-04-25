import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, ListChecks, Loader2, AlertTriangle, Calendar, Search, Flame, Timer, Sun, ChevronDown } from "lucide-react";
import { useCrewData } from "@/hooks/useCrewData";
import { EmployeeAvatar } from "@/components/crew/EmployeeAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Employee, RecurringTask } from "@/types/crew";

const TZ = "America/Caracas";

interface CaracasParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday … 6 = Saturday
}

/** Get the current wall-clock parts in Caracas timezone. */
function caracasParts(d: Date): CaracasParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10) % 24,
    minute: parseInt(get("minute"), 10),
    weekday: wdMap[get("weekday")] ?? 0,
  };
}


interface TaskWithOwner {
  task: RecurringTask;
  employee: Employee;
  /** Minutes from "now" (Caracas) to the task time today. Negative = past. null = no time set. */
  minutesUntil: number | null;
  /** Display string "HH:MM" of the task time, or null. */
  displayTime: string | null;
}

const dayMap: Record<string, number> = {
  // Spanish (with and without accents)
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6,
  // English
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const freqLabel: Record<string, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
};

const priorityDot: Record<string, string> = {
  low: "bg-[hsl(var(--status-success))]",
  medium: "bg-[hsl(var(--status-warning))]",
  high: "bg-[hsl(var(--status-error))]",
};

const priorityLabel: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

/** Returns true if this recurring task is scheduled for the given Caracas date parts. */
function taskHappensOn(task: RecurringTask, parts: CaracasParts): boolean {
  if (!task.active) return false;
  if (task.frequency === "daily") return true;
  if (task.frequency === "weekly") {
    if (!task.day) return true;
    const wanted = dayMap[task.day.trim().toLowerCase()];
    if (wanted === undefined) return true;
    return parts.weekday === wanted;
  }
  if (task.frequency === "monthly") {
    if (!task.day) return true;
    const n = parseInt(task.day, 10);
    if (Number.isNaN(n)) return true;
    return parts.day === n;
  }
  return false;
}

/** Parse "HH:MM" to {hour, minute} or null. */
function parseHM(timeStr: string): { hour: number; minute: number } | null {
  if (!timeStr) return null;
  const m = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { hour: h, minute: min };
}

export default function CrewRecurringTasksOverview() {
  const navigate = useNavigate();
  const { employees, loading, error } = useCrewData();

  // Re-render every 30s so the buckets stay fresh
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const nowParts = useMemo(() => caracasParts(now), [now]);
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;

  const allTasksToday = useMemo<TaskWithOwner[]>(() => {
    const items: TaskWithOwner[] = [];
    for (const emp of employees) {
      if (emp.status !== "active") continue;
      for (const t of emp.recurring_tasks ?? []) {
        if (!taskHappensOn(t, nowParts)) continue;
        const hm = parseHM(t.time);
        const minutesUntil = hm ? hm.hour * 60 + hm.minute - nowMinutes : null;
        const displayTime = hm
          ? `${String(hm.hour).padStart(2, "0")}:${String(hm.minute).padStart(2, "0")}`
          : null;
        items.push({ task: t, employee: emp, minutesUntil, displayTime });
      }
    }
    items.sort((a, b) => {
      if (a.minutesUntil === null && b.minutesUntil === null) {
        return a.task.name.localeCompare(b.task.name);
      }
      if (a.minutesUntil === null) return 1;
      if (b.minutesUntil === null) return -1;
      return a.minutesUntil - b.minutesUntil;
    });
    return items;
  }, [employees, nowParts, nowMinutes]);

  const uniqueAreas = useMemo(
    () => [...new Set(allTasksToday.map((i) => i.task.area).filter(Boolean))].sort(),
    [allTasksToday],
  );

  const filtered = useMemo(() => {
    return allTasksToday.filter(({ task, employee }) => {
      if (filterArea !== "all" && task.area !== filterArea) return false;
      if (filterPriority !== "all" && task.priority !== filterPriority) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${task.name} ${task.area} ${task.responsible} ${employee.first_name} ${employee.last_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allTasksToday, search, filterArea, filterPriority]);

  const buckets = useMemo(() => {
    const nextHour: TaskWithOwner[] = [];
    const next3h: TaskWithOwner[] = [];
    const restOfDay: TaskWithOwner[] = [];
    const past: TaskWithOwner[] = [];
    const untimed: TaskWithOwner[] = [];

    for (const it of filtered) {
      if (it.minutesUntil === null) {
        untimed.push(it);
        continue;
      }
      if (it.minutesUntil < 0) past.push(it);
      else if (it.minutesUntil <= 60) nextHour.push(it);
      else if (it.minutesUntil <= 180) next3h.push(it);
      else restOfDay.push(it);
    }
    return { nextHour, next3h, restOfDay, past, untimed };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const todayLabel = now.toLocaleDateString("es-VE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: TZ,
  });
  const nowTimeLabel = now.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/crew")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <ListChecks className="h-6 w-6 text-primary" />
              Tareas recurrentes
            </h1>
            <p className="text-sm text-muted-foreground mt-1 capitalize flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {todayLabel} · {nowTimeLabel} <span className="normal-case text-[11px] opacity-70">(Caracas)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={<Flame className="h-4 w-4" />} label="Próxima hora" value={buckets.nextHour.length} tone="error" />
        <SummaryCard icon={<Timer className="h-4 w-4" />} label="Próximas 3 h" value={buckets.next3h.length} tone="warning" />
        <SummaryCard icon={<Sun className="h-4 w-4" />} label="Resto del día" value={buckets.restOfDay.length} tone="info" />
        <SummaryCard icon={<ListChecks className="h-4 w-4" />} label="Total hoy" value={filtered.length} tone="muted" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tarea, área o persona…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterArea} onValueChange={setFilterArea}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Área" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las áreas</SelectItem>
            {uniqueAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Buckets */}
      <Section
        title="Próxima hora"
        subtitle="Lo que arranca en los próximos 60 minutos"
        icon={<Flame className="h-4 w-4 text-[hsl(var(--status-error))]" />}
        items={buckets.nextHour}
        onOpenEmployee={(id) => navigate(`/crew/${id}`)}
        emptyHint="Sin tareas programadas en la próxima hora."
        accent="error"
      />
      <Section
        title="Próximas 3 horas"
        subtitle="Entre 61 minutos y 3 horas a partir de ahora"
        icon={<Timer className="h-4 w-4 text-[hsl(var(--status-warning))]" />}
        items={buckets.next3h}
        onOpenEmployee={(id) => navigate(`/crew/${id}`)}
        emptyHint="Nada en la ventana de 3 horas."
        accent="warning"
      />
      <Section
        title="Resto del día"
        subtitle="Programadas más tarde hoy"
        icon={<Sun className="h-4 w-4 text-primary" />}
        items={buckets.restOfDay}
        onOpenEmployee={(id) => navigate(`/crew/${id}`)}
        emptyHint="No hay más tareas con horario hoy."
        accent="info"
      />
      {buckets.untimed.length > 0 && (
        <Section
          title="Sin horario definido"
          subtitle="Tareas del día que no tienen hora asignada"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          items={buckets.untimed}
          onOpenEmployee={(id) => navigate(`/crew/${id}`)}
          emptyHint=""
          accent="muted"
        />
      )}
      {buckets.past.length > 0 && (
        <Section
          title="Ya pasaron"
          subtitle="Tareas cuya hora prevista ya pasó hoy"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          items={buckets.past}
          onOpenEmployee={(id) => navigate(`/crew/${id}`)}
          emptyHint=""
          accent="muted"
          dimmed
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: number; tone: "error" | "warning" | "info" | "muted" }) {
  const toneClass = {
    error: "text-[hsl(var(--status-error))]",
    warning: "text-[hsl(var(--status-warning))]",
    info: "text-primary",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="kpi-card">
      <div className={cn("flex items-center gap-1.5 text-xs font-medium", toneClass)}>
        {icon}
        {label}
      </div>
      <p className="text-2xl font-black tracking-tight mt-1">{value}</p>
    </div>
  );
}

function Section({
  title, subtitle, icon, items, onOpenEmployee, emptyHint, accent, dimmed,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: TaskWithOwner[];
  onOpenEmployee: (id: string) => void;
  emptyHint: string;
  accent: "error" | "warning" | "info" | "muted";
  dimmed?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const accentBorder = {
    error: "border-l-[hsl(var(--status-error))]",
    warning: "border-l-[hsl(var(--status-warning))]",
    info: "border-l-primary",
    muted: "border-l-border",
  }[accent];

  const accentCount = {
    error: "text-[hsl(var(--status-error))]",
    warning: "text-[hsl(var(--status-warning))]",
    info: "text-primary",
    muted: "text-muted-foreground",
  }[accent];

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="space-y-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 text-left rounded-md hover:bg-muted/40 transition-colors px-2 py-2 -mx-2"
          >
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold flex items-center gap-2">
                {icon}
                {title}
                <span className={cn("text-xs font-bold tabular-nums", accentCount)}>
                  ({items.length})
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          {items.length === 0 ? (
            emptyHint && (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md py-4 px-3 text-center">
                {emptyHint}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {items.map(({ task, employee, displayTime, minutesUntil }) => (
                <div
                  key={task.id}
                  className={cn(
                    "kpi-card border-l-4 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all",
                    accentBorder,
                    dimmed && "opacity-60",
                  )}
                  onClick={() => onOpenEmployee(employee.id)}
                >
                  <div className="flex items-start gap-3">
                    <EmployeeAvatar
                      photoUrl={employee.photo_url}
                      firstName={employee.first_name}
                      lastName={employee.last_name}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-tight">{task.name}</p>
                        <TimeChip displayTime={displayTime} minutesUntil={minutesUntil} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {employee.first_name} {employee.last_name} · {employee.position}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className={cn("h-1.5 w-1.5 rounded-full", priorityDot[task.priority])} />
                          {priorityLabel[task.priority]}
                        </span>
                        <span>·</span>
                        <span>{freqLabel[task.frequency]}</span>
                        {task.area && (<><span>·</span><span>{task.area}</span></>)}
                        {task.responsible && (<><span>·</span><span>Resp: {task.responsible}</span></>)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function TimeChip({
  displayTime, minutesUntil,
}: { displayTime: string | null; minutesUntil: number | null }) {
  if (!displayTime || minutesUntil === null) {
    return (
      <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 whitespace-nowrap">
        sin hora
      </span>
    );
  }
  let label: string;
  let cls: string;
  if (minutesUntil < 0) {
    label = `pasó hace ${formatRel(-minutesUntil)}`;
    cls = "bg-muted text-muted-foreground";
  } else if (minutesUntil <= 15) {
    label = minutesUntil === 0 ? "ahora" : `en ${formatRel(minutesUntil)}`;
    cls = "bg-[hsl(var(--status-error))]/15 text-[hsl(var(--status-error))]";
  } else if (minutesUntil <= 60) {
    label = `en ${formatRel(minutesUntil)}`;
    cls = "bg-[hsl(var(--status-warning))]/15 text-[hsl(var(--status-warning))]";
  } else {
    label = `en ${formatRel(minutesUntil)}`;
    cls = "bg-primary/10 text-primary";
  }
  return (
    <span className={cn("text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap flex items-center gap-1", cls)}>
      <Clock className="h-3 w-3" />
      {displayTime} · {label}
    </span>
  );
}

function formatRel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

