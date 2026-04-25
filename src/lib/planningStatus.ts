import type { NotionTask } from "@/hooks/usePlanningData";

export type DerivedStatus =
  | "done"
  | "in_progress"
  | "overdue"
  | "delegated"
  | "pending"
  | "no_date";

export interface StatusVisual {
  /** background tinted */
  bg: string;
  /** strong color (text + dot) */
  fg: string;
  /** plain solid color hex/hsl for dots */
  dot: string;
  label: string;
}

const norm = (s: string | undefined | null) =>
  (s || "").toLowerCase().trim();

/** Detect status family from a Notion status name (ES + EN). */
function classifyStatusName(name: string | undefined | null):
  | "done"
  | "in_progress"
  | "delegated"
  | "pending"
  | "unknown" {
  const n = norm(name);
  if (!n) return "unknown";

  // Done / Completed / Hecho / Ejecutada / Listo / Finalizado / Cerrado
  if (
    /(hecho|hecha|ejecutad|listo|completad|finalizad|cerrad|terminad|done|complete|closed|finished|resolved)/.test(n)
  ) return "done";

  // In progress / En proceso / En curso / Haciendo / Doing
  if (
    /(en proceso|en progreso|en curso|haciendo|en marcha|en revisi|in progress|doing|working|review)/.test(n)
  ) return "in_progress";

  // Delegated / Delegada / Asignada externa / Esperando
  if (
    /(delegad|asignad|esperando|waiting|blocked|bloqueada|on hold|pendiente externo)/.test(n)
  ) return "delegated";

  // Pending / Pendiente / To do / Por hacer / Backlog / Nuevo
  if (
    /(pendiente|por hacer|to do|todo|backlog|nuevo|nueva|abierta|open|not started)/.test(n)
  ) return "pending";

  return "unknown";
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Derive a unified status from a Notion task using its status name + dates. */
export function deriveStatus(task: NotionTask, now: Date = new Date()): DerivedStatus {
  const fam = classifyStatusName(task.status?.name);

  if (fam === "done") return "done";
  if (fam === "in_progress") return "in_progress";

  const start = task.date?.start ? new Date(task.date.start) : null;
  const end = task.date?.end ? new Date(task.date.end) : start;
  const today = startOfDay(now);

  // Delegated: si pasó la fecha sin completar -> overdue, si no -> delegated
  if (fam === "delegated") {
    if (end && startOfDay(end) < today) return "overdue";
    return "delegated";
  }

  // Pending or unknown: depende de la fecha
  if (!start) return fam === "pending" ? "pending" : "no_date";
  if (startOfDay(end ?? start) < today) return "overdue";
  return "pending";
}

/** Visual tokens (HSL) per derived status. Themed via design tokens where possible. */
export function statusVisual(status: DerivedStatus): StatusVisual {
  switch (status) {
    case "done":
      return {
        bg: "hsl(142,71%,45% / 0.15)",
        fg: "hsl(142,71%,35%)",
        dot: "hsl(142,71%,45%)",
        label: "Hecho",
      };
    case "in_progress":
      return {
        bg: "hsl(210,90%,55% / 0.15)",
        fg: "hsl(210,90%,45%)",
        dot: "hsl(210,90%,55%)",
        label: "En proceso",
      };
    case "overdue":
      return {
        bg: "hsl(0,84%,55% / 0.15)",
        fg: "hsl(0,84%,45%)",
        dot: "hsl(0,84%,55%)",
        label: "Vencida",
      };
    case "delegated":
      return {
        bg: "hsl(280,60%,55% / 0.15)",
        fg: "hsl(280,60%,45%)",
        dot: "hsl(280,60%,55%)",
        label: "Delegada",
      };
    case "pending":
      return {
        bg: "hsl(38,92%,50% / 0.15)",
        fg: "hsl(38,92%,40%)",
        dot: "hsl(38,92%,50%)",
        label: "Pendiente",
      };
    case "no_date":
    default:
      return {
        bg: "hsl(220,9%,55% / 0.15)",
        fg: "hsl(220,9%,40%)",
        dot: "hsl(220,9%,55%)",
        label: "Sin fecha",
      };
  }
}
