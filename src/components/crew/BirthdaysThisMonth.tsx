import { useMemo } from "react";
import { Cake } from "lucide-react";
import { parseLocalDate } from "@/lib/dateUtils";
import { EmployeeAvatar } from "@/components/crew/EmployeeAvatar";
import type { Employee } from "@/types/crew";

interface Props {
  employees: Employee[];
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function BirthdaysThisMonth({ employees }: Props) {
  const { items, monthLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const list = employees
      .filter((e) => e.status === "active" && e.birth_date)
      .map((e) => {
        const bd = parseLocalDate(e.birth_date as string);
        if (bd.getMonth() !== currentMonth) return null;
        const day = bd.getDate();
        const thisYearBday = new Date(currentYear, currentMonth, day);
        thisYearBday.setHours(0, 0, 0, 0);
        const diffMs = thisYearBday.getTime() - today.getTime();
        const daysDiff = Math.round(diffMs / 86400000);
        return { emp: e, day, daysDiff };
      })
      .filter(Boolean) as { emp: Employee; day: number; daysDiff: number }[];

    list.sort((a, b) => {
      // upcoming first (>=0), then past (<0); within each group, ascending diff
      const aFuture = a.daysDiff >= 0 ? 0 : 1;
      const bFuture = b.daysDiff >= 0 ? 0 : 1;
      if (aFuture !== bFuture) return aFuture - bFuture;
      return a.daysDiff - b.daysDiff;
    });

    return { items: list, monthLabel: MONTHS_ES[currentMonth] };
  }, [employees]);

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
            {items.map(({ emp, day, daysDiff }) => {
              const isToday = daysDiff === 0;
              const isPast = daysDiff < 0;
              const label = isToday
                ? "¡Hoy!"
                : isPast
                ? `Hace ${Math.abs(daysDiff)}d`
                : `En ${daysDiff}d`;

              return (
                <div
                  key={emp.id}
                  className={`inline-flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 text-xs ${
                    isToday
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : isPast
                      ? "bg-muted/60 opacity-70"
                      : "bg-muted"
                  }`}
                  title={`${emp.first_name} ${emp.last_name} — día ${day}`}
                >
                  <EmployeeAvatar
                    photoUrl={emp.photo_url}
                    firstName={emp.first_name}
                    lastName={emp.last_name}
                    className="h-6 w-6 text-[10px]"
                  />
                  <span className="font-semibold">
                    {emp.first_name} {emp.last_name[0]}.
                  </span>
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
