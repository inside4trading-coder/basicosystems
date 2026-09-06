import { useMemo, useState } from "react";
import { ChevronDown, CalendarX } from "lucide-react";
import type { NotionTask } from "@/hooks/usePlanningData";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { dateKey, groupTasksByDate } from "@/lib/planningDates";
import PlanningMonth from "./PlanningMonth";
import PlanningMonthMobile from "./PlanningMonthMobile";
import PlanningWeek from "./PlanningWeek";
import PlanningDayPanel from "./PlanningDayPanel";
import TaskDetailDialog from "./TaskDetailDialog";
import { StatusLegend, TaskCard } from "./planningShared";

interface Props {
  tasks: NotionTask[];
  loading: boolean;
  error: string | null;
  cursor: Date;
  view: "mes" | "semana";
  notionUrl?: string;
}

export default function PlanningCalendar({ tasks, loading, error, cursor, view, notionUrl }: Props) {
  const isMobile = useIsMobile();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<NotionTask | null>(null);

  const tasksByDate = useMemo(() => groupTasksByDate(tasks), [tasks]);
  const undated = useMemo(() => tasks.filter((t) => !t.date?.start), [tasks]);

  const openDay = (d: Date) => {
    setSelectedDay(d);
    if (isMobile) setSheetOpen(true);
    else setPanelOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[420px] w-full" />
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

  const dayTasks = selectedDay ? tasksByDate[dateKey(selectedDay)] ?? [] : [];

  return (
    <div className="space-y-4 animate-fade-in">
      <StatusLegend />

      <div className={panelOpen && !isMobile ? "grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start" : ""}>
        <div className="min-w-0">
          {view === "semana" ? (
            <PlanningWeek
              cursor={cursor}
              tasksByDate={tasksByDate}
              onSelectTask={setSelectedTask}
              onSelectDay={openDay}
            />
          ) : isMobile ? (
            <PlanningMonthMobile
              cursor={cursor}
              tasksByDate={tasksByDate}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onSelectTask={setSelectedTask}
              onOpenDay={openDay}
            />
          ) : (
            <PlanningMonth
              cursor={cursor}
              tasksByDate={tasksByDate}
              selectedDay={selectedDay}
              onSelectDay={openDay}
              onSelectTask={setSelectedTask}
            />
          )}
        </div>

        {panelOpen && !isMobile && selectedDay && (
          <div className="kpi-card !p-0 overflow-hidden max-h-[70vh] sticky top-4">
            <PlanningDayPanel
              date={selectedDay}
              tasks={dayTasks}
              onClose={() => setPanelOpen(false)}
              onSelectTask={setSelectedTask}
              notionUrl={notionUrl}
            />
          </div>
        )}
      </div>

      {undated.length > 0 && (
        <Collapsible className="kpi-card overflow-hidden !p-0">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors group">
            <div className="flex items-center gap-2">
              <CalendarX className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-bold">Tareas sin fecha asignada ({undated.length})</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {undated.map((t) => (
                <TaskCard key={t.id} task={t} onClick={() => setSelectedTask(t)} showStatusLabel />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="p-0 h-[75vh]">
          {selectedDay && (
            <PlanningDayPanel
              date={selectedDay}
              tasks={dayTasks}
              onSelectTask={(t) => {
                setSheetOpen(false);
                setSelectedTask(t);
              }}
              notionUrl={notionUrl}
            />
          )}
        </SheetContent>
      </Sheet>

      <TaskDetailDialog task={selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)} />
    </div>
  );
}
