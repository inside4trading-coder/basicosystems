import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, LogOut, QrCode, RefreshCw, UserRound, Users } from "lucide-react";
import { formatAmount, type PortalDashboard, type PortalOperator } from "@/lib/operatorPortal";

interface Props {
  operator: PortalOperator;
  dashboard: PortalDashboard | null;
  amountsVisible: boolean;
  refreshing: boolean;
  onToggleAmounts: () => void;
  onScan: () => void;
  onRefresh: () => void;
  onSwitchOperator: () => void;
  onLogout: () => void;
}

function timeOf(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
}
function dayTimeOf(iso: string) {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function dateLabel(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export function OperatorDashboard({
  operator,
  dashboard,
  amountsVisible,
  refreshing,
  onToggleAmounts,
  onScan,
  onRefresh,
  onSwitchOperator,
  onLogout,
}: Props) {
  const today = dashboard?.today;
  const week = dashboard?.week_totals;

  return (
    <div className="space-y-4 pb-28">
      {/* Encabezado permanente */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
            {operator.photo_url ? (
              <img src={operator.photo_url} alt={operator.name} className="h-full w-full object-cover" />
            ) : (
              <UserRound className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Escaneando como</div>
            <div className="truncate text-lg font-bold uppercase">{operator.name}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Actualizar" disabled={refreshing}>
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onSwitchOperator}>
            <Users className="mr-1 h-4 w-4" /> Cambiar trabajador
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onLogout}>
            <LogOut className="mr-1 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </div>

      {/* Privacidad de montos */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {amountsVisible ? "Montos visibles" : "Montos ocultos por privacidad"}
        </span>
        <Button variant="ghost" size="sm" onClick={onToggleAmounts}>
          {amountsVisible ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
          {amountsVisible ? "Ocultar montos" : "Mostrar montos"}
        </Button>
      </div>

      {/* Hoy */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Procesos hoy</div>
            <div className="text-3xl font-bold">{today?.processes ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Prendas hoy</div>
            <div className="text-3xl font-bold">{today?.units ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Generado hoy</div>
            <div className="text-2xl font-bold tabular-nums">{formatAmount(today?.amount, amountsVisible)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Último escaneo</div>
            <div className="text-2xl font-bold">{timeOf(today?.last_scan_at ?? null)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por proceso */}
      {dashboard && dashboard.by_process.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hoy por proceso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {dashboard.by_process.map((p) => (
              <div key={p.label} className="flex items-center justify-between text-sm">
                <span className="font-medium">{p.label}</span>
                <span className="text-muted-foreground">
                  {p.count} · {formatAmount(p.amount, amountsVisible)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Semana de nómina */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Semana de nómina{" "}
            {dashboard && (
              <span className="font-normal text-muted-foreground">
                {dateLabel(dashboard.week.start)} – {dateLabel(dashboard.week.end)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 p-4 pt-0 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Procesos</div>
            <div className="text-xl font-bold">{week?.processes ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Prendas</div>
            <div className="text-xl font-bold">{week?.units ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Acumulado</div>
            <div className="text-xl font-bold tabular-nums">{formatAmount(week?.amount, amountsVisible)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Últimos escaneos */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {showAll ? "Acumulado de la semana" : "Últimos escaneos de hoy"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Ver menos" : "Ver todo"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {showAll ? "Aún no tienes escaneos esta semana." : "Aún no tienes escaneos hoy."}
            </p>
          )}
          {showAll && list.length > 0 && (
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium">{list.length} procesos en la semana</span>
              <span className="font-semibold tabular-nums">
                {formatAmount(
                  list.reduce((a, r) => a + Number(r.amount ?? 0), 0),
                  amountsVisible,
                )}
              </span>
            </div>
          )}
          {list.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.product_name ?? r.unit_code}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[r.variant, r.process_name, r.unit_code].filter(Boolean).join(" · ")}
                </div>
                <div className="text-xs text-muted-foreground">{dayTimeOf(r.created_at)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums">{formatAmount(r.amount, amountsVisible)}</div>
                {r.payroll_status && (
                  <Badge variant={r.payroll_status === "pending" ? "secondary" : "outline"} className="mt-1 text-[10px]">
                    {r.payroll_status === "pending"
                      ? "En nómina"
                      : r.payroll_status === "missing_rate"
                        ? "Sin tarifa"
                        : r.payroll_status}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>


      {/* Botón fijo escanear */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur">
        <Button size="lg" className="h-14 w-full text-lg" onClick={onScan}>
          <QrCode className="mr-2 h-6 w-6" /> Escanear prenda
        </Button>
      </div>
    </div>
  );
}
