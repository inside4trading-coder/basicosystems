import type { NotionTask } from "@/hooks/usePlanningData";
import { cn } from "@/lib/utils";
import { DAY_LABELS_LONG, dateKey, getCalendarWeeks, sameDay, startOfDay } from "@/lib/planningDates";
import { TaskChip } from "./planningShared";

const MAX_CHIPS = 6;

export default function PlanningMonth({
  cursor,
  tasksByDate,
  selectedDay,
  onSelectDay,
  onSelectTask,
}: {
  cursor: Date;
  tasksByDate: Record<string, NotionTask[]>;
  selectedDay: Date | null;
  onSelectDay: (d: Date) => void;
  onSelectTask: (t: NotionTask) => void;
}) {
  const weeks = getCalendarWeeks(cursor.getFullYear(), cursor.getMonth());
  const today = startOfDay(new Date());
  let dayIndex = 0;

  return (
    <div className="kpi-card !p-0 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {DAY_LABELS_LONG.map((d) => (
          <div key={d} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center py-2">
            {d}
          </div>
        ))}
      </div>

      <div>
        {weeks.map((week, wi) => {
          const maxCount = Math.max(...week.map((d) => (tasksByDate[dateKey(d)] ?? []).length), 0);
          const visible = Math.min(maxCount, MAX_CHIPS);
          const minHeight = 46 + visible * 24;

          return (
            <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0" style={{ minHeight }}>
              {week.map((day) => {
                const key = dateKey(day);
                const items = tasksByDate[key] ?? [];
                const isToday = sameDay(day, today);
                const isPast = startOfDay(day) < today;
                const outOfMonth = day.getMonth() !== cursor.getMonth();
                const isSelected = selectedDay ? sameDay(day, selectedDay) : false;
                const shown = items.slice(0, MAX_CHIPS);
                const extra = items.length - shown.length;
                const alt = dayIndex++ % 2 === 1;

                return (
                  <div
                    key={key}
                    onClick={() => onSelectDay(day)}
                    className={cn(
                      "border-r border-border last:border-r-0 p-1 flex flex-col gap-0.5 cursor-pointer transition-colors",
                      isPast ? "bg-muted/40" : alt ? "bg-primary/[0.03]" : "bg-transparent",
                      isToday && "bg-primary/10",
                      outOfMonth && "opacity-45",
                      isSelected && "ring-1 ring-inset ring-primary",
                      "hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "self-start text-[11px] font-bold rounded px-1.5 py-0.5",
                        isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {day.getDate()}
                    </span>

                    <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {shown.map((t) => (
                        <TaskChip key={t.id} task={t} dim={isPast} onClick={() => onSelectTask(t)} />
                      ))}
                      {extra > 0 && (
                        <button
                          type="button"
                          onClick={() => onSelectDay(day)}
                          className="text-[10px] font-bold text-muted-foreground hover:text-foreground text-left px-1"
                        >
                          +{extra} más
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
