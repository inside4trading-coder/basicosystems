import { ChevronRight } from "lucide-react";
import type { NotionTask } from "@/hooks/usePlanningData";
import { cn } from "@/lib/utils";
import { DAY_LABELS_SHORT, dateKey, getCalendarWeeks, longDayLabel, sameDay, startOfDay } from "@/lib/planningDates";
import { deriveStatus, statusVisual } from "@/lib/planningStatus";
import { TaskCard } from "./planningShared";

export default function PlanningMonthMobile({
  cursor,
  tasksByDate,
  selectedDay,
  onSelectDay,
  onSelectTask,
  onOpenDay,
}: {
  cursor: Date;
  tasksByDate: Record<string, NotionTask[]>;
  selectedDay: Date | null;
  onSelectDay: (d: Date) => void;
  onSelectTask: (t: NotionTask) => void;
  onOpenDay: (d: Date) => void;
}) {
  const weeks = getCalendarWeeks(cursor.getFullYear(), cursor.getMonth());
  const today = startOfDay(new Date());
  const selectedTasks = selectedDay ? tasksByDate[dateKey(selectedDay)] ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="kpi-card !p-0 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {DAY_LABELS_SHORT.map((d, i) => (
            <div key={i} className="text-[10px] font-bold uppercase text-muted-foreground text-center py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day) => {
                const items = tasksByDate[dateKey(day)] ?? [];
                const isToday = sameDay(day, today);
                const isPast = startOfDay(day) < today;
                const outOfMonth = day.getMonth() !== cursor.getMonth();
                const isSelected = selectedDay ? sameDay(day, selectedDay) : false;

                return (
                  <button
                    key={dateKey(day)}
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className={cn(
                      "h-14 flex flex-col items-center justify-center gap-1 border-b border-r border-border/60 transition-colors",
                      isPast && "bg-muted/40",
                      isToday && "bg-primary/10",
                      outOfMonth && "opacity-40",
                      isSelected && "ring-1 ring-inset ring-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[12px] font-bold rounded-full w-6 h-6 flex items-center justify-center",
                        isToday ? "bg-primary text-primary-foreground" : "text-foreground/80",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <span className="flex items-center gap-0.5 h-1.5">
                      {items.slice(0, 4).map((t) => (
                        <span
                          key={t.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: statusVisual(deriveStatus(t)).dot }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selectedDay && (
        <div className="kpi-card p-3 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-black capitalize truncate">{longDayLabel(selectedDay)}</p>
              <p className="text-[10px] text-muted-foreground">
                {selectedTasks.length === 0
                  ? "Sin tareas"
                  : `${selectedTasks.length} ${selectedTasks.length === 1 ? "tarea" : "tareas"}`}
              </p>
            </div>
            {selectedTasks.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenDay(selectedDay)}
                className="inline-flex items-center gap-0.5 text-[11px] font-bold text-primary flex-shrink-0"
              >
                Ver todas <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {selectedTasks.slice(0, 3).map((t) => (
              <TaskCard key={t.id} task={t} onClick={() => onSelectTask(t)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
