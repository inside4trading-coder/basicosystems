import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { logCoreAudit } from "@/lib/coreAudit";
import { Wallet, Plus, CheckCircle2, AlertTriangle, FileText, Printer, RefreshCw, DollarSign, Users, ListChecks } from "lucide-react";
import { formatDMY } from "@/lib/dateUtils";

type WorkEntry = {
  id: string;
  unit_code: string | null;
  process_name: string | null;
  process_type: string | null;
  operator_id: string | null;
  operator_name_snapshot: string | null;
  rate_snapshot: number | null;
  payroll_amount: number | null;
  payroll_status: string;
  currency: string | null;
  payroll_week_start: string | null;
  payroll_week_end: string | null;
  created_at: string;
  production_order_id: string | null;
  scanned_by_user_id: string | null;
};

type PayrollRun = {
  id: string;
  payroll_code: string | null;
  period_start: string;
  period_end: string;
  payment_date: string | null;
  status: string;
  total_amount: number;
  currency: string;
  operators_count: number;
  work_entries_count: number;
  adjustments_total: number;
  bcv_rate: number | null;
  total_paid_amount: number | null;
  payment_notes: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type OperatorLine = {
  id: string;
  payroll_run_id: string;
  operator_id: string;
  operator_name_snapshot: string | null;
  total_processes: number;
  subtotal_amount: number;
  adjustments_amount: number;
  total_amount: number;
  currency: string;
  status: string;
  notes: string | null;
};

type Adjustment = {
  id: string;
  payroll_operator_line_id: string;
  operator_id: string;
  adjustment_type: string;
  amount: number;
  reason: string;
  notes: string | null;
  created_at: string;
};

// --- Week helpers (Friday→Thursday) ---
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function getCurrentWeek(): { start: string; end: string; payment: string } {
  // Period: Friday → Thursday. Payment: Friday after period_end.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Find most recent Friday on or before today
  const dow = today.getDay(); // 0=Sun..6=Sat; Friday=5
  const daysSinceFri = (dow - 5 + 7) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - daysSinceFri);
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Thursday
  const payment = new Date(end);
  payment.setDate(end.getDate() + 1); // Friday
  return { start: isoDate(start), end: isoDate(end), payment: isoDate(payment) };
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-muted text-foreground" },
  review: { label: "En revisión", className: "bg-amber-100 text-amber-900" },
  approved: { label: "Aprobada", className: "bg-blue-100 text-blue-900" },
  paid: { label: "Pagada", className: "bg-green-100 text-green-900" },
  cancelled: { label: "Cancelada", className: "bg-red-100 text-red-900" },
  pending_review: { label: "Pendiente revisión", className: "bg-amber-100 text-amber-900" },
  adjusted: { label: "Ajustada", className: "bg-purple-100 text-purple-900" },
};

function StatusBadge({ s }: { s: string }) {
  const v = STATUS_BADGE[s] ?? { label: s, className: "bg-muted" };
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function fmt(n: number | null | undefined, cur = "USD") {
  if (n == null) return "—";
  return `${cur} ${Number(n).toFixed(2)}`;
}

export default function CorePayroll() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [pendingEntries, setPendingEntries] = useState<WorkEntry[]>([]);
  const [missingRateEntries, setMissingRateEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const week = useMemo(() => getCurrentWeek(), []);
  const [periodStart, setPeriodStart] = useState(week.start);
  const [periodEnd, setPeriodEnd] = useState(week.end);
  const [paymentDate, setPaymentDate] = useState(week.payment);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      supabase.from("core_payroll_runs").select("*").order("period_start", { ascending: false }),
      supabase.from("core_production_work_entries").select("*").eq("payroll_status", "pending").order("created_at", { ascending: false }),
      supabase.from("core_production_work_entries").select("*").eq("payroll_status", "missing_rate").order("created_at", { ascending: false }),
    ]);
    if (r1.error) toast({ title: "Error cargando nóminas", description: r1.error.message, variant: "destructive" });
    setRuns((r1.data ?? []) as PayrollRun[]);
    setPendingEntries((r2.data ?? []) as WorkEntry[]);
    setMissingRateEntries((r3.data ?? []) as WorkEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // KPIs
  const kpis = useMemo(() => {
    const currentRun = runs.find(r => r.period_start === week.start && r.period_end === week.end && r.status !== "cancelled");
    const inWeek = (e: WorkEntry) => {
      const d = (e.created_at ?? "").slice(0, 10);
      return d >= week.start && d <= week.end;
    };
    const totalPendingThisWeek = pendingEntries.filter(inWeek).reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0);
    const totalPendingAll = pendingEntries.reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0);
    const operatorsPending = new Set(pendingEntries.filter(e => e.operator_id).map(e => e.operator_id!)).size;
    const approved = runs.filter(r => r.status === "approved").length;
    const paid = runs.filter(r => r.status === "paid").length;
    return { currentRun, totalPendingThisWeek, totalPendingAll, operatorsPending, processesCount: pendingEntries.length, missing: missingRateEntries.length, approved, paid };
  }, [runs, pendingEntries, missingRateEntries, week]);

  // Group pending entries by operator
  const operatorSummaries = useMemo(() => {
    const map = new Map<string, {
      operatorId: string;
      name: string;
      entries: WorkEntry[];
      total: number;
      byProcess: Map<string, { count: number; total: number }>;
      byUnit: Set<string>;
    }>();
    for (const e of pendingEntries) {
      const key = e.operator_id ?? "__none__";
      let row = map.get(key);
      if (!row) {
        row = {
          operatorId: key,
          name: e.operator_name_snapshot ?? "Sin operario",
          entries: [],
          total: 0,
          byProcess: new Map(),
          byUnit: new Set(),
        };
        map.set(key, row);
      }
      row.entries.push(e);
      row.total += Number(e.payroll_amount ?? 0);
      const pName = e.process_name ?? "—";
      const p = row.byProcess.get(pName) ?? { count: 0, total: 0 };
      p.count += 1;
      p.total += Number(e.payroll_amount ?? 0);
      row.byProcess.set(pName, p);
      if (e.unit_code) row.byUnit.add(e.unit_code);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pendingEntries]);

  async function generatePayroll() {
    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      toast({ title: "Rango inválido", variant: "destructive" });
      return;
    }
    // Check existing
    const { data: existing } = await supabase
      .from("core_payroll_runs")
      .select("id, payroll_code, status")
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .neq("status", "cancelled")
      .maybeSingle();
    if (existing) {
      toast({ title: "Semana ya generada", description: `Nómina ${existing.payroll_code} (${existing.status}). Se abrirá.`, variant: "destructive" });
      setGenOpen(false);
      setOpenRunId(existing.id);
      return;
    }

    // Fetch pending work entries in range
    const { data: entries, error: entriesErr } = await supabase
      .from("core_production_work_entries")
      .select("*")
      .eq("payroll_status", "pending")
      .gte("created_at", `${periodStart}T00:00:00Z`)
      .lte("created_at", `${periodEnd}T23:59:59Z`);
    if (entriesErr) { toast({ title: "Error", description: entriesErr.message, variant: "destructive" }); return; }
    const valid = (entries ?? []).filter(e => e.operator_id && Number(e.payroll_amount ?? 0) > 0) as WorkEntry[];

    // Group by operator
    const byOp = new Map<string, WorkEntry[]>();
    valid.forEach(e => {
      const arr = byOp.get(e.operator_id!) ?? [];
      arr.push(e);
      byOp.set(e.operator_id!, arr);
    });

    const subtotal = valid.reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0);

    // Create run
    const { data: { user } } = await supabase.auth.getUser();
    const { data: run, error: runErr } = await supabase
      .from("core_payroll_runs")
      .insert({
        period_start: periodStart,
        period_end: periodEnd,
        payment_date: paymentDate || null,
        status: "draft",
        total_amount: subtotal,
        operators_count: byOp.size,
        work_entries_count: valid.length,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      })
      .select()
      .single();
    if (runErr || !run) { toast({ title: "Error creando nómina", description: runErr?.message, variant: "destructive" }); return; }

    // Operator lines + links + update work entries
    for (const [opId, es] of byOp.entries()) {
      const sub = es.reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0);
      const { data: line, error: lineErr } = await supabase
        .from("core_payroll_operator_lines")
        .insert({
          payroll_run_id: run.id,
          operator_id: opId,
          operator_name_snapshot: es[0].operator_name_snapshot,
          total_processes: es.length,
          subtotal_amount: sub,
          total_amount: sub,
          status: "pending_review",
        })
        .select()
        .single();
      if (lineErr || !line) continue;

      const links = es.map(e => ({
        payroll_run_id: run.id,
        payroll_operator_line_id: line.id,
        work_entry_id: e.id,
        operator_id: opId,
        amount: Number(e.payroll_amount ?? 0),
        currency: e.currency ?? "USD",
      }));
      await supabase.from("core_payroll_work_entry_links").insert(links);
      await supabase
        .from("core_production_work_entries")
        .update({ payroll_status: "included_in_payroll" })
        .in("id", es.map(e => e.id));
    }

    await logCoreAudit({ table: "core_payroll_runs", recordId: run.id, action: "payroll_generated", newValue: { period_start: periodStart, period_end: periodEnd, total: subtotal, operators: byOp.size, entries: valid.length } });

    toast({ title: "Nómina generada", description: `${run.payroll_code} — ${byOp.size} operarios, ${valid.length} trabajos` });
    setGenOpen(false);
    await loadAll();
    setOpenRunId(run.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Nómina de Producción</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cierre semanal de trabajos escaneados. Cierre: jueves · Pago: viernes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refrescar
          </Button>
          <Button onClick={() => setGenOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Generar nómina semanal
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="Total pendiente semana" value={fmt(kpis.totalPendingThisWeek)} />
        <KpiCard icon={DollarSign} label="Total acumulado (todo lo pendiente)" value={fmt(kpis.totalPendingAll)} tone={kpis.totalPendingAll > 0 ? "warn" : "default"} />
        <KpiCard icon={Users} label="Operarios pendientes" value={String(kpis.operatorsPending)} />
        <KpiCard icon={ListChecks} label="Trabajos pendientes" value={String(kpis.processesCount)} />
        <KpiCard icon={AlertTriangle} label="Trabajos sin tarifa" value={String(kpis.missing)} tone={kpis.missing > 0 ? "warn" : "default"} />
        <KpiCard icon={CheckCircle2} label="Nóminas aprobadas" value={String(kpis.approved)} />
        <KpiCard icon={Wallet} label="Nóminas pagadas" value={String(kpis.paid)} />
        <KpiCard icon={FileText} label="Próximo pago" value={formatDMY(week.payment)} />
        <KpiCard icon={FileText} label="Semana actual" value={`${formatDMY(week.start)} → ${formatDMY(week.end)}`} />
      </div>

      <Tabs defaultValue="operators" className="w-full">
        <TabsList>
          <TabsTrigger value="operators">Por operario ({operatorSummaries.length})</TabsTrigger>
          <TabsTrigger value="runs">Nóminas</TabsTrigger>
          <TabsTrigger value="pending">Trabajos pendientes ({pendingEntries.length})</TabsTrigger>
          <TabsTrigger value="missing">Sin tarifa ({kpis.missing})</TabsTrigger>
        </TabsList>

        <TabsContent value="operators">
          <OperatorsPendingPanel summaries={operatorSummaries} totalAll={kpis.totalPendingAll} />
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader><CardTitle className="text-base">Nóminas generadas</CardTitle></CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay nóminas generadas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Operarios</TableHead>
                      <TableHead>Trabajos</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.payroll_code}</TableCell>
                        <TableCell className="text-sm">{formatDMY(r.period_start)} → {formatDMY(r.period_end)}</TableCell>
                        <TableCell className="text-sm">{r.payment_date ? formatDMY(r.payment_date) : "—"}</TableCell>
                        <TableCell>{r.operators_count}</TableCell>
                        <TableCell>{r.work_entries_count}</TableCell>
                        <TableCell>{fmt(r.total_amount, r.currency)}</TableCell>
                        <TableCell><StatusBadge s={r.status} /></TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => setOpenRunId(r.id)}>Abrir</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <WorkEntryTable entries={pendingEntries} />
        </TabsContent>

        <TabsContent value="missing">
          <WorkEntryTable entries={missingRateEntries} showRateActions />
        </TabsContent>
      </Tabs>

      {/* Generate dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar nómina semanal</DialogTitle>
            <DialogDescription>Selecciona el rango. Cierre viernes→jueves por defecto.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Inicio</Label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label>Fin</Label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
            <div>
              <Label>Pago</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancelar</Button>
            <Button onClick={generatePayroll}>Generar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {openRunId && (
        <RunDetailDialog runId={openRunId} onClose={() => setOpenRunId(null)} onChange={loadAll} />
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "warn" | "default" }) {
  return (
    <Card className={tone === "warn" ? "border-amber-300" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        <p className="text-lg font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function WorkEntryTable({ entries, showRateActions }: { entries: WorkEntry[]; showRateActions?: boolean }) {
  if (entries.length === 0) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Sin trabajos.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Proceso</TableHead>
              <TableHead>Operario</TableHead>
              <TableHead>Tarifa</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">{formatDMY(e.created_at)}</TableCell>
                <TableCell className="font-mono text-xs">{e.unit_code}</TableCell>
                <TableCell className="text-sm">{e.process_name}</TableCell>
                <TableCell className="text-sm">{e.operator_name_snapshot ?? "—"}</TableCell>
                <TableCell>{fmt(e.rate_snapshot, e.currency ?? "USD")}</TableCell>
                <TableCell>{fmt(e.payroll_amount, e.currency ?? "USD")}</TableCell>
                <TableCell><StatusBadge s={e.payroll_status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OperatorsPendingPanel({
  summaries,
  totalAll,
}: {
  summaries: Array<{
    operatorId: string;
    name: string;
    entries: WorkEntry[];
    total: number;
    byProcess: Map<string, { count: number; total: number }>;
    byUnit: Set<string>;
  }>;
  totalAll: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (summaries.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Sin trabajos pendientes por operario.</CardContent></Card>;
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Pendientes por operario (aún sin nómina)</CardTitle>
        <span className="text-sm font-bold">Total: {fmt(totalAll)}</span>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operario</TableHead>
              <TableHead className="text-right">Trabajos</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead>Procesos</TableHead>
              <TableHead className="text-right">Total USD</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map(op => {
              const procs = Array.from(op.byProcess.entries())
                .map(([n, v]) => `${n} ×${v.count}`)
                .join(" · ");
              const expanded = openId === op.operatorId;
              return [
                <TableRow key={op.operatorId}>
                  <TableCell className="font-medium">{op.name}</TableCell>
                  <TableCell className="text-right">{op.entries.length}</TableCell>
                  <TableCell className="text-right">{op.byUnit.size}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{procs}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(op.total)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setOpenId(expanded ? null : op.operatorId)}>
                      {expanded ? "Ocultar" : "Detalle"}
                    </Button>
                  </TableCell>
                </TableRow>,
                expanded ? (
                  <TableRow key={op.operatorId + "-d"}>
                    <TableCell colSpan={6} className="bg-muted/30 p-0">
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {Array.from(op.byProcess.entries()).map(([n, v]) => (
                            <div key={n} className="rounded border bg-background px-3 py-2">
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{n}</div>
                              <div className="text-sm font-bold">{v.count} trabajos · {fmt(v.total)}</div>
                            </div>
                          ))}
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Unidad</TableHead>
                              <TableHead>Proceso</TableHead>
                              <TableHead className="text-right">Tarifa</TableHead>
                              <TableHead className="text-right">Monto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {op.entries.map(e => (
                              <TableRow key={e.id}>
                                <TableCell className="text-xs">{formatDMY(e.created_at)}</TableCell>
                                <TableCell className="font-mono text-xs">{e.unit_code}</TableCell>
                                <TableCell className="text-sm">{e.process_name}</TableCell>
                                <TableCell className="text-right">{fmt(e.rate_snapshot, e.currency ?? "USD")}</TableCell>
                                <TableCell className="text-right">{fmt(e.payroll_amount, e.currency ?? "USD")}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null,
              ];
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RunDetailDialog({ runId, onClose, onChange }: { runId: string; onClose: () => void; onChange: () => void }) {
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [lines, setLines] = useState<OperatorLine[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [entryLinks, setEntryLinks] = useState<any[]>([]);
  const [openLineId, setOpenLineId] = useState<string | null>(null);
  const [adjOpen, setAdjOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [printLineId, setPrintLineId] = useState<string | null>(null);

  // Adjust form
  const [adjType, setAdjType] = useState("bonus");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjNotes, setAdjNotes] = useState("");

  // Pay form
  const [payDate, setPayDate] = useState("");
  const [bcvRate, setBcvRate] = useState("");
  const [totalPaid, setTotalPaid] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payFile, setPayFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from("core_payroll_runs").select("*").eq("id", runId).single(),
      supabase.from("core_payroll_operator_lines").select("*").eq("payroll_run_id", runId).order("operator_name_snapshot"),
      supabase.from("core_payroll_adjustments").select("*").eq("payroll_run_id", runId),
      supabase.from("core_payroll_work_entry_links").select("*, work_entry:core_production_work_entries(*)").eq("payroll_run_id", runId),
    ]);
    if (r1.data) setRun(r1.data as PayrollRun);
    setLines((r2.data ?? []) as OperatorLine[]);
    setAdjustments((r3.data ?? []) as Adjustment[]);
    setEntryLinks(r4.data ?? []);
    if (r1.data) {
      setPayDate(r1.data.payment_date ?? "");
      setTotalPaid(String(r1.data.total_amount ?? ""));
    }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  async function recomputeLineAndRun(lineId: string) {
    // Recompute single line totals
    const lineAdj = adjustments.filter(a => a.payroll_operator_line_id === lineId);
    const adjSum = lineAdj.reduce((s, a) => {
      const sign = ["decrease", "penalty"].includes(a.adjustment_type) ? -1 : 1;
      return s + sign * Number(a.amount);
    }, 0);
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    const newTotal = Number(line.subtotal_amount) + adjSum;
    await supabase.from("core_payroll_operator_lines").update({
      adjustments_amount: adjSum,
      total_amount: newTotal,
      status: adjSum !== 0 ? "adjusted" : line.status,
    }).eq("id", lineId);
  }

  async function recomputeRunTotals() {
    const { data: ls } = await supabase.from("core_payroll_operator_lines").select("total_amount, adjustments_amount").eq("payroll_run_id", runId);
    const total = (ls ?? []).reduce((s, l) => s + Number(l.total_amount ?? 0), 0);
    const adj = (ls ?? []).reduce((s, l) => s + Number(l.adjustments_amount ?? 0), 0);
    await supabase.from("core_payroll_runs").update({ total_amount: total, adjustments_total: adj }).eq("id", runId);
  }

  async function transition(newStatus: string) {
    if (!run) return;
    if (newStatus === "paid" && run.status !== "approved") {
      toast({ title: "Debe aprobarse primero", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const patch: any = { status: newStatus };
    if (newStatus === "approved") {
      patch.approved_by = user?.id ?? null;
      patch.approved_at = new Date().toISOString();
    }
    if (newStatus === "review") {
      // nothing extra
    }
    const { error } = await supabase.from("core_payroll_runs").update(patch).eq("id", run.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    if (newStatus === "approved") {
      await supabase.from("core_payroll_operator_lines").update({ status: "approved" }).eq("payroll_run_id", run.id).neq("status", "cancelled");
    }
    await logCoreAudit({ table: "core_payroll_runs", recordId: run.id, action: `payroll_${newStatus}` });
    toast({ title: `Nómina ${newStatus}` });
    await load();
    onChange();
  }

  async function submitAdjustment() {
    if (!openLineId || !adjAmount || !adjReason.trim()) {
      toast({ title: "Faltan datos", description: "Tipo, monto y motivo son obligatorios.", variant: "destructive" });
      return;
    }
    const line = lines.find(l => l.id === openLineId);
    if (!line || !run) return;
    if (["approved", "paid", "cancelled"].includes(run.status) && run.status !== "approved") {
      toast({ title: "Estado no permite ajustes", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("core_payroll_adjustments").insert({
      payroll_run_id: run.id,
      payroll_operator_line_id: line.id,
      operator_id: line.operator_id,
      adjustment_type: adjType,
      amount: Number(adjAmount),
      reason: adjReason,
      notes: adjNotes || null,
      created_by: user?.id ?? null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await logCoreAudit({ table: "core_payroll_adjustments", recordId: line.id, action: "adjustment_added", newValue: { type: adjType, amount: adjAmount, reason: adjReason } });
    setAdjOpen(false);
    setAdjAmount(""); setAdjReason(""); setAdjNotes("");
    await load();
    await recomputeLineAndRun(line.id);
    await recomputeRunTotals();
    await load();
    onChange();
  }

  async function markAsPaid() {
    if (!run) return;
    if (run.status !== "approved") { toast({ title: "Debe estar aprobada", variant: "destructive" }); return; }
    if (!payDate) { toast({ title: "Falta fecha de pago", variant: "destructive" }); return; }
    const { data: { user } } = await supabase.auth.getUser();

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    if (payFile) {
      const path = `${run.id}/${Date.now()}-${payFile.name}`;
      const { error: upErr } = await supabase.storage.from("core-payroll-proofs").upload(path, payFile);
      if (upErr) { toast({ title: "Error subiendo comprobante", description: upErr.message, variant: "destructive" }); return; }
      fileUrl = path;
      fileName = payFile.name;
    }

    const { error: runErr } = await supabase.from("core_payroll_runs").update({
      status: "paid",
      payment_date: payDate,
      bcv_rate: bcvRate ? Number(bcvRate) : null,
      total_paid_amount: totalPaid ? Number(totalPaid) : run.total_amount,
      payment_notes: payNotes || null,
      paid_by: user?.id ?? null,
      paid_at: new Date().toISOString(),
    }).eq("id", run.id);
    if (runErr) { toast({ title: "Error", description: runErr.message, variant: "destructive" }); return; }

    await supabase.from("core_payroll_operator_lines").update({ status: "paid" }).eq("payroll_run_id", run.id).neq("status", "cancelled");

    // Mark linked work entries as paid
    const { data: links } = await supabase.from("core_payroll_work_entry_links").select("work_entry_id").eq("payroll_run_id", run.id);
    const ids = (links ?? []).map((l: any) => l.work_entry_id);
    if (ids.length > 0) {
      await supabase.from("core_production_work_entries").update({ payroll_status: "paid" }).in("id", ids);
    }

    if (fileUrl) {
      await supabase.from("core_payroll_payment_proofs").insert({
        payroll_run_id: run.id,
        file_url: fileUrl,
        file_name: fileName,
        amount_paid: totalPaid ? Number(totalPaid) : null,
        bcv_rate: bcvRate ? Number(bcvRate) : null,
        payment_reference: payRef || null,
        notes: payNotes || null,
        uploaded_by: user?.id ?? null,
      });
    }

    await logCoreAudit({ table: "core_payroll_runs", recordId: run.id, action: "payroll_paid", newValue: { date: payDate, bcv: bcvRate, total: totalPaid } });
    toast({ title: "Nómina marcada como pagada" });
    setPayOpen(false);
    await load();
    onChange();
  }

  function printable(lineId: string) { setPrintLineId(lineId); }

  if (!run) return null;

  const printLine = lines.find(l => l.id === printLineId);
  const printEntries = printLine ? entryLinks.filter(l => l.payroll_operator_line_id === printLine.id) : [];
  const printAdj = printLine ? adjustments.filter(a => a.payroll_operator_line_id === printLine.id) : [];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="font-mono">{run.payroll_code}</DialogTitle>
            <StatusBadge s={run.status} />
          </div>
          <DialogDescription>
            {run.period_start} → {run.period_end} · Pago: {run.payment_date ?? "—"} · Total: {fmt(run.total_amount, run.currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          {run.status === "draft" && <Button size="sm" variant="outline" onClick={() => transition("review")}>Enviar a revisión</Button>}
          {["draft", "review"].includes(run.status) && <Button size="sm" onClick={() => transition("approved")}>Aprobar</Button>}
          {run.status === "approved" && <Button size="sm" onClick={() => setPayOpen(true)}>Marcar como pagada</Button>}
          {run.status !== "cancelled" && run.status !== "paid" && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => transition("cancelled")}>Cancelar</Button>
          )}
        </div>

        <div className="mt-2">
          <h3 className="font-semibold mb-2 text-sm">Operarios</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operario</TableHead>
                <TableHead>Procesos</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Ajustes</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(l => {
                const hasAdj = adjustments.some(a => a.payroll_operator_line_id === l.id);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{l.operator_name_snapshot}</TableCell>
                    <TableCell>{l.total_processes}</TableCell>
                    <TableCell>{fmt(l.subtotal_amount, l.currency)}</TableCell>
                    <TableCell>
                      {fmt(l.adjustments_amount, l.currency)}
                      {hasAdj && <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-900">Ajuste aplicado</Badge>}
                    </TableCell>
                    <TableCell className="font-semibold">{fmt(l.total_amount, l.currency)}</TableCell>
                    <TableCell><StatusBadge s={l.status} /></TableCell>
                    <TableCell className="text-right space-x-1">
                      {!["paid", "cancelled"].includes(run.status) && (
                        <Button size="sm" variant="outline" onClick={() => { setOpenLineId(l.id); setAdjOpen(true); }}>
                          Ajuste
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => printable(l.id)}>
                        <Printer className="h-3.5 w-3.5 mr-1" /> Comprobante
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Adjustment dialog */}
        <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo ajuste</DialogTitle>
              <DialogDescription>El motivo es obligatorio. Disminución/penalización restan; el resto suma.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={adjType} onValueChange={setAdjType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Aumento</SelectItem>
                    <SelectItem value="decrease">Disminución</SelectItem>
                    <SelectItem value="correction">Corrección</SelectItem>
                    <SelectItem value="bonus">Bono</SelectItem>
                    <SelectItem value="penalty">Penalización</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monto</Label>
                <Input type="number" step="0.01" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} />
              </div>
              <div>
                <Label>Motivo *</Label>
                <Input value={adjReason} onChange={e => setAdjReason(e.target.value)} />
              </div>
              <div>
                <Label>Observaciones</Label>
                <Textarea value={adjNotes} onChange={e => setAdjNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjOpen(false)}>Cancelar</Button>
              <Button onClick={submitAdjustment}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pay dialog */}
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marcar como pagada</DialogTitle>
              <DialogDescription>Registra fecha, tasa BCV, monto pagado y comprobante.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha de pago *</Label>
                <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
              </div>
              <div>
                <Label>Tasa BCV</Label>
                <Input type="number" step="0.0001" value={bcvRate} onChange={e => setBcvRate(e.target.value)} />
              </div>
              <div>
                <Label>Total pagado</Label>
                <Input type="number" step="0.01" value={totalPaid} onChange={e => setTotalPaid(e.target.value)} />
              </div>
              <div>
                <Label>Referencia</Label>
                <Input value={payRef} onChange={e => setPayRef(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Comprobante (archivo)</Label>
                <Input type="file" onChange={e => setPayFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="col-span-2">
                <Label>Observaciones</Label>
                <Textarea value={payNotes} onChange={e => setPayNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
              <Button onClick={markAsPaid}>Confirmar pago</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Print receipt */}
        {printLine && (
          <Dialog open onOpenChange={() => setPrintLineId(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Comprobante semanal</DialogTitle>
              </DialogHeader>
              <div id="print-area" className="space-y-3 text-sm">
                <div className="border-b pb-2">
                  <p className="font-bold text-lg">{printLine.operator_name_snapshot}</p>
                  <p className="text-xs text-muted-foreground">Nómina {run.payroll_code} · {run.period_start} → {run.period_end}</p>
                  <p className="text-xs text-muted-foreground">Fecha de pago: {run.payment_date ?? "—"} {run.bcv_rate ? `· BCV ${run.bcv_rate}` : ""}</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Proceso</TableHead>
                      <TableHead>Tarifa</TableHead>
                      <TableHead>Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printEntries.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{l.work_entry?.created_at ? formatDMY(l.work_entry.created_at) : "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{l.work_entry?.unit_code}</TableCell>
                        <TableCell>{l.work_entry?.process_name}</TableCell>
                        <TableCell>{fmt(l.work_entry?.rate_snapshot, l.currency)}</TableCell>
                        <TableCell>{fmt(l.amount, l.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {printAdj.length > 0 && (
                  <div>
                    <p className="font-semibold mt-3">Ajustes</p>
                    <ul className="text-xs space-y-1">
                      {printAdj.map(a => (
                        <li key={a.id}>
                          <span className="capitalize">{a.adjustment_type}</span>: {fmt(a.amount)} — {a.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>{fmt(printLine.subtotal_amount, printLine.currency)}</span></div>
                  <div className="flex justify-between"><span>Ajustes</span><span>{fmt(printLine.adjustments_amount, printLine.currency)}</span></div>
                  <div className="flex justify-between font-bold text-base"><span>Total a pagar</span><span>{fmt(printLine.total_amount, printLine.currency)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Estado</span><span>{STATUS_BADGE[printLine.status]?.label ?? printLine.status}</span></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPrintLineId(null)}>Cerrar</Button>
                <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
