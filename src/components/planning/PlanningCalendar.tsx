import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { NotionTask } from "@/hooks/usePlanningData";
import { deriveStatus, statusVisual, type DerivedStatus } from "@/lib/planningStatus";

interface PlanningCalendarProps {
  tasks: NotionTask[];
  loading: boolean;
  error: string | null;
  selectedDatabaseId: string;
}

const SOURCE_PALETTE = [
  "hsl(354,100%,44%)",
  "hsl(142,71%,45%)",
  "hsl(45,93%,47%)",
  "hsl(200,70%,50%)",
  "hsl(280,60%,55%)",
  "hsl(25,95%,53%)",
];

const NOTION_DOT: Record<string, string> = {
  default: "#9ca3af",
  gray: "#9ca3af",
  brown: "#92400e",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  red: "#ef4444",
};

const NOTION_BADGE_CLASS: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  gray: "bg-gray-100 text-gray-700",
  brown: "bg-amber-100 text-amber-800",
  orange: "bg-orange-100 text-orange-700",
  yellow: "bg-yellow-100 text-yellow-700",
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  pink: "bg-pink-100 text-pink-700",
  red: "bg-red-100 text-red-700",
};

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getCalendarWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  // Monday-based: 0=Mon ... 6=Sun
  let startDay = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startDay);
  const weeks: Date[][] = [];
  const d = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
    // Stop if next week is entirely in the next month
    if (d.getMonth() !== month && w >= 4) break;
  }
  return weeks;
}

function TaskPopover({ task, dotColor }: { task: NotionTask; dotColor: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-full text-left flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold truncate cursor-pointer hover:opacity-80 transition-opacity"
          style={{ backgroundColor: `${dotColor}18`, color: dotColor }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
          <span className="truncate">{task.name?.slice(0, 20) || "Sin título"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2" side="right" align="start">
        <p className="text-sm font-bold leading-snug">{task.name || "Sin título"}</p>

        {task.assignee.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.assignee.map((a, i) => (
              <span key={i} className="text-xs text-muted-foreground">{a.name}</span>
            ))}
          </div>
        )}

        {task.status && (
          <span className={`inline-flex text-[11px] font-semibold rounded-full px-2 py-0.5 ${NOTION_BADGE_CLASS[task.status.color] || NOTION_BADGE_CLASS.default}`}>
            {task.status.name}
          </span>
        )}

        {task.date?.start && (
          <p className="text-xs text-muted-foreground">
            {fmtDate(task.date.start)}{task.date.end ? ` → ${fmtDate(task.date.end)}` : ""}
          </p>
        )}

        <p className="text-xs text-muted-foreground truncate">{task.database_name}</p>

        <a
          href={task.notion_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Abrir en Notion
        </a>
      </PopoverContent>
    </Popover>
  );
}

export default function PlanningCalendar({ tasks, loading, error, selectedDatabaseId }: PlanningCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [undatedOpen, setUndatedOpen] = useState(false);
  const [colorMode, setColorMode] = useState<"status" | "source">("status");

  const showAll = selectedDatabaseId === "all";

  // Source color map
  const sourceColors = useMemo(() => {
    const names = [...new Set(tasks.map((t) => t.database_name))];
    const map: Record<string, string> = {};
    names.forEach((n, i) => { map[n] = SOURCE_PALETTE[i % SOURCE_PALETTE.length]; });
    return map;
  }, [tasks]);

  const getDotColor = (task: NotionTask) => {
    if (colorMode === "source" && showAll) return sourceColors[task.database_name] || SOURCE_PALETTE[0];
    return statusVisual(deriveStatus(task)).dot;
  };

  // Tasks grouped by date string
  const tasksByDate = useMemo(() => {
    const map: Record<string, NotionTask[]> = {};
    for (const t of tasks) {
      if (!t.date?.start) continue;
      const key = t.date.start.slice(0, 10);
      (map[key] ||= []).push(t);
    }
    return map;
  }, [tasks]);

  const undatedTasks = useMemo(() => tasks.filter((t) => !t.date?.start), [tasks]);

  const weeks = useMemo(() => getCalendarWeeks(year, month), [year, month]);

  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };
  const goPrev = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const goNext = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };

  const monthLabel = new Date(year, month).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  // Loading
  if (loading) {
    return (
      <div className="kpi-card p-4 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="grid grid-cols-7 gap-0">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="text-center py-2"><Skeleton className="h-3 w-4 mx-auto" /></div>
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="border-r border-b border-border/50 p-2 min-h-[80px]">
              <Skeleton className="h-3 w-5 mb-2" />
              {i % 4 === 0 && <Skeleton className="h-4 w-full rounded-full" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="bg-[hsl(var(--status-error)/0.1)] border border-[hsl(var(--status-error)/0.2)] rounded-lg p-4">
        <p className="text-sm font-bold text-[hsl(var(--status-error))]">{error}</p>
      </div>
    );
  }

  // Empty
  if (tasks.length === 0) {
    return (
      <div className="kpi-card p-8 text-center animate-fade-in">
        <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <h3 className="text-base font-bold mb-1">No hay tareas con fecha en este período</h3>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="kpi-card overflow-hidden">
        {/* Navigation */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button onClick={goPrev} className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-bold capitalize min-w-[160px] text-center">{monthLabel}</h3>
            <button onClick={goNext} className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button onClick={goToday} className="text-xs font-semibold text-primary hover:underline">
            Hoy
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`text-center py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border ${
                i >= 5 ? "bg-muted/20" : ""
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === month;
              const isToday = sameDay(day, today);
              const key = day.toISOString().slice(0, 10);
              const dayTasks = tasksByDate[key] || [];
              const isWeekend = di >= 5;

              return (
                <div
                  key={di}
                  className={`border-r border-b border-border/50 p-1.5 min-h-[80px] ${
                    isWeekend ? "bg-muted/20" : ""
                  } ${isToday ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : ""} ${
                    !isCurrentMonth ? "opacity-40" : ""
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold block mb-1 ${
                      isToday ? "text-primary font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 2).map((task) => (
                      <TaskPopover key={task.id} task={task} dotColor={getDotColor(task)} />
                    ))}
                    {dayTasks.length > 2 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-full text-center text-[10px] font-semibold text-muted-foreground hover:text-foreground rounded-full bg-muted/60 py-0.5 cursor-pointer">
                            +{dayTasks.length - 2} más
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 space-y-1 max-h-60 overflow-y-auto" side="right">
                          {dayTasks.slice(2).map((task) => (
                            <TaskPopover key={task.id} task={task} dotColor={getDotColor(task)} />
                          ))}
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Source legend */}
      {showAll && Object.keys(sourceColors).length > 1 && (
        <div className="flex items-center gap-4 flex-wrap px-1">
          {Object.entries(sourceColors).map(([name, color]) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-muted-foreground font-semibold">{name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Undated tasks */}
      {undatedTasks.length > 0 && (
        <div className="kpi-card overflow-hidden">
          <button
            onClick={() => setUndatedOpen(!undatedOpen)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tareas sin fecha asignada ({undatedTasks.length})
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${undatedOpen ? "rotate-180" : ""}`} />
          </button>
          {undatedOpen && (
            <div className="border-t border-border divide-y divide-border/50">
              {undatedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-semibold truncate flex-1">{task.name || "Sin título"}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">{task.database_name}</span>
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
                  <a href={task.notion_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
