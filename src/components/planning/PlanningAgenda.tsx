import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, ClipboardList, CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { NotionTask } from "@/hooks/usePlanningData";
import { deriveStatus, statusVisual, type DerivedStatus } from "@/lib/planningStatus";

interface PlanningAgendaProps {
  tasks: NotionTask[];
  loading: boolean;
  error: string | null;
}

interface Bucket {
  key: string;
  title: string;
  hint: string;
  tasks: NotionTask[];
  defaultOpen?: boolean;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date) {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" });
}

function StatusChip({ status }: { status: DerivedStatus }) {
  const v = statusVisual(status);
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
      style={{ backgroundColor: v.bg, color: v.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.dot }} />
      {v.label}
    </span>
  );
}

function TaskRow({ task }: { task: NotionTask }) {
  const status = deriveStatus(task);
  const v = statusVisual(status);
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors border-l-2"
      style={{ borderLeftColor: v.dot }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{task.name || "Sin título"}</span>
          <StatusChip status={status} />
          {task.priority && (
            <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
              {task.priority.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          {task.date?.start && <span>{fmtShort(task.date.start)}</span>}
          {task.date?.start && task.area && <span>·</span>}
          {task.area && <span className="truncate">{task.area}</span>}
          {(task.date?.start || task.area) && <span>·</span>}
          <span className="truncate">{task.database_name}</span>
        </div>
      </div>

      {task.assignee.length > 0 && (
        <div className="flex -space-x-1">
          {task.assignee.slice(0, 3).map((a, i) =>
            a.avatar_url ? (
              <img key={i} src={a.avatar_url} alt={a.name} title={a.name} className="w-6 h-6 rounded-full border-2 border-card object-cover" />
            ) : (
              <span key={i} title={a.name} className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center border-2 border-card">
                {a.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )
          )}
        </div>
      )}

      <a
        href={task.notion_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground"
        title="Abrir en Notion"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function BucketSection({ bucket }: { bucket: Bucket }) {
  const [open, setOpen] = useState(!!bucket.defaultOpen);
  const count = bucket.tasks.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="kpi-card overflow-hidden">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-sm font-bold">{bucket.title}</h3>
            <p className="text-[11px] text-muted-foreground">{bucket.hint}</p>
          </div>
          <span className="text-[11px] font-bold rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {count}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {count === 0 ? (
          <div className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
            Sin tareas en este rango
          </div>
        ) : (
          <div className="border-t border-border divide-y divide-border/50">
            {bucket.tasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function PlanningAgenda({ tasks, loading, error }: PlanningAgendaProps) {
  const buckets = useMemo<Bucket[]>(() => {
    const today = startOfDay(new Date());

    const overdue: NotionTask[] = [];
    const todayList: NotionTask[] = [];
    const tomorrow: NotionTask[] = [];
    const next3: NotionTask[] = [];
    const nextWeek: NotionTask[] = [];
    const later: NotionTask[] = [];
    const noDate: NotionTask[] = [];

    for (const t of tasks) {
      const status = deriveStatus(t);
      // Done tasks should still appear in their day, but skip from overdue.
      if (!t.date?.start) {
        noDate.push(t);
        continue;
      }
      const due = startOfDay(new Date(t.date.start));
      const diff = daysBetween(due, today);

      if (status === "overdue") {
        overdue.push(t);
        continue;
      }
      if (diff < 0) {
        // Past date but done -> include in today's "Hecho recientemente" via today bucket if same day, else later skip
        if (status === "done" && diff >= -1) todayList.push(t);
        continue;
      }
      if (diff === 0) todayList.push(t);
      else if (diff === 1) tomorrow.push(t);
      else if (diff <= 3) next3.push(t);
      else if (diff <= 7) nextWeek.push(t);
      else later.push(t);
    }

    const sortByDate = (arr: NotionTask[]) =>
      [...arr].sort((a, b) => (a.date?.start || "").localeCompare(b.date?.start || ""));

    return [
      { key: "overdue", title: "Vencidas", hint: "Pasaron de fecha sin completar", tasks: sortByDate(overdue) },
      { key: "today", title: "Hoy", hint: "Tareas para el día de hoy", tasks: sortByDate(todayList) },
      { key: "tomorrow", title: "Mañana", hint: "Tareas para mañana", tasks: sortByDate(tomorrow) },
      { key: "next3", title: "Próximos 3 días", hint: "Entre 2 y 3 días", tasks: sortByDate(next3) },
      { key: "week", title: "Próxima semana", hint: "Entre 4 y 7 días", tasks: sortByDate(nextWeek) },
      { key: "later", title: "Más adelante", hint: "A más de 7 días", tasks: sortByDate(later) },
      { key: "no_date", title: "Sin fecha", hint: "Tareas sin fecha asignada", tasks: noDate },
    ];
  }, [tasks]);

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi-card p-4">
            <Skeleton className="h-4 w-40 mb-3" />
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[hsl(var(--status-error)/0.1)] border border-[hsl(var(--status-error)/0.2)] rounded-lg p-4">
        <p className="text-sm font-bold text-[hsl(var(--status-error))]">{error}</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="kpi-card p-8 text-center animate-fade-in">
        <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <h3 className="text-base font-bold mb-1">No hay tareas</h3>
      </div>
    );
  }

  // KPI summary
  const kpis = [
    { key: "overdue", label: "Vencidas", count: buckets.find((b) => b.key === "overdue")!.tasks.length, status: "overdue" as DerivedStatus },
    { key: "today", label: "Hoy", count: buckets.find((b) => b.key === "today")!.tasks.length, status: "pending" as DerivedStatus },
    { key: "tomorrow", label: "Mañana", count: buckets.find((b) => b.key === "tomorrow")!.tasks.length, status: "in_progress" as DerivedStatus },
    { key: "week", label: "Próx. 7 días", count: buckets.find((b) => b.key === "next3")!.tasks.length + buckets.find((b) => b.key === "week")!.tasks.length, status: "delegated" as DerivedStatus },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const v = statusVisual(k.status);
          return (
            <div key={k.key} className="kpi-card p-3 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: v.bg, color: v.fg }}
              >
                <CalendarClock className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{k.label}</div>
                <div className="text-lg font-black leading-none">{k.count}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap px-1">
        {(["done", "in_progress", "pending", "overdue", "delegated", "no_date"] as DerivedStatus[]).map((s) => {
          const v = statusVisual(s);
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.dot }} />
              <span className="text-[11px] font-semibold text-muted-foreground">{v.label}</span>
            </div>
          );
        })}
      </div>

      {/* Buckets */}
      <div className="space-y-3">
        {buckets.map((b) => <BucketSection key={b.key} bucket={b} />)}
      </div>
    </div>
  );
}
