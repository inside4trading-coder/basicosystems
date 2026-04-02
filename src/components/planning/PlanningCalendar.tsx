import { Loader2, AlertTriangle, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { NotionTask } from "@/hooks/usePlanningData";

interface PlanningCalendarProps {
  tasks: NotionTask[];
  loading: boolean;
  error: string | null;
}

const NOTION_DOT: Record<string, string> = {
  default: "bg-muted-foreground",
  gray: "bg-gray-400",
  brown: "bg-amber-700",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  red: "bg-red-500",
};

function dotClass(color: string | undefined) {
  return NOTION_DOT[color || "default"] || NOTION_DOT.default;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export default function PlanningCalendar({ tasks, loading, error }: PlanningCalendarProps) {
  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="kpi-card p-4 space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[hsl(var(--status-error)/0.1)] border border-[hsl(var(--status-error)/0.2)] rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-error))]" />
          <p className="text-sm font-bold text-[hsl(var(--status-error))]">{error}</p>
        </div>
      </div>
    );
  }

  const tasksWithDate = tasks.filter((t) => t.date?.start);
  if (tasksWithDate.length === 0) {
    return (
      <div className="kpi-card p-8 text-center animate-fade-in">
        <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <h3 className="text-base font-bold mb-1">No hay tareas con fecha asignada</h3>
        <p className="text-sm text-muted-foreground">Asigna fechas a las tareas en Notion para verlas aquí</p>
      </div>
    );
  }

  // Group by week
  const grouped: Record<string, NotionTask[]> = {};
  for (const t of tasksWithDate) {
    const d = new Date(t.date!.start!);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const key = weekStart.toISOString().slice(0, 10);
    (grouped[key] ||= []).push(t);
  }

  const sortedWeeks = Object.keys(grouped).sort();

  return (
    <div className="space-y-4 animate-fade-in">
      {sortedWeeks.map((week) => (
        <div key={week} className="kpi-card p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Semana del {fmtDate(week)}
          </h4>
          <div className="space-y-1">
            {grouped[week].sort((a, b) => (a.date!.start! > b.date!.start! ? 1 : -1)).map((task) => (
              <a
                key={task.id}
                href={task.notion_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap w-16">
                  {fmtDate(task.date!.start!)}
                </span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass(task.status?.color)}`} />
                <span className="text-sm font-semibold truncate flex-1">{task.name}</span>
                {task.assignee.length > 0 && (
                  <div className="flex -space-x-1">
                    {task.assignee.slice(0, 2).map((a, i) =>
                      a.avatar_url ? (
                        <img key={i} src={a.avatar_url} alt={a.name} title={a.name} className="w-5 h-5 rounded-full border border-card object-cover" />
                      ) : (
                        <span key={i} title={a.name} className="w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-[9px] font-bold flex items-center justify-center border border-card">
                          {a.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      )
                    )}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
