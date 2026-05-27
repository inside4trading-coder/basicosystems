import { useMemo } from "react";
import { Cake, Factory, Users2 } from "lucide-react";
import { parseLocalDate } from "@/lib/dateUtils";
import { EmployeeAvatar } from "@/components/crew/EmployeeAvatar";

export type BirthdayPerson = {
  id: string;
  first_name: string;
  last_name?: string | null;
  photo_url?: string | null;
  birth_date?: string | null;
  source: "crew" | "operario";
};

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function CombinedBirthdays({ people }: { people: BirthdayPerson[] }) {
  const { items, monthLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const list = people
      .filter((p) => p.birth_date)
      .map((p) => {
        const bd = parseLocalDate(p.birth_date as string);
        if (bd.getMonth() !== currentMonth) return null;
        const day = bd.getDate();
        const thisYearBday = new Date(currentYear, currentMonth, day);
        thisYearBday.setHours(0, 0, 0, 0);
        const daysDiff = Math.round((thisYearBday.getTime() - today.getTime()) / 86400000);
        return { p, day, daysDiff };
      })
      .filter(Boolean) as { p: BirthdayPerson; day: number; daysDiff: number }[];

    list.sort((a, b) => {
      const aFuture = a.daysDiff >= 0 ? 0 : 1;
      const bFuture = b.daysDiff >= 0 ? 0 : 1;
      if (aFuture !== bFuture) return aFuture - bFuture;
      return a.daysDiff - b.daysDiff;
    });

    return { items: list, monthLabel: MONTHS_ES[currentMonth] };
  }, [people]);

  return (
    <div className="kpi-card py-3 px-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <Cake className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Cumpleaños de {monthLabel}
          </span>
        </div>

        {items.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">Sin cumpleaños este mes</span>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {items.map(({ p, day, daysDiff }) => {
              const isToday = daysDiff === 0;
              const isPast = daysDiff < 0;
              const label = isToday
                ? "¡Hoy!"
                : isPast
                ? `Hace ${Math.abs(daysDiff)}d`
                : `En ${daysDiff}d`;
              const SourceIcon = p.source === "operario" ? Factory : Users2;
              const sourceTitle = p.source === "operario" ? "Operario" : "Crew";

              return (
                <div
                  key={`${p.source}-${p.id}`}
                  className={`inline-flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 text-xs ${
                    isToday
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : isPast
                      ? "bg-muted/60 opacity-70"
                      : "bg-muted"
                  }`}
                  title={`${p.first_name} ${p.last_name ?? ""} — ${sourceTitle} — día ${day}`}
                >
                  <EmployeeAvatar
                    photoUrl={p.photo_url ?? null}
                    firstName={p.first_name}
                    lastName={p.last_name ?? ""}
                    className="h-6 w-6 text-[10px]"
                  />
                  <span className="font-semibold">
                    {p.first_name}{p.last_name ? ` ${p.last_name[0]}.` : ""}
                  </span>
                  <SourceIcon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">· día {day}</span>
                  <span className={`font-bold ${isToday ? "text-primary" : ""}`}>· {label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
