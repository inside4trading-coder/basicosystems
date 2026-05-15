import type { ClockEvent, ClockSettings, ClockStatus, WeeklySchedule } from "@/types/sublime";

/** Returns true if the employee meets all eligibility requirements to clock in. */
export function canEmployeeClockIn(
  employeeStatus: string | undefined,
  s: ClockSettings | null,
): boolean {
  if (!s) return false;
  if (employeeStatus !== "active") return false;
  if (!s.enabled) return false;
  if (!s.store_id) return false;
  if (!s.entry_time || !s.exit_time) return false;
  if (s.blocked) return false;
  const ws = s.weekly_schedule;
  const anyDay = ws && (ws.mon || ws.tue || ws.wed || ws.thu || ws.fri || ws.sat || ws.sun);
  if (!anyDay) return false;
  return true;
}

/** Returns the events that happened on the same calendar day as `now` (local time). */
export function eventsOnDay(events: ClockEvent[], now: Date): ClockEvent[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  return events.filter((e) => {
    const ev = new Date(e.event_at);
    return ev.getFullYear() === y && ev.getMonth() === m && ev.getDate() === d;
  });
}

/** Derives the current status from settings + chronologically-sorted (asc) day events. */
export function computeCurrentStatus(
  settings: ClockSettings | null,
  events: ClockEvent[],
  now: Date = new Date(),
): ClockStatus {
  if (settings?.blocked) return "fichaje_bloqueado";

  const today = eventsOnDay(events, now).slice().sort(
    (a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime(),
  );

  if (today.length === 0) return "fuera_de_jornada";

  // Validate ordering: must start with entrada; descanso pairs balanced; salida last.
  let inShift = false;
  let onBreak = false;
  let closed = false;
  for (const e of today) {
    if (closed) return "pendiente_revision";
    switch (e.event_type) {
      case "entrada":
        if (inShift) return "pendiente_revision";
        inShift = true;
        break;
      case "inicio_descanso":
        if (!inShift || onBreak) return "pendiente_revision";
        onBreak = true;
        break;
      case "fin_descanso":
        if (!onBreak) return "pendiente_revision";
        onBreak = false;
        break;
      case "salida":
        if (!inShift || onBreak) return "pendiente_revision";
        closed = true;
        inShift = false;
        break;
    }
  }

  if (closed) return "jornada_completada";
  if (onBreak) return "en_descanso";
  if (inShift) return "trabajando";
  return "fuera_de_jornada";
}

/** Day-of-week key used in WeeklySchedule. JS Date.getDay() → 0=Sun..6=Sat. */
export function weekdayKey(date: Date): keyof WeeklySchedule {
  const map: Array<keyof WeeklySchedule> = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[date.getDay()];
}

/** Generate a 4-digit numeric PIN as a string. */
export function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/** Hash a PIN with SHA-256 (hex). Suitable for non-secret short codes; we never log raw PINs. */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
