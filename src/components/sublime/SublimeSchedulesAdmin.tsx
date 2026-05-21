import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { WeeklySchedule } from "@/types/sublime";
import { CalendarDays, Loader2, Search, Store as StoreIcon } from "lucide-react";

type Row = {
  employeeId: string;
  name: string;
  enabled: boolean;
  blocked: boolean;
  storeName: string | null;
  entry: string | null;
  exit: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  breakMinutes: number;
  tolerance: number;
  schedule: WeeklySchedule;
  hybridMode: boolean;
  weeklyHoursTarget: number | null;
};

const DAYS: Array<{ key: keyof WeeklySchedule; label: string }> = [
  { key: "mon", label: "L" }, { key: "tue", label: "M" }, { key: "wed", label: "X" },
  { key: "thu", label: "J" }, { key: "fri", label: "V" }, { key: "sat", label: "S" }, { key: "sun", label: "D" },
];

function fmt(t: string | null) { return t ? t.slice(0, 5) : "—"; }

export default function SublimeSchedulesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const [settingsRes, employeesRes, storesRes] = await Promise.all([
        supabase.from("sublime_clock_settings").select("*"),
        supabase.from("employees").select("id, first_name, last_name, status"),
        supabase.from("sublime_stores").select("id, name"),
      ]);
      if (settingsRes.error) { setError(settingsRes.error.message); setLoading(false); return; }
      const empById = new Map<string, any>();
      (employeesRes.data ?? []).forEach((e: any) => empById.set(e.id, e));
      const storeById = new Map<string, any>();
      (storesRes.data ?? []).forEach((s: any) => storeById.set(s.id, s));

      const out: Row[] = (settingsRes.data ?? []).map((s: any) => {
        const emp = empById.get(s.employee_id);
        const name = emp ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() : "Empleado";
        const store = s.store_id ? storeById.get(s.store_id) : null;
        return {
          employeeId: s.employee_id,
          name: name || "Empleado",
          enabled: !!s.enabled,
          blocked: !!s.blocked,
          storeName: store?.name ?? null,
          entry: s.entry_time,
          exit: s.exit_time,
          breakStart: s.break_start,
          breakEnd: s.break_end,
          breakMinutes: s.break_minutes ?? 0,
          tolerance: s.late_tolerance_minutes ?? 0,
          schedule: s.weekly_schedule ?? { mon:false,tue:false,wed:false,thu:false,fri:false,sat:false,sun:false },
        };
      });
      // Ocultar empleados sin ningún día activo y sin horas configuradas
      const visible = out.filter((r) => {
        const anyDay = Object.values(r.schedule || {}).some(Boolean);
        const anyTime = !!(r.entry || r.exit || r.breakStart || r.breakEnd);
        return anyDay || anyTime;
      });
      visible.sort((a, b) => a.name.localeCompare(b.name, "es"));
      setRows(visible);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const t = q.toLowerCase();
    return rows.filter((r) =>
      r.name.toLowerCase().includes(t) || (r.storeName ?? "").toLowerCase().includes(t),
    );
  }, [rows, q]);

  return (
    <Card className="rounded-2xl border-border/60 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border/60">
        <div>
          <p className="text-sm font-semibold text-foreground">Horarios del equipo</p>
          <p className="text-xs text-muted-foreground">{filtered.length} empleado(s) configurados</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar empleado o tienda"
            className="rounded-xl pl-9 h-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando horarios…
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-destructive">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <CalendarDays className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Sin horarios configurados</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Define los horarios desde la ficha de cada empleado en Crew → pestaña Fichaje.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="uppercase tracking-wider text-xs font-semibold">Empleado</TableHead>
              <TableHead className="uppercase tracking-wider text-xs font-semibold">Tienda</TableHead>
              <TableHead className="uppercase tracking-wider text-xs font-semibold">Días</TableHead>
              <TableHead className="uppercase tracking-wider text-xs font-semibold">Entrada</TableHead>
              <TableHead className="uppercase tracking-wider text-xs font-semibold">Salida</TableHead>
              <TableHead className="uppercase tracking-wider text-xs font-semibold">Descanso</TableHead>
              <TableHead className="uppercase tracking-wider text-xs font-semibold">Toler.</TableHead>
              <TableHead className="uppercase tracking-wider text-xs font-semibold">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.employeeId}>
                <TableCell className="font-semibold text-foreground">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.storeName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <StoreIcon className="h-3 w-3" /> {r.storeName}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {DAYS.map(({ key, label }) => {
                      const on = r.schedule[key];
                      return (
                        <span
                          key={key}
                          className={`h-6 w-6 rounded-md text-[10px] font-bold flex items-center justify-center ${
                            on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{fmt(r.entry)}</TableCell>
                <TableCell className="tabular-nums">{fmt(r.exit)}</TableCell>
                <TableCell className="tabular-nums text-sm">
                  {r.breakStart || r.breakEnd
                    ? `${fmt(r.breakStart)} – ${fmt(r.breakEnd)}`
                    : `${r.breakMinutes} min`}
                </TableCell>
                <TableCell className="tabular-nums">{r.tolerance} min</TableCell>
                <TableCell>
                  {r.blocked ? (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Bloqueado</Badge>
                  ) : r.enabled ? (
                    <Badge variant="outline" className="bg-[hsl(142_72%_29%)]/10 text-[hsl(142_72%_29%)] border-[hsl(142_72%_29%)]/30">Activo</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">Inactivo</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
