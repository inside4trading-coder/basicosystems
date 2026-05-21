export type PeriodKey = "this_month" | "last_month" | "last_3_months" | "this_year" | "all";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes anterior" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "this_year", label: "Este año" },
  { value: "all", label: "Todo (desde 2026)" },
];

export const CUTOFF = "2026-01-01";

export function periodBounds(p: PeriodKey): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayEnd = fmt(now);
  switch (p) {
    case "this_month":
      return { from: `${y}-${pad(m + 1)}-01`, to: todayEnd };
    case "last_month": {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { from: fmt(start), to: fmt(end) };
    }
    case "last_3_months": {
      const start = new Date(y, m - 2, 1);
      return { from: fmt(start), to: todayEnd };
    }
    case "this_year":
      return { from: `${y}-01-01`, to: todayEnd };
    case "all":
      return { from: CUTOFF, to: todayEnd };
  }
}
