// Semana operativa de nómina: viernes 00:00 → viernes siguiente 00:00 (exclusivo).
// Visualmente: viernes → jueves. Pago: viernes siguiente.

export type PayrollWeek = {
  /** Viernes inclusivo (YYYY-MM-DD) */
  start: string;
  /** Jueves inclusivo (YYYY-MM-DD) — se guarda así en BD */
  end: string;
  /** Viernes siguiente, exclusivo (YYYY-MM-DD) — solo para filtrar trabajos */
  endExclusive: string;
  /** Fecha de pago: viernes siguiente */
  payment: string;
};

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

/** Semana operativa que contiene `ref`, desplazada `offsetWeeks` semanas. */
export function getPayrollWeek(offsetWeeks = 0, ref: Date = new Date()): PayrollWeek {
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Dom..6=Sáb, viernes=5
  const daysSinceFri = (dow - 5 + 7) % 7;
  const start = addDays(today, -daysSinceFri + offsetWeeks * 7);
  const end = addDays(start, 6); // jueves
  const endExclusive = addDays(start, 7); // viernes siguiente
  return {
    start: isoDate(start),
    end: isoDate(end),
    endExclusive: isoDate(endExclusive),
    payment: isoDate(endExclusive),
  };
}

export function getCurrentPayrollWeek(): PayrollWeek {
  return getPayrollWeek(0);
}

/** true si [aStart,aEnd] y [bStart,bEnd] (fin inclusivo) se cruzan. */
export function periodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
