// Helpers para manejar fechas como "date-only" (YYYY-MM-DD) sin desfases por timezone.

export function parseLocalDate(str: string): Date {
  // Acepta "YYYY-MM-DD" (ignora cualquier sufijo de tiempo).
  const [y, m, d] = str.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
