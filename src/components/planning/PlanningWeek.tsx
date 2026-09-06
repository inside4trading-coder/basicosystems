import type { NotionTask } from "@/hooks/usePlanningData";
import { cn } from "@/lib/utils";
import { DAY_LABELS_LONG, dateKey, sameDay, startOfDay, weekDays } from "@/lib/planningDates";
import { TaskCard } from "./planningShared";
import { useIsMobile } from "@/hooks/use-mobile";

export default function PlanningWeek({
  cursor,
  tasksByDate,
  onSelectTask,
  onSelectDay,
}: {
  cursor: Date;
  tasksByDate: Record<string, NotionTask[]>;
  onSelectTask: (t: NotionTask) => void;
  onSelectDay: (d: Date) => void;
}) {
  const isMobile = useIsMobile();
  const days = weekDays(cursor);
  const today = startOfDay(new Date());

  if (isMobile) {
    return (
      <div className="space-y-2">
        {days.map((day, i) => {
          const items = tasksByDate[dateKey(day)] ?? [];
          const isToday = sameDay(day, today);
          const isPast = startOfDay(day) < today;
          return (
            <div key={dateKey(day)} className={cn("kpi-card !p-0 overflow-hidden", isToday && "ring-1 ring-primary")}>
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-left",
                  isToday ? "bg-primary/10" : isPast ? "bg-muted/40" : "bg-muted/20",
                )}
              >
                <span className="text-xs font-black uppercase tracking-wide">
                  {DAY_LABELS_LONG[i]} {day.getDate()}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground">
                  {items.length} {items.length === 1 ? "tarea" : "tareas"}
                </span>
              </button>
              {items.length > 0 && (
                <div className="p-2 space-y-1.5">
                  {items.map((t) => (
                    <TaskCard key={t.id} task={t} onClick={() => onSelectTask(t)} dim={isPast} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="kpi-card !p-0 overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const items = tasksByDate[dateKey(day)] ?? [];
          const isToday = sameDay(day, today);
          const isPast = startOfDay(day) < today;
          return (
            <div key={dateKey(day)} className="border-r border-border last:border-r-0 flex flex-col">
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  "px-2 py-2 border-b border-border text-left transition-colors hover:bg-muted/50",
                  isToday ? "bg-primary/10" : isPast ? "bg-muted/40" : "bg-muted/20",
                )}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {DAY_LABELS_LONG[i]}
                </div>
                <div
                  className={cn(
                    "text-base font-black leading-none mt-0.5",
                    isToday ? "text-primary" : "text-foreground",
                  )}
                >
                  {day.getDate()}
                </div>
              </button>
              <div className={cn("flex-1 p-1.5 space-y-1.5 min-h-[220px]", isPast && "bg-muted/20")}>
                {items.map((t) => (
                  <TaskCard key={t.id} task={t} onClick={() => onSelectTask(t)} dim={isPast} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
