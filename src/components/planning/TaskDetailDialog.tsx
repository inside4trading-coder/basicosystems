import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { NotionTask } from "@/hooks/usePlanningData";
import { deriveStatus, statusVisual } from "@/lib/planningStatus";
import { formatDMY } from "@/lib/dateUtils";
import { AssigneeAvatars } from "./planningShared";

export default function TaskDetailDialog({
  task,
  onOpenChange,
}: {
  task: NotionTask | null;
  onOpenChange: (open: boolean) => void;
}) {
  const v = task ? statusVisual(deriveStatus(task)) : null;

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {task && v && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base leading-snug pr-6">{task.name || "Sin título"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
                  style={{ backgroundColor: v.bg, color: v.fg }}
                >
                  {task.status?.name || v.label}
                </span>
                {task.priority?.name && (
                  <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                    {task.priority.name}
                  </span>
                )}
              </div>

              <Row label="Fuente" value={task.database_name} />
              <Row
                label="Fecha"
                value={
                  task.date?.start
                    ? task.date.end && task.date.end !== task.date.start
                      ? `${formatDMY(task.date.start)} → ${formatDMY(task.date.end)}`
                      : formatDMY(task.date.start)
                    : "Sin fecha asignada"
                }
              />
              {task.area && <Row label="Área" value={task.area} />}

              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5">
                  Personas
                </div>
                {task.assignee?.length ? (
                  <AssigneeAvatars assignees={task.assignee} size="md" max={6} withNames />
                ) : (
                  <span className="text-xs text-muted-foreground">Sin personas etiquetadas</span>
                )}
              </div>

              <a
                href={task.notion_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir en Notion
              </a>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground pt-0.5">{label}</span>
      <span className="text-xs font-semibold text-right">{value}</span>
    </div>
  );
}
