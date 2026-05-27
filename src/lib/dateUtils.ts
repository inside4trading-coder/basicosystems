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

/**
 * Formatea fecha en DD/MM/YYYY. Acepta Date, string ISO/date-only, número o null/undefined.
 * Devuelve "—" cuando el valor es nulo o inválido.
 */
export function formatDMY(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "string") {
    // Si parece "YYYY-MM-DD" puro, parsear como local para evitar shift UTC.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      d = parseLocalDate(value);
    } else {
      d = new Date(value);
    }
  } else {
    d = new Date(value);
  }
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Igual que formatDMY pero corto: DD/MM (sin año). Útil para tablas densas. */
export function formatDM(value: Date | string | number | null | undefined): string {
  const full = formatDMY(value);
  if (full === "—") return "—";
  return full.slice(0, 5);
}
