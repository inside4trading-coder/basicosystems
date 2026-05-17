import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminMetricCard } from "@/components/sublime/AdminMetricCard";
import SublimeStoresAdmin from "@/components/sublime/SublimeStoresAdmin";
import SublimePendingReviews from "@/components/sublime/SublimePendingReviews";
import SublimeSchedulesAdmin from "@/components/sublime/SublimeSchedulesAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  ExternalLink,
  Store,
  Clock,
  CalendarDays,
  AlertCircle,
  BarChart3,
  Timer,
  CheckCircle2,
  UserX,
  Hourglass,
  RefreshCw,
  Loader2,
} from "lucide-react";

type ClockEvent = {
  id: string;
  employee_id: string;
  event_type: string;
  event_at: string;
  clock_state: string;
  location_state: string;
  distance_meters: number | null;
  allowed_radius_meters: number | null;
};

type AttendanceRow = {
  key: string;
  employeeId: string;
  employeeName: string;
  dayKey: string;
  entryAt: string | null;
  exitAt: string | null;
  pending: boolean;
  outOfRange: boolean;
  lastEventAt: string;
  lastDistance: number | null;
  radius: number | null;
};

type RangeKey = "today" | "yesterday" | "week" | "month" | "lastMonth" | "3m" | "6m" | "year";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Mes actual" },
  { value: "lastMonth", label: "Mes pasado" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "year", label: "Último año" },
];

function computeRange(range: RangeKey): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  switch (range) {
    case "today": return { start, end };
    case "yesterday": {
      const s = new Date(start); s.setDate(s.getDate() - 1);
      return { start: s, end: start };
    }
    case "week": {
      const s = new Date(start);
      const dow = (s.getDay() + 6) % 7;
      s.setDate(s.getDate() - dow);
      return { start: s, end };
    }
    case "month":
      return { start: new Date(start.getFullYear(), start.getMonth(), 1), end };
    case "lastMonth":
      return {
        start: new Date(start.getFullYear(), start.getMonth() - 1, 1),
        end: new Date(start.getFullYear(), start.getMonth(), 1),
      };
    case "3m": {
      const s = new Date(start); s.setMonth(s.getMonth() - 3);
      return { start: s, end };
    }
    case "6m": {
      const s = new Date(start); s.setMonth(s.getMonth() - 6);
      return { start: s, end };
    }
    case "year": {
      const s = new Date(start); s.setFullYear(s.getFullYear() - 1);
      return { start: s, end };
    }
  }
}

function dayKeyOf(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Clock;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

type EmployeeSettings = {
  entry_time: string | null;
  exit_time: string | null;
  break_minutes: number;
};

export default function SublimeAdminFichaje() {
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});
  const [employeeSettings, setEmployeeSettings] = useState<Record<string, EmployeeSettings>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("today");

  const loadAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    setAttendanceError(null);

    const { start, end } = computeRange(range);

    const { data, error } = await supabase
      .from("sublime_clock_events")
      .select("id, employee_id, event_type, event_at, clock_state, location_state, distance_meters, allowed_radius_meters")
      .gte("event_at", start.toISOString())
      .lt("event_at", end.toISOString())
      .order("event_at", { ascending: true });

    if (error) {
      setAttendanceError(error.message);
      setEvents([]);
      setLoadingAttendance(false);
      return;
    }

    const list = (data ?? []) as ClockEvent[];
    setEvents(list);

    const ids = Array.from(new Set(list.map((event) => event.employee_id)));
    if (ids.length) {
      const [{ data: employees }, { data: settings }] = await Promise.all([
        supabase.from("employees").select("id, first_name, last_name").in("id", ids),
        supabase.from("sublime_clock_settings").select("employee_id, entry_time, exit_time, break_minutes").in("employee_id", ids),
      ]);

      const names: Record<string, string> = {};
      (employees ?? []).forEach((employee: any) => {
        names[employee.id] = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
      });
      setEmployeeNames(names);

      const cfg: Record<string, EmployeeSettings> = {};
      (settings ?? []).forEach((s: any) => {
        cfg[s.employee_id] = {
          entry_time: s.entry_time,
          exit_time: s.exit_time,
          break_minutes: s.break_minutes ?? 0,
        };
      });
      setEmployeeSettings(cfg);
    } else {
      setEmployeeNames({});
      setEmployeeSettings({});
    }

    setLoadingAttendance(false);
  }, [range]);

  useEffect(() => {
    loadAttendance();
    const interval = window.setInterval(loadAttendance, 10_000);
    const channel = supabase
      .channel("sublime-admin-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "sublime_clock_events" }, loadAttendance)
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadAttendance]);

  const attendanceRows = useMemo<AttendanceRow[]>(() => {
    // Group events per employee+day, then split into separate shifts so that
    // multiple entradas en el mismo día aparezcan como filas independientes.
    const byEmpDay = new Map<string, ClockEvent[]>();
    events.forEach((event) => {
      const day = dayKeyOf(event.event_at);
      const k = `${event.employee_id}|${day}`;
      const arr = byEmpDay.get(k) ?? [];
      arr.push(event);
      byEmpDay.set(k, arr);
    });

    const rows: AttendanceRow[] = [];
    byEmpDay.forEach((evs, k) => {
      const [employeeId, day] = k.split("|");
      const name = employeeNames[employeeId] ?? "Empleado";
      const sorted = [...evs].sort(
        (a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime(),
      );

      let shiftIdx = 0;
      let current: AttendanceRow | null = null;
      const pushCurrent = () => {
        if (current) rows.push(current);
        current = null;
      };

      sorted.forEach((event) => {
        if (event.event_type === "entrada") {
          pushCurrent();
          shiftIdx += 1;
          current = {
            key: `${employeeId}_${day}_${shiftIdx}`,
            employeeId,
            employeeName: name,
            dayKey: day,
            entryAt: event.event_at,
            exitAt: null,
            pending: event.clock_state === "pendiente_revision",
            outOfRange: event.location_state === "fuera_del_radio",
            lastEventAt: event.event_at,
            lastDistance: event.distance_meters,
            radius: event.allowed_radius_meters,
          };
          return;
        }
        if (!current) {
          shiftIdx += 1;
          current = {
            key: `${employeeId}_${day}_${shiftIdx}`,
            employeeId,
            employeeName: name,
            dayKey: day,
            entryAt: null,
            exitAt: null,
            pending: true,
            outOfRange: false,
            lastEventAt: event.event_at,
            lastDistance: event.distance_meters,
            radius: event.allowed_radius_meters,
          };
        }
        if (event.event_type === "salida") current.exitAt = event.event_at;
        current.pending = current.pending || event.clock_state === "pendiente_revision";
        current.outOfRange = current.outOfRange || event.location_state === "fuera_del_radio";
        current.lastEventAt = event.event_at;
        current.lastDistance = event.distance_meters;
        current.radius = event.allowed_radius_meters;
        if (event.event_type === "salida") pushCurrent();
      });
      pushCurrent();
    });

    return rows.sort(
      (a, b) => new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime(),
    );
  }, [employeeNames, events]);

  const formatTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "—";

  const formatDay = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  const showDateColumn = range !== "today" && range !== "yesterday";

  const formatHours = (entryAt: string | null, exitAt: string | null) => {
    if (!entryAt || !exitAt) return "—";
    const hours = Math.max(0, new Date(exitAt).getTime() - new Date(entryAt).getTime()) / 3_600_000;
    return `${hours.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
  };

  const AUTO_CLOSE_HOURS = 16;
  const isAutoClosed = (entryAt: string | null, exitAt: string | null) => {
    if (!entryAt || exitAt) return false;
    return (Date.now() - new Date(entryAt).getTime()) / 3_600_000 >= AUTO_CLOSE_HOURS;
  };

  // Horas reales trabajadas agregadas por empleado+día (suma de todos los turnos cerrados).
  const dayHoursByKey = useMemo(() => {
    const map = new Map<string, number>();
    attendanceRows.forEach((r) => {
      if (!r.entryAt || !r.exitAt) return;
      const h = Math.max(0, new Date(r.exitAt).getTime() - new Date(r.entryAt).getTime()) / 3_600_000;
      const k = `${r.employeeId}|${r.dayKey}`;
      map.set(k, (map.get(k) ?? 0) + h);
    });
    return map;
  }, [attendanceRows]);

  // Horas esperadas según horario configurado del empleado.
  const expectedHoursFor = (employeeId: string): number | null => {
    const s = employeeSettings[employeeId];
    if (!s?.entry_time || !s?.exit_time) return null;
    const [eh, em] = s.entry_time.split(":").map(Number);
    const [xh, xm] = s.exit_time.split(":").map(Number);
    const entryMin = (eh ?? 0) * 60 + (em ?? 0);
    const exitMin = (xh ?? 0) * 60 + (xm ?? 0);
    const diff = exitMin - entryMin - (s.break_minutes ?? 0);
    return diff > 0 ? diff / 60 : null;
  };

  const currentRangeLabel = RANGE_OPTIONS.find((opt) => opt.value === range)?.label ?? "";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Sublime · Fichaje
            </h1>
            <p className="text-sm text-muted-foreground">
              Control de asistencia del equipo de tienda
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/sublime/fichaje" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Vista pública
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="asistencia" className="space-y-6">
        <TabsList className="bg-muted rounded-xl p-1 h-auto flex-wrap">
          <TabsTrigger value="asistencia" className="rounded-lg data-[state=active]:bg-background">
            Historial fichajes
          </TabsTrigger>
          <TabsTrigger value="horarios" className="rounded-lg data-[state=active]:bg-background">
            Horarios
          </TabsTrigger>
          <TabsTrigger value="incidencias" className="rounded-lg data-[state=active]:bg-background">
            Incidencias
          </TabsTrigger>
          <TabsTrigger value="metricas" className="rounded-lg data-[state=active]:bg-background">
            Métricas
          </TabsTrigger>
          <TabsTrigger value="tiendas" className="rounded-lg data-[state=active]:bg-background">
            Tiendas
          </TabsTrigger>
        </TabsList>

        {/* Historial fichajes */}
        <TabsContent value="asistencia">
          <Card className="rounded-2xl border-border/60 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border/60">
              <div>
                <p className="text-sm font-semibold text-foreground">Registros · {currentRangeLabel}</p>
                <p className="text-xs text-muted-foreground">{attendanceRows.length} fichaje(s) en el periodo</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
                  <SelectTrigger className="w-[180px] rounded-xl h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={loadAttendance} className="rounded-xl" disabled={loadingAttendance}>
                  {loadingAttendance ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Refrescar
                </Button>
              </div>
            </div>
            {loadingAttendance ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando fichajes…
              </div>
            ) : attendanceError ? (
              <EmptyState
                icon={AlertCircle}
                title="No se pudieron cargar los fichajes"
                description={attendanceError}
              />
            ) : attendanceRows.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {showDateColumn && <TableHead className="uppercase tracking-wider text-xs font-semibold">Fecha</TableHead>}
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Empleado</TableHead>
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Entrada</TableHead>
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Salida</TableHead>
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Horas</TableHead>
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Cumplimiento</TableHead>
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRows.map((row) => {
                    const autoClosed = isAutoClosed(row.entryAt, row.exitAt);
                    const status = row.pending
                      ? { label: "Pendiente revisión", className: "bg-destructive/10 text-destructive border-destructive/20" }
                      : autoClosed
                        ? { label: "No cerró turno", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" }
                        : row.exitAt
                          ? { label: "Completa", className: "bg-primary/10 text-primary border-primary/20" }
                          : row.entryAt
                            ? { label: "En turno", className: "bg-muted text-foreground border-border" }
                            : { label: "Registrado", className: "bg-muted text-muted-foreground border-border" };
                    return (
                      <TableRow key={row.key}>
                        {showDateColumn && <TableCell className="tabular-nums text-muted-foreground">{formatDay(row.dayKey)}</TableCell>}
                        <TableCell className="font-semibold text-foreground">{row.employeeName}</TableCell>
                        <TableCell className="tabular-nums">{formatTime(row.entryAt)}</TableCell>
                        <TableCell className="tabular-nums">
                          {autoClosed ? <span className="text-muted-foreground italic">sin marcar</span> : formatTime(row.exitAt)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {autoClosed ? <span className="text-muted-foreground">—</span> : formatHours(row.entryAt, row.exitAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline" className={status.className}>{status.label}</Badge>
                            {autoClosed && (
                              <span className="text-xs text-muted-foreground max-w-[260px]">
                                Cierre automático: superó {AUTO_CLOSE_HOURS}h sin marcar salida. Evidentemente olvidó fichar.
                              </span>
                            )}
                            {row.outOfRange && row.lastDistance != null && (
                              <span className="text-xs text-muted-foreground">
                                Fuera de radio: {row.lastDistance.toLocaleString("es-ES")} m / {row.radius ?? "—"} m
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={Clock}
                title="No hay fichajes en este periodo"
                description="Cambia el filtro de periodo o espera a que el equipo registre nuevos fichajes."
              />
            )}
          </Card>
        </TabsContent>

        {/* Horarios */}
        <TabsContent value="horarios">
          <SublimeSchedulesAdmin />
        </TabsContent>

        {/* Incidencias */}
        <TabsContent value="incidencias">
          <Card className="rounded-2xl border-border/60 p-4">
            <SublimePendingReviews />
          </Card>
        </TabsContent>

        {/* Métricas */}
        <TabsContent value="metricas" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminMetricCard label="Horas semana" value="—" hint="Total del equipo" icon={Timer} />
            <AdminMetricCard label="Puntualidad" value="—" hint="Últimos 7 días" icon={CheckCircle2} />
            <AdminMetricCard label="Ausencias" value="—" hint="Mes en curso" icon={UserX} />
            <AdminMetricCard label="Horas extra" value="—" hint="Mes en curso" icon={Hourglass} />
          </div>
          <Card className="rounded-2xl border-border/60">
            <EmptyState
              icon={BarChart3}
              title="Las métricas aparecerán cuando haya datos"
              description="En cuanto el equipo empiece a fichar, verás aquí KPIs de puntualidad, asistencia y horas trabajadas."
            />
          </Card>
        </TabsContent>

        {/* Tiendas */}
        <TabsContent value="tiendas">
          <SublimeStoresAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}
