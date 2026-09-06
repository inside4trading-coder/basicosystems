import type { NotionTask } from "@/hooks/usePlanningData";
import { formatLocalDate, parseLocalDate } from "@/lib/dateUtils";

export const DAY_LABELS_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
export const DAY_LABELS_LONG = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Monday-based start of week. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getCalendarWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  const weeks: Date[][] = [];
  const d = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
    if (d.getMonth() !== month && w >= 3) break;
  }
  return weeks;
}

export function groupTasksByDate(tasks: NotionTask[]): Record<string, NotionTask[]> {
  const map: Record<string, NotionTask[]> = {};
  for (const t of tasks) {
    if (!t.date?.start) continue;
    (map[t.date.start.slice(0, 10)] ||= []).push(t);
  }
  return map;
}

export function dateKey(d: Date) {
  return formatLocalDate(d);
}

export function taskStartDate(t: NotionTask): Date | null {
  return t.date?.start ? parseLocalDate(t.date.start) : null;
}

export function monthLabel(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

export function longDayLabel(d: Date) {
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function weekRangeLabel(anchor: Date) {
  const days = weekDays(anchor);
  const a = days[0];
  const b = days[6];
  const monthA = a.toLocaleDateString("es-ES", { month: "long" });
  const monthB = b.toLocaleDateString("es-ES", { month: "long" });
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${b.getDate()} de ${monthB} ${b.getFullYear()}`;
  }
  return `${a.getDate()} ${monthA} – ${b.getDate()} ${monthB} ${b.getFullYear()}`;
}
