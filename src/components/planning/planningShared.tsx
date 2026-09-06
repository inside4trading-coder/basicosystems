import type { NotionTask } from "@/hooks/usePlanningData";
import { deriveStatus, statusVisual } from "@/lib/planningStatus";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function AssigneeAvatars({
  assignees,
  max = 3,
  size = "sm",
  withNames = false,
}: {
  assignees: NotionTask["assignee"];
  max?: number;
  size?: "xs" | "sm" | "md";
  withNames?: boolean;
}) {
  if (!assignees || assignees.length === 0) return null;
  const dim = size === "xs" ? "w-4 h-4 text-[8px]" : size === "md" ? "w-7 h-7 text-[10px]" : "w-5 h-5 text-[9px]";
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex -space-x-1 flex-shrink-0">
        {shown.map((a, i) =>
          a.avatar_url ? (
            <img
              key={i}
              src={a.avatar_url}
              alt={a.name}
              title={a.name}
              loading="lazy"
              className={cn(dim, "rounded-full border border-card object-cover")}
            />
          ) : (
            <span
              key={i}
              title={a.name}
              className={cn(
                dim,
                "rounded-full bg-secondary text-secondary-foreground font-bold flex items-center justify-center border border-card",
              )}
            >
              {initials(a.name)}
            </span>
          ),
        )}
        {extra > 0 && (
          <span
            className={cn(dim, "rounded-full bg-muted text-muted-foreground font-bold flex items-center justify-center border border-card")}
          >
            +{extra}
          </span>
        )}
      </div>
      {withNames && (
        <span className="text-[11px] text-muted-foreground truncate">
          {assignees.map((a) => a.name).join(" · ")}
        </span>
      )}
    </div>
  );
}

export function StatusDot({ task, className }: { task: NotionTask; className?: string }) {
  const v = statusVisual(deriveStatus(task));
  return (
    <span
      className={cn("w-2 h-2 rounded-full flex-shrink-0", className)}
      style={{ backgroundColor: v.dot }}
      title={v.label}
    />
  );
}

/** Compact chip used inside month cells: status dot + neutral title. */
export function TaskChip({
  task,
  onClick,
  dim = false,
}: {
  task: NotionTask;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={task.name || "Sin título"}
      className={cn(
        "w-full flex items-center gap-1.5 rounded px-1 py-[3px] text-left text-[11px] font-medium text-foreground/90 hover:bg-muted transition-colors",
        dim && "opacity-60",
      )}
    >
      <StatusDot task={task} />
      <span className="truncate">{task.name || "Sin título"}</span>
    </button>
  );
}

/** Richer card used in week view, day panel and mobile. */
export function TaskCard({
  task,
  onClick,
  dim = false,
  showStatusLabel = false,
}: {
  task: NotionTask;
  onClick: () => void;
  dim?: boolean;
  showStatusLabel?: boolean;
}) {
  const v = statusVisual(deriveStatus(task));
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-md border border-border/60 bg-card px-2 py-1.5 hover:bg-muted/40 transition-colors",
        dim && "opacity-60",
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <StatusDot task={task} />
        <span className="text-[12px] font-semibold truncate text-foreground">{task.name || "Sin título"}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
        <span className="text-[10px] text-muted-foreground truncate">
          {task.database_name}
          {task.area ? ` · ${task.area}` : ""}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {showStatusLabel && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5"
              style={{ backgroundColor: v.bg, color: v.fg }}
            >
              {v.label}
            </span>
          )}
          <AssigneeAvatars assignees={task.assignee} size="xs" max={2} />
        </div>
      </div>
    </button>
  );
}

export function StatusLegend() {
  const order = ["done", "in_progress", "pending", "overdue", "delegated"] as const;
  return (
    <div className="flex items-center gap-3 flex-wrap px-1">
      {order.map((s) => {
        const v = statusVisual(s);
        return (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.dot }} />
            <span className="text-[11px] font-semibold text-muted-foreground">{v.label}</span>
          </div>
        );
      })}
    </div>
  );
}
