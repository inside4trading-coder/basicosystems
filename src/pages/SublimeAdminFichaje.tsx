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
  employeeId: string;
  employeeName: string;
  entryAt: string | null;
  exitAt: string | null;
  pending: boolean;
  outOfRange: boolean;
  lastEventAt: string;
  lastDistance: number | null;
  radius: number | null;
};

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

export default function SublimeAdminFichaje() {
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const loadAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    setAttendanceError(null);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

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

    const todayEvents = (data ?? []) as ClockEvent[];
    setEvents(todayEvents);

    const ids = Array.from(new Set(todayEvents.map((event) => event.employee_id)));
    if (ids.length) {
      const { data: employees } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .in("id", ids);

      const names: Record<string, string> = {};
      (employees ?? []).forEach((employee: any) => {
        names[employee.id] = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
      });
      setEmployeeNames(names);
    } else {
      setEmployeeNames({});
    }

    setLoadingAttendance(false);
  }, []);

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
    const rows = new Map<string, AttendanceRow>();

    events.forEach((event) => {
      const current = rows.get(event.employee_id) ?? {
        employeeId: event.employee_id,
        employeeName: employeeNames[event.employee_id] ?? "Empleado",
        entryAt: null,
        exitAt: null,
        pending: false,
        outOfRange: false,
        lastEventAt: event.event_at,
        lastDistance: null,
        radius: null,
      };

      if (event.event_type === "entrada" && !current.entryAt) current.entryAt = event.event_at;
      if (event.event_type === "salida") current.exitAt = event.event_at;
      current.pending = current.pending || event.clock_state === "pendiente_revision";
      current.outOfRange = current.outOfRange || event.location_state === "fuera_del_radio";
      current.lastEventAt = event.event_at;
      current.lastDistance = event.distance_meters;
      current.radius = event.allowed_radius_meters;
      current.employeeName = employeeNames[event.employee_id] ?? current.employeeName;
      rows.set(event.employee_id, current);
    });

    return Array.from(rows.values()).sort(
      (a, b) => new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime(),
    );
  }, [employeeNames, events]);

  const formatTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "—";

  const formatHours = (entryAt: string | null, exitAt: string | null) => {
    if (!entryAt || !exitAt) return "—";
    const hours = Math.max(0, new Date(exitAt).getTime() - new Date(entryAt).getTime()) / 3_600_000;
    return `${hours.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
  };

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
            Asistencia hoy
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

        {/* Asistencia hoy */}
        <TabsContent value="asistencia">
          <Card className="rounded-2xl border-border/60 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border/60">
              <div>
                <p className="text-sm font-semibold text-foreground">Registros de hoy</p>
                <p className="text-xs text-muted-foreground">{attendanceRows.length} empleado(s) con fichaje registrado</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadAttendance} className="rounded-xl" disabled={loadingAttendance}>
                {loadingAttendance ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Refrescar
              </Button>
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
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Empleado</TableHead>
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Entrada</TableHead>
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Salida</TableHead>
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Horas</TableHead>
                    <TableHead className="uppercase tracking-wider text-xs font-semibold">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRows.map((row) => {
                    const status = row.pending
                      ? { label: "Pendiente revisión", className: "bg-destructive/10 text-destructive border-destructive/20" }
                      : row.exitAt
                        ? { label: "Completa", className: "bg-primary/10 text-primary border-primary/20" }
                        : row.entryAt
                          ? { label: "En turno", className: "bg-muted text-foreground border-border" }
                          : { label: "Registrado", className: "bg-muted text-muted-foreground border-border" };
                    return (
                      <TableRow key={row.employeeId}>
                        <TableCell className="font-semibold text-foreground">{row.employeeName}</TableCell>
                        <TableCell className="tabular-nums">{formatTime(row.entryAt)}</TableCell>
                        <TableCell className="tabular-nums">{formatTime(row.exitAt)}</TableCell>
                        <TableCell className="tabular-nums">{formatHours(row.entryAt, row.exitAt)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline" className={status.className}>{status.label}</Badge>
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
                title="Aún no hay fichajes registrados hoy"
                description="Los fichajes del equipo aparecerán aquí en tiempo real cuando empiecen a registrarse."
              />
            )}
          </Card>
        </TabsContent>

        {/* Horarios */}
        <TabsContent value="horarios">
          <Card className="rounded-2xl border-border/60">
            <EmptyState
              icon={CalendarDays}
              title="Configura los horarios del equipo"
              description="Define los turnos semanales de cada empleado para empezar a comparar fichajes con horarios planificados."
            />
          </Card>
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
