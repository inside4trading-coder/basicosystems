import { X, ExternalLink } from "lucide-react";
import type { NotionTask } from "@/hooks/usePlanningData";
import { longDayLabel } from "@/lib/planningDates";
import { TaskCard } from "./planningShared";

export default function PlanningDayPanel({
  date,
  tasks,
  onClose,
  onSelectTask,
  notionUrl,
}: {
  date: Date;
  tasks: NotionTask[];
  onClose?: () => void;
  onSelectTask: (t: NotionTask) => void;
  notionUrl?: string;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 p-4 border-b border-border">
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-bold tracking-wider text-primary">Detalle del día</p>
          <h3 className="text-sm font-black capitalize leading-tight">{longDayLabel(date)}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {tasks.length === 0 ? "Sin tareas" : `${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}`}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar detalle del día"
            className="text-muted-foreground hover:text-foreground p-1 -m-1"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No hay tareas para este día.</p>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="space-y-1">
              <TaskCard task={t} onClick={() => onSelectTask(t)} showStatusLabel />
              {t.assignee?.length === 0 && (
                <p className="text-[10px] text-muted-foreground pl-2">Sin personas etiquetadas</p>
              )}
            </div>
          ))
        )}
      </div>

      {notionUrl && (
        <div className="p-3 border-t border-border">
          <a
            href={notionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Crear tarea en Notion
          </a>
        </div>
      )}
    </div>
  );
}
