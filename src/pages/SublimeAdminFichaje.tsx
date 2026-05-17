import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminMetricCard } from "@/components/sublime/AdminMetricCard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  eventIds: string[];
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
  store_id?: string | null;
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
            eventIds: [event.id],
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
            eventIds: [],
          };
        }
        current.eventIds.push(event.id);
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
    const minutes = workedMinutes(entryAt, exitAt);
    return minutes == null ? "—" : formatDuration(minutes);
  };

  const AUTO_CLOSE_HOURS = 16;
  const isAutoClosed = (entryAt: string | null, exitAt: string | null) => {
    if (!entryAt || exitAt) return false;
    return (Date.now() - new Date(entryAt).getTime()) / 3_600_000 >= AUTO_CLOSE_HOURS;
  };

  const workedMinutes = (entryAt: string | null, exitAt: string | null): number | null => {
    if (!entryAt || !exitAt) return null;
    return Math.max(0, Math.round((new Date(exitAt).getTime() - new Date(entryAt).getTime()) / 60_000));
  };

  const formatDuration = (totalMinutes: number) => {
    const minutes = Math.max(0, Math.round(totalMinutes));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  };

  // Minutos esperados según horario configurado del empleado.
  // El descanso cuenta como parte del turno, no se descuenta.
  const expectedMinutesFor = (employeeId: string): number | null => {
    const s = employeeSettings[employeeId];
    if (!s?.entry_time || !s?.exit_time) return null;
    const [eh, em] = s.entry_time.split(":").map(Number);
    const [xh, xm] = s.exit_time.split(":").map(Number);
    const entryMin = (eh ?? 0) * 60 + (em ?? 0);
    const exitMin = (xh ?? 0) * 60 + (xm ?? 0);
    const diff = exitMin >= entryMin ? exitMin - entryMin : exitMin + 24 * 60 - entryMin;
    return diff > 0 ? diff : null;
  };

  const currentRangeLabel = RANGE_OPTIONS.find((opt) => opt.value === range)?.label ?? "";

  // ===== Métricas (rango independiente) =====
  const [metricsRange, setMetricsRange] = useState<RangeKey>("week");
  const [metricsEmployee, setMetricsEmployee] = useState<string>("all");
  const [metricsEvents, setMetricsEvents] = useState<ClockEvent[]>([]);
  const [allEmployees, setAllEmployees] = useState<{ id: string; name: string }[]>([]);
  const [metricsNames, setMetricsNames] = useState<Record<string, string>>({});
  const [metricsSettings, setMetricsSettings] = useState<Record<string, EmployeeSettings & { late_tolerance_minutes?: number }>>({});
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    const { start, end } = computeRange(metricsRange);

    const [{ data: allEmps }, { data: allSettings }, { data: stores }] = await Promise.all([
      supabase.from("employees").select("id, first_name, last_name, location").eq("status", "active"),
      supabase.from("sublime_clock_settings").select("employee_id, entry_time, exit_time, break_minutes, late_tolerance_minutes, store_id"),
      supabase.from("sublime_stores").select("id, name"),
    ]);

    const sublimeStoreIds = new Set((stores ?? []).map((s: any) => s.id));

    const cfg: Record<string, EmployeeSettings & { late_tolerance_minutes?: number }> = {};
    (allSettings ?? []).forEach((s: any) => {
      cfg[s.employee_id] = {
        entry_time: s.entry_time,
        exit_time: s.exit_time,
        break_minutes: s.break_minutes ?? 0,
        late_tolerance_minutes: s.late_tolerance_minutes ?? 10,
        store_id: s.store_id,
      };
    });
    setMetricsSettings(cfg);

    // Solo empleados con horario definido y de tienda Sublime
    const empList = (allEmps ?? [])
      .filter((e: any) => {
        const setting = cfg[e.id];
        if (!setting?.entry_time || !setting?.exit_time) return false;
        return sublimeStoreIds.has(setting.store_id);
      })
      .map((e: any) => ({ id: e.id, name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() }));
    empList.sort((a, b) => a.name.localeCompare(b.name));
    setAllEmployees(empList);

    const names: Record<string, string> = {};
    empList.forEach((e) => { names[e.id] = e.name; });
    setMetricsNames(names);

    const { data, error } = await supabase
      .from("sublime_clock_events")
      .select("id, employee_id, event_type, event_at, clock_state, location_state, distance_meters, allowed_radius_meters")
      .gte("event_at", start.toISOString())
      .lt("event_at", end.toISOString())
      .order("event_at", { ascending: true });
    if (error) {
      setMetricsError(error.message);
      setMetricsEvents([]);
      setMetricsLoading(false);
      return;
    }
    setMetricsEvents((data ?? []) as ClockEvent[]);
    setMetricsLoading(false);
  }, [metricsRange]);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  const metricsData = useMemo(() => {
    // Construir turnos por empleado+día
    const byEmpDay = new Map<string, ClockEvent[]>();
    metricsEvents.forEach((event) => {
      if (metricsEmployee !== "all" && event.employee_id !== metricsEmployee) return;
      const day = dayKeyOf(event.event_at);
      const k = `${event.employee_id}|${day}`;
      const arr = byEmpDay.get(k) ?? [];
      arr.push(event);
      byEmpDay.set(k, arr);
    });

    type Shift = { employeeId: string; day: string; entryAt: string | null; exitAt: string | null; pending: boolean; outOfRange: boolean };
    const shifts: Shift[] = [];
    byEmpDay.forEach((evs, k) => {
      const [employeeId, day] = k.split("|");
      const sorted = [...evs].sort((a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime());
      let cur: Shift | null = null;
      const push = () => { if (cur) shifts.push(cur); cur = null; };
      sorted.forEach((e) => {
        if (e.event_type === "entrada") {
          push();
          cur = { employeeId, day, entryAt: e.event_at, exitAt: null, pending: e.clock_state === "pendiente_revision", outOfRange: e.location_state === "fuera_del_radio" };
          return;
        }
        if (!cur) cur = { employeeId, day, entryAt: null, exitAt: null, pending: true, outOfRange: false };
        if (e.event_type === "salida") cur.exitAt = e.event_at;
        cur.pending = cur.pending || e.clock_state === "pendiente_revision";
        cur.outOfRange = cur.outOfRange || e.location_state === "fuera_del_radio";
        if (e.event_type === "salida") push();
      });
      push();
    });

    // Per employee aggregation
    type EmpAgg = {
      employeeId: string;
      employeeName: string;
      shifts: number;
      closedShifts: number;
      totalWorkedMin: number;
      totalExpectedMin: number;
      lateCount: number;
      totalLateMin: number;
      earlyExitCount: number;
      totalEarlyExitMin: number;
      overtimeMin: number;
      missingExitCount: number;
      pendingCount: number;
      outOfRangeCount: number;
      onTimeCount: number;
    };
    const per = new Map<string, EmpAgg>();

    let totalShifts = 0;
    let totalClosed = 0;
    let totalWorked = 0;
    let totalExpected = 0;
    let totalLateMin = 0;
    let totalLateCount = 0;
    let totalEarlyMin = 0;
    let totalEarlyCount = 0;
    let totalOvertime = 0;
    let totalMissingExit = 0;
    let totalPending = 0;
    let totalOutOfRange = 0;
    let totalOnTime = 0;

    shifts.forEach((s) => {
      const cfg = metricsSettings[s.employeeId];
      const tolerance = cfg?.late_tolerance_minutes ?? 10;
      const name = metricsNames[s.employeeId] ?? "Empleado";
      const agg = per.get(s.employeeId) ?? {
        employeeId: s.employeeId, employeeName: name,
        shifts: 0, closedShifts: 0, totalWorkedMin: 0, totalExpectedMin: 0,
        lateCount: 0, totalLateMin: 0, earlyExitCount: 0, totalEarlyExitMin: 0,
        overtimeMin: 0, missingExitCount: 0, pendingCount: 0, outOfRangeCount: 0, onTimeCount: 0,
      };
      agg.shifts += 1;
      totalShifts += 1;
      if (s.pending) { agg.pendingCount += 1; totalPending += 1; }
      if (s.outOfRange) { agg.outOfRangeCount += 1; totalOutOfRange += 1; }

      // Lateness vs scheduled entry
      if (s.entryAt && cfg?.entry_time) {
        const d = new Date(s.entryAt);
        const [eh, em] = cfg.entry_time.split(":").map(Number);
        const scheduled = new Date(d); scheduled.setHours(eh ?? 0, em ?? 0, 0, 0);
        const lateMin = Math.round((d.getTime() - scheduled.getTime()) / 60_000);
        if (lateMin > tolerance) {
          agg.lateCount += 1; totalLateCount += 1;
          agg.totalLateMin += lateMin; totalLateMin += lateMin;
        } else {
          agg.onTimeCount += 1; totalOnTime += 1;
        }
      }

      if (s.entryAt && !s.exitAt) {
        // No salida marcada (turno abierto o auto-cierre)
        agg.missingExitCount += 1; totalMissingExit += 1;
      }

      if (s.entryAt && s.exitAt) {
        agg.closedShifts += 1; totalClosed += 1;
        const worked = Math.max(0, Math.round((new Date(s.exitAt).getTime() - new Date(s.entryAt).getTime()) / 60_000));
        agg.totalWorkedMin += worked; totalWorked += worked;
        let expected = 0;
        if (cfg?.entry_time && cfg?.exit_time) {
          const [eh2, em2] = cfg.entry_time.split(":").map(Number);
          const [xh2, xm2] = cfg.exit_time.split(":").map(Number);
          const eMin = (eh2 ?? 0) * 60 + (em2 ?? 0);
          const xMin = (xh2 ?? 0) * 60 + (xm2 ?? 0);
          expected = xMin >= eMin ? xMin - eMin : xMin + 24 * 60 - eMin;
        }
        agg.totalExpectedMin += expected; totalExpected += expected;
        // Early exit / overtime vs scheduled exit
        if (cfg?.exit_time) {
          const x = new Date(s.exitAt);
          const [xh, xm] = cfg.exit_time.split(":").map(Number);
          const scheduled = new Date(x); scheduled.setHours(xh ?? 0, xm ?? 0, 0, 0);
          // Si la salida programada es antes que entrada (turno nocturno), sumar 24h
          if (s.entryAt) {
            const entryD = new Date(s.entryAt);
            const [eh, em] = (cfg.entry_time ?? "00:00").split(":").map(Number);
            const schedEntry = new Date(entryD); schedEntry.setHours(eh ?? 0, em ?? 0, 0, 0);
            if (scheduled.getTime() < schedEntry.getTime()) scheduled.setDate(scheduled.getDate() + 1);
          }
          const diffMin = Math.round((x.getTime() - scheduled.getTime()) / 60_000);
          if (diffMin < -2) { agg.earlyExitCount += 1; totalEarlyCount += 1; agg.totalEarlyExitMin += -diffMin; totalEarlyMin += -diffMin; }
          if (diffMin > 2) { agg.overtimeMin += diffMin; totalOvertime += diffMin; }
        }
      }

      per.set(s.employeeId, agg);
    });

    const employees = Array.from(per.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    const punctualityPct = (totalLateCount + totalOnTime) > 0
      ? Math.round((totalOnTime / (totalLateCount + totalOnTime)) * 100)
      : null;

    return {
      employees,
      totals: {
        shifts: totalShifts,
        closed: totalClosed,
        worked: totalWorked,
        expected: totalExpected,
        lateCount: totalLateCount,
        lateMin: totalLateMin,
        earlyCount: totalEarlyCount,
        earlyMin: totalEarlyMin,
        overtime: totalOvertime,
        missingExit: totalMissingExit,
        pending: totalPending,
        outOfRange: totalOutOfRange,
        onTime: totalOnTime,
        punctualityPct,
      },
    };
  }, [metricsEvents, metricsNames, metricsSettings, metricsEmployee]);

  const currentMetricsRangeLabel = RANGE_OPTIONS.find((opt) => opt.value === metricsRange)?.label ?? "";

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
                          {(() => {
                            const expected = expectedMinutesFor(row.employeeId);
                            const actual = workedMinutes(row.entryAt, row.exitAt);
                            if (expected == null) {
                              return <span className="text-xs text-muted-foreground">Sin horario</span>;
                            }
                            if (actual == null) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-muted-foreground">{autoClosed ? "Sin salida" : "En curso"}</span>
                                  <span className="text-[10px] text-muted-foreground">debía {formatDuration(expected)}</span>
                                </div>
                              );
                            }
                            const diff = actual - expected;
                            const totalMin = Math.abs(diff);
                            const absLabel = formatDuration(totalMin);
                            if (totalMin < 2) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="outline" className="bg-[hsl(var(--status-success)/0.12)] text-[hsl(var(--status-success))] border-[hsl(var(--status-success)/0.30)] w-fit">
                                    Completo
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">{formatDuration(actual)} / {formatDuration(expected)}</span>
                                </div>
                              );
                            }
                            if (diff > 0) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="outline" className="bg-[hsl(var(--status-success)/0.12)] text-[hsl(var(--status-success))] border-[hsl(var(--status-success)/0.30)] w-fit">
                                    +{absLabel}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">trabajó {formatDuration(actual)} / debía {formatDuration(expected)}</span>
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 w-fit">
                                  −{absLabel}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">trabajó {formatDuration(actual)} / debía {formatDuration(expected)}</span>
                              </div>
                            );
                          })()}
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
          <Card className="rounded-2xl border-border/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Métricas · {currentMetricsRangeLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {metricsData.totals.shifts} turno(s) · {metricsData.totals.closed} cerrado(s)
                  {metricsEmployee !== "all" && metricsNames[metricsEmployee] ? ` · ${metricsNames[metricsEmployee]}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={metricsEmployee} onValueChange={(v) => setMetricsEmployee(v)}>
                  <SelectTrigger className="w-[200px] rounded-xl h-9">
                    <SelectValue placeholder="Todos los empleados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los empleados</SelectItem>
                    {allEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={metricsRange} onValueChange={(v) => setMetricsRange(v as RangeKey)}>
                  <SelectTrigger className="w-[180px] rounded-xl h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RANGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={loadMetrics} className="rounded-xl" disabled={metricsLoading}>
                  {metricsLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Refrescar
                </Button>
              </div>
            </div>
          </Card>

          {metricsLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando métricas…
            </div>
          ) : metricsError ? (
            <Card className="rounded-2xl border-border/60">
              <EmptyState icon={AlertCircle} title="No se pudieron cargar las métricas" description={metricsError} />
            </Card>
          ) : metricsData.totals.shifts === 0 ? (
            <Card className="rounded-2xl border-border/60">
              <EmptyState
                icon={BarChart3}
                title="Sin fichajes en este periodo"
                description="Cambia el filtro de periodo o espera a que el equipo registre nuevos fichajes."
              />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <AdminMetricCard
                  label="Horas trabajadas"
                  value={formatDuration(metricsData.totals.worked)}
                  hint={metricsData.totals.expected > 0 ? `Debían ${formatDuration(metricsData.totals.expected)}` : "Total del equipo"}
                  icon={Timer}
                  tooltip="Suma del tiempo entre entrada y salida de todos los turnos cerrados en el periodo. El descanso cuenta como parte del turno (no se descuenta)."
                />
                <AdminMetricCard
                  label="Puntualidad"
                  value={metricsData.totals.punctualityPct != null ? `${metricsData.totals.punctualityPct}%` : "—"}
                  hint={`${metricsData.totals.onTime} a tiempo · ${metricsData.totals.lateCount} con retraso`}
                  icon={CheckCircle2}
                  tooltip="Porcentaje de turnos cuya entrada estuvo dentro de la tolerancia configurada por empleado (por defecto 10 min sobre la hora de entrada del horario)."
                />
                <AdminMetricCard
                  label="Minutos de retraso"
                  value={formatDuration(metricsData.totals.lateMin)}
                  hint={`${metricsData.totals.lateCount} turno(s) tarde`}
                  icon={AlertCircle}
                  tooltip="Suma de los minutos de retraso de los turnos que superaron la tolerancia. Se mide entrada real vs. hora de entrada programada del empleado."
                />
                <AdminMetricCard
                  label="Horas extra"
                  value={formatDuration(metricsData.totals.overtime)}
                  hint={`${metricsData.totals.earlyCount} salida(s) anticipada(s) · ${formatDuration(metricsData.totals.earlyMin)}`}
                  icon={Hourglass}
                  tooltip="Suma de minutos trabajados después de la hora de salida programada de cada turno. El subtítulo indica también las salidas anticipadas acumuladas."
                />
                <AdminMetricCard
                  label="Sin salida marcada"
                  value={String(metricsData.totals.missingExit)}
                  hint="Olvidos o turnos abiertos"
                  icon={UserX}
                  tooltip="Turnos con entrada registrada pero sin salida: el empleado olvidó fichar la salida o el turno aún está en curso."
                />
                <AdminMetricCard
                  label="Pendientes de revisión"
                  value={String(metricsData.totals.pending)}
                  hint="Fichajes a aprobar"
                  icon={AlertCircle}
                  tooltip="Fichajes marcados por el sistema como dudosos (PIN temporal, ubicación atípica, etc.) que requieren aprobación manual de un admin."
                />
                <AdminMetricCard
                  label="Fuera de radio"
                  value={String(metricsData.totals.outOfRange)}
                  hint="Fichajes con ubicación atípica"
                  icon={Store}
                  tooltip="Fichajes realizados a más distancia que el radio permitido de la tienda configurada para ese empleado."
                />
                <AdminMetricCard
                  label="Turnos cerrados"
                  value={`${metricsData.totals.closed} / ${metricsData.totals.shifts}`}
                  hint="Completos vs. registrados"
                  icon={CalendarDays}
                  tooltip="Turnos con entrada y salida registradas, comparados con el total de turnos del periodo. Lo ideal es que coincidan."
                />
              </div>

              <Card className="rounded-2xl border-border/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-border/60">
                  <p className="text-sm font-semibold text-foreground">Detalle por empleado</p>
                  <p className="text-xs text-muted-foreground">Resumen del periodo seleccionado</p>
                </div>
                <TooltipProvider delayDuration={150}>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="uppercase tracking-wider text-xs font-semibold">Empleado</TableHead>
                        {[
                          { label: "Turnos", tip: "Turnos cerrados / total de turnos del periodo. Un turno se cuenta como cerrado cuando tiene entrada y salida." },
                          { label: "Trabajadas / Debía", tip: "Tiempo realmente trabajado vs. tiempo que debía trabajar según su horario. La diferencia se muestra en verde si trabajó de más, en rojo si faltó." },
                          { label: "Puntualidad", tip: "% de entradas dentro de la tolerancia configurada para el empleado." },
                          { label: "Retrasos", tip: "Cantidad de turnos donde llegó tarde (más allá de la tolerancia) y total de minutos acumulados de retraso." },
                          { label: "Salidas anticipadas", tip: "Turnos donde la salida fue antes de la hora programada y total de minutos acumulados de salida anticipada." },
                          { label: "Horas extra", tip: "Minutos trabajados después de la hora de salida programada del empleado." },
                          { label: "Incidencias", tip: "Resumen de incidencias del periodo: sin salida marcada, pendientes de revisión y fichajes fuera de radio." },
                        ].map((h) => (
                          <TableHead key={h.label} className="uppercase tracking-wider text-xs font-semibold">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted underline-offset-4 decoration-muted-foreground/40">{h.label}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed normal-case tracking-normal font-normal">
                                {h.tip}
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {metricsData.employees.map((e) => {
                      const compared = e.lateCount + e.onTimeCount;
                      const pct = compared > 0 ? Math.round((e.onTimeCount / compared) * 100) : null;
                      const diff = e.totalWorkedMin - e.totalExpectedMin;
                      return (
                        <TableRow key={e.employeeId}>
                          <TableCell className="font-semibold text-foreground">{e.employeeName}</TableCell>
                          <TableCell className="tabular-nums">{e.closedShifts} / {e.shifts}</TableCell>
                          <TableCell className="tabular-nums">
                            <div className="flex flex-col">
                              <span>{formatDuration(e.totalWorkedMin)} / {formatDuration(e.totalExpectedMin)}</span>
                              {e.totalExpectedMin > 0 && (
                                <span className={`text-[10px] ${diff >= 0 ? "text-[hsl(var(--status-success))]" : "text-destructive"}`}>
                                  {diff >= 0 ? "+" : "−"}{formatDuration(Math.abs(diff))}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {pct != null ? (
                              <Badge variant="outline" className={pct >= 90 ? "bg-[hsl(var(--status-success)/0.12)] text-[hsl(var(--status-success))] border-[hsl(var(--status-success)/0.30)]" : pct >= 70 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" : "bg-destructive/10 text-destructive border-destructive/20"}>
                                {pct}%
                              </Badge>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {e.lateCount > 0 ? (
                              <div className="flex flex-col">
                                <span className="text-destructive font-medium">{e.lateCount} turno(s)</span>
                                <span className="text-[10px] text-muted-foreground">+{formatDuration(e.totalLateMin)} acumulados</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">Ninguno</span>}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {e.earlyExitCount > 0 ? (
                              <div className="flex flex-col">
                                <span className="text-destructive font-medium">{e.earlyExitCount} turno(s)</span>
                                <span className="text-[10px] text-muted-foreground">−{formatDuration(e.totalEarlyExitMin)} acumulados</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">Ninguna</span>}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {e.overtimeMin > 0 ? (
                              <span className="text-[hsl(var(--status-success))] font-medium">+{formatDuration(e.overtimeMin)}</span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {e.missingExitCount > 0 && <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Sin salida: {e.missingExitCount}</Badge>}
                              {e.pendingCount > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Pendientes: {e.pendingCount}</Badge>}
                              {e.outOfRangeCount > 0 && <Badge variant="outline" className="bg-muted text-foreground border-border">Fuera radio: {e.outOfRangeCount}</Badge>}
                              {e.missingExitCount === 0 && e.pendingCount === 0 && e.outOfRangeCount === 0 && (
                                <span className="text-xs text-muted-foreground">Sin incidencias</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </TooltipProvider>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tiendas */}
        <TabsContent value="tiendas">
          <SublimeStoresAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}
