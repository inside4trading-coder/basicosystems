import { useState } from "react";
import { Phone, PhoneCall, PhoneOff, Clock, DollarSign, CheckCircle, Loader2, AlertTriangle, RefreshCw, Calendar } from "lucide-react";
import ZadarmaWebPhone from "@/components/llamadas/ZadarmaWebPhone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCallsData, type CallPeriod } from "@/hooks/useCallsData";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const periods: { key: CallPeriod; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Últimos 7 días" },
  { key: "month", label: "Últimos 30 días" },
];

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  answered: { label: "Contestada", variant: "default" },
  no_answer: { label: "Sin respuesta", variant: "secondary" },
  busy: { label: "Ocupado", variant: "outline" },
  missed: { label: "Perdida", variant: "destructive" },
};

const DIRECTION_BADGES: Record<string, { label: string; icon: string }> = {
  incoming: { label: "Entrante", icon: "↙" },
  outgoing: { label: "Saliente", icon: "↗" },
  internal: { label: "Interna", icon: "↔" },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-VE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Llamadas() {
  const [period, setPeriod] = useState<CallPeriod>("month");
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | undefined>();
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { data, loading, error, refetch } = useCallsData(period, customRange);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const now = new Date();
      let start: Date;
      let end = now;

      switch (period) {
        case "today":
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          start = new Date(now);
          start.setDate(start.getDate() - 7);
          break;
        case "custom":
          if (customRange) {
            start = customRange.start;
            end = customRange.end;
          } else {
            start = new Date(now);
            start.setDate(start.getDate() - 30);
          }
          break;
        default:
          start = new Date(now);
          start.setDate(start.getDate() - 30);
      }

      const fmt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/zadarma-sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start: fmt(start), end: fmt(end) }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Sync failed");

      toast.success(`Sincronización completada: ${result.synced} llamadas`);
      refetch();
    } catch (err) {
      toast.error(`Error sincronizando: ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      setPeriod("custom");
      setCustomRange({ start: new Date(customFrom), end: new Date(customTo + "T23:59:59") });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={refetch}>Reintentar</Button>
      </div>
    );
  }

  const kpis = data?.kpis;
  const isEmpty = !data || data.kpis.totalCalls === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Llamadas</h1>
        <p className="text-muted-foreground text-sm">Seguimiento y análisis de llamadas del equipo</p>
      </div>

      {/* Web Phone */}
      <ZadarmaWebPhone />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {periods.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={period === p.key ? "default" : "outline"}
            onClick={() => { setPeriod(p.key); setCustomRange(undefined); }}
          >
            {p.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant={period === "custom" ? "default" : "outline"}>
              <Calendar className="h-4 w-4 mr-1" /> Personalizado
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 space-y-3" align="start">
            <div className="space-y-2">
              <label className="text-xs font-medium">Desde</label>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Hasta</label>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
            <Button size="sm" className="w-full" onClick={handleCustomApply}>Aplicar</Button>
          </PopoverContent>
        </Popover>

        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sincronizar llamadas
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Phone className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg">Sin llamadas en este período</h3>
            <p className="text-muted-foreground text-sm mt-1">Sincroniza tus llamadas desde Zadarma para ver datos aquí.</p>
            <Button className="mt-4" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sincronizar ahora
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard icon={Phone} label="Total llamadas" value={kpis!.totalCalls} />
            <KPICard icon={CheckCircle} label="Llamadas válidas" value={kpis!.validCalls} accent />
            <KPICard icon={PhoneCall} label="Tasa contestación" value={`${kpis!.answerRate.toFixed(1)}%`} />
            <KPICard icon={CheckCircle} label="Tasa validez" value={`${kpis!.validRate.toFixed(1)}%`} />
            <KPICard icon={Clock} label="Minutos hablados" value={kpis!.minutesTalked} />
            <KPICard icon={DollarSign} label="Coste total" value={`$${kpis!.totalCost.toFixed(2)}`} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily evolution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Evolución diaria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data!.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="answered" name="Contestadas" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="valid" name="Válidas" stroke="hsl(152, 60%, 42%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Hourly distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Llamadas por hora</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data!.hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}h`} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip labelFormatter={(v) => `${v}:00 - ${v}:59`} />
                      <Bar dataKey="count" name="Llamadas" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agent performance table */}
          {data!.agentData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Rendimiento por agente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agente</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Contestadas</TableHead>
                        <TableHead className="text-right">Perdidas</TableHead>
                        <TableHead className="text-right">Válidas</TableHead>
                        <TableHead className="text-right">Minutos</TableHead>
                        <TableHead className="text-right">Dur. media</TableHead>
                        <TableHead className="text-right">% Validez</TableHead>
                        <TableHead className="text-right">% Contest.</TableHead>
                        <TableHead className="text-right">Coste</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.agentData.map((a) => (
                        <TableRow key={a.agent}>
                          <TableCell className="font-medium">{a.agent}</TableCell>
                          <TableCell className="text-right">{a.total}</TableCell>
                          <TableCell className="text-right">{a.answered}</TableCell>
                          <TableCell className="text-right">{a.missed}</TableCell>
                          <TableCell className="text-right">{a.valid}</TableCell>
                          <TableCell className="text-right">{a.minutes}</TableCell>
                          <TableCell className="text-right">{a.avgDuration} min</TableCell>
                          <TableCell className="text-right">{a.validRate}%</TableCell>
                          <TableCell className="text-right">{a.answerRate}%</TableCell>
                          <TableCell className="text-right">${a.cost}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent calls */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Llamadas recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Duración</TableHead>
                      <TableHead className="text-right">Coste</TableHead>
                      <TableHead>Grabación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.recentCalls.map((c) => {
                      const dir = DIRECTION_BADGES[c.direction] || DIRECTION_BADGES.outgoing;
                      const st = STATUS_BADGES[c.status] || STATUS_BADGES.no_answer;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm">{formatDateTime(c.call_start)}</TableCell>
                          <TableCell className="font-mono text-sm">{c.caller || "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{c.destination || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {dir.icon} {dir.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatDuration(c.duration)}</TableCell>
                          <TableCell className="text-right text-sm">${c.cost.toFixed(2)}</TableCell>
                          <TableCell>
                            {c.is_recorded && c.recording_url ? (
                              <a href={c.recording_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                🎧 Escuchar
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string | number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${accent ? "text-green-600" : "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className={`text-2xl font-bold tracking-tight ${accent ? "text-green-700" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
