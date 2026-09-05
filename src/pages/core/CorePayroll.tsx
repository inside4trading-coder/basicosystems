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
import { Wallet, Plus, CheckCircle2, AlertTriangle, FileText, Printer, RefreshCw, DollarSign, Users, ListChecks, Merge } from "lucide-react";
import { formatDMY } from "@/lib/dateUtils";
import { getCurrentPayrollWeek } from "@/lib/corePayrollWeek";
import { TransferWorkEntryDialog } from "@/components/core/payroll/TransferWorkEntryDialog";
import { generatePayrollReceiptPdf } from "@/lib/corePayrollReceiptPdf";

import { GeneratePayrollDialog } from "@/components/core/payroll/GeneratePayrollDialog";
import { MergePayrollsDialog } from "@/components/core/payroll/MergePayrollsDialog";



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
  merged_into_payroll_id: string | null;
  merged_at: string | null;
  merged_reason: string | null;
  merge_metadata: any;
  is_merged_period: boolean;
  generated_by_system?: boolean | null;
};

type AutoCloseRun = {
  period_start: string;
  period_end: string;
  status: string;
  message: string | null;
  finished_at: string | null;
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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-muted text-foreground" },
  review: { label: "En revisión", className: "bg-amber-100 text-amber-900" },
  approved: { label: "Aprobada", className: "bg-blue-100 text-blue-900" },
  paid: { label: "Pagada", className: "bg-green-100 text-green-900" },
  cancelled: { label: "Cancelada", className: "bg-red-100 text-red-900" },
  merged: { label: "Fusionada", className: "bg-slate-200 text-slate-900" },
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
  const [mergeOpen, setMergeOpen] = useState(false);
  const week = useMemo(() => getCurrentPayrollWeek(), []);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [transferEntry, setTransferEntry] = useState<WorkEntry | null>(null);



  const [autoClose, setAutoClose] = useState<AutoCloseRun | null>(null);


  const loadAll = useCallback(async () => {
    setLoading(true);
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from("core_payroll_runs").select("*").order("period_start", { ascending: false }),
      supabase.from("core_production_work_entries").select("*").eq("payroll_status", "pending").order("created_at", { ascending: false }),
      supabase.from("core_production_work_entries").select("*").eq("payroll_status", "missing_rate").order("created_at", { ascending: false }),
      supabase.from("core_payroll_auto_close_runs").select("period_start,period_end,status,message,finished_at,created_at").order("period_start", { ascending: false }).limit(1),
    ]);
    if (r1.error) toast({ title: "Error cargando nóminas", description: r1.error.message, variant: "destructive" });
    setRuns((r1.data ?? []) as PayrollRun[]);
    setPendingEntries((r2.data ?? []) as WorkEntry[]);
    setMissingRateEntries((r3.data ?? []) as WorkEntry[]);
    setAutoClose(((r4.data ?? [])[0] ?? null) as AutoCloseRun | null);
    setLoading(false);
  }, []);


  useEffect(() => { loadAll(); }, [loadAll]);

  // KPIs
  const kpis = useMemo(() => {
    const activeRuns = runs.filter(r => !["cancelled", "merged"].includes(r.status));
    const currentRun = activeRuns.find(r => r.period_start === week.start && r.period_end === week.end);
    const inWeek = (e: WorkEntry) => {
      const d = (e.created_at ?? "").slice(0, 10);
      return d >= week.start && d <= week.end;
    };
    const totalPendingThisWeek = pendingEntries.filter(inWeek).reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0);
    const totalPendingAll = pendingEntries.reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0);
    const operatorsPending = new Set(pendingEntries.filter(e => e.operator_id).map(e => e.operator_id!)).size;
    const approved = activeRuns.filter(r => r.status === "approved").length;
    const paid = activeRuns.filter(r => r.status === "paid").length;
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




  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="num text-2xl font-black tracking-tight">Nómina de Producción</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cierre semanal de trabajos escaneados. Cierre automático: jueves 11:59 pm (hora Venezuela) · Pago: viernes.
          </p>
          {autoClose && (
            <p className="text-xs text-muted-foreground mt-1">
              Último cierre automático: {formatDMY(autoClose.period_start)} → {formatDMY(autoClose.period_end)} ·{" "}
              {autoClose.status === "created"
                ? "nómina generada"
                : autoClose.status === "skipped_existing"
                ? "ya existía nómina"
                : autoClose.status === "skipped_empty"
                ? "sin trabajos pendientes"
                : autoClose.status}
              {autoClose.message ? ` — ${autoClose.message}` : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refrescar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
            <Merge className="h-4 w-4 mr-1" /> Fusionar
          </Button>
          <Button onClick={() => setGenOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Generar nómina semanal
          </Button>
        </div>
      </div>


      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="Total pendiente (sin nominar)" value={fmt(kpis.totalPendingAll)} tone={kpis.totalPendingAll > 0 ? "warn" : "default"} />

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
          <OperatorsPendingPanel
            summaries={operatorSummaries}
            totalAll={kpis.totalPendingAll}
            onTransfer={setTransferEntry}
          />
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
                    {runs.map(r => {
                      const mergedInto = r.merged_into_payroll_id
                        ? runs.find(x => x.id === r.merged_into_payroll_id)?.payroll_code ?? "otra nómina"
                        : null;
                      const meta = (r.merge_metadata ?? {}) as Record<string, any>;
                      return (
                      <TableRow key={r.id} className={r.status === "merged" ? "opacity-70" : undefined}>
                        <TableCell className="font-mono text-xs">
                          {r.payroll_code}
                          {r.generated_by_system && (
                            <Badge variant="outline" className="ml-1 text-[10px]">Automática</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.status === "merged" ? (
                            <span className="text-muted-foreground">
                              {formatDMY(meta.original_period_start ?? r.period_start)} → {formatDMY(meta.original_period_end ?? r.period_end)}
                            </span>
                          ) : (
                            <>
                              {formatDMY(r.period_start)} → {formatDMY(r.period_end)}
                              {r.is_merged_period && (
                                <span className="block text-[11px] text-muted-foreground">
                                  Período fusionado: {formatDMY(r.period_start)} → {formatDMY(r.period_end)}
                                </span>
                              )}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{r.payment_date ? formatDMY(r.payment_date) : "—"}</TableCell>
                        <TableCell>{r.status === "merged" ? (meta.original_operators_count ?? 0) : r.operators_count}</TableCell>
                        <TableCell>{r.status === "merged" ? (meta.original_work_entries_count ?? 0) : r.work_entries_count}</TableCell>
                        <TableCell>
                          {r.status === "merged"
                            ? <span className="text-muted-foreground line-through">{fmt(Number(meta.original_total_amount ?? 0), r.currency)}</span>
                            : fmt(r.total_amount, r.currency)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge s={r.status} />
                          {mergedInto && (
                            <span className="block text-[11px] text-muted-foreground mt-0.5">Fusionada → {mergedInto}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => setOpenRunId(r.id)}>Abrir</Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>

                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <WorkEntryTable entries={pendingEntries} onTransfer={setTransferEntry} />
        </TabsContent>

        <TabsContent value="missing">
          <WorkEntryTable entries={missingRateEntries} showRateActions onTransfer={setTransferEntry} />
        </TabsContent>

      </Tabs>

      <GeneratePayrollDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        onGenerated={async (id) => { await loadAll(); setOpenRunId(id); }}
      />

      <MergePayrollsDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        runs={runs}
        onMerged={loadAll}
      />


      {openRunId && (
        <RunDetailDialog runId={openRunId} onClose={() => setOpenRunId(null)} onChange={loadAll} />
      )}

      <TransferWorkEntryDialog
        entry={transferEntry}
        onClose={() => setTransferEntry(null)}
        onTransferred={loadAll}
      />

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

function WorkEntryTable({ entries, showRateActions, onTransfer }: { entries: WorkEntry[]; showRateActions?: boolean; onTransfer?: (e: WorkEntry) => void }) {
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
              {onTransfer && <TableHead className="text-right">Acciones</TableHead>}
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
                {onTransfer && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!["pending", "missing_rate"].includes(e.payroll_status)}
                      title={
                        ["pending", "missing_rate"].includes(e.payroll_status)
                          ? "Transferir a otro operario"
                          : "Este trabajo ya está en una nómina cerrada. Requiere ajuste manual."
                      }
                      onClick={() => onTransfer(e)}
                    >
                      Transferir
                    </Button>
                  </TableCell>
                )}
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
  onTransfer,
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
  onTransfer?: (e: WorkEntry) => void;
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
                              {onTransfer && <TableHead className="text-right">Acciones</TableHead>}
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
                                {onTransfer && (
                                  <TableCell className="text-right">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!["pending", "missing_rate"].includes(e.payroll_status)}
                                      title={
                                        ["pending", "missing_rate"].includes(e.payroll_status)
                                          ? "Transferir a otro operario"
                                          : "Este trabajo ya está en una nómina cerrada. Requiere ajuste manual."
                                      }
                                      onClick={() => onTransfer(e)}
                                    >
                                      Transferir
                                    </Button>
                                  </TableCell>
                                )}
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
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [variantLabels, setVariantLabels] = useState<Record<string, string>>({});
  const [orderCodes, setOrderCodes] = useState<Record<string, string>>({});

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
    const links = (r4.data ?? []) as any[];
    setEntryLinks(links);

    // Enriquecer con producto / variante / OP (solo lectura, para el comprobante)
    const productIds = Array.from(new Set(links.map(l => l.work_entry?.core_product_id).filter(Boolean))) as string[];
    const variantIds = Array.from(new Set(links.map(l => l.work_entry?.core_variant_id).filter(Boolean))) as string[];
    const orderIds = Array.from(new Set(links.map(l => l.work_entry?.production_order_id).filter(Boolean))) as string[];
    const [p, v, o] = await Promise.all([
      productIds.length ? supabase.from("core_products").select("id, name").in("id", productIds) : Promise.resolve({ data: [] as any[] }),
      variantIds.length ? supabase.from("core_product_variants").select("id, variant_label, size, color").in("id", variantIds) : Promise.resolve({ data: [] as any[] }),
      orderIds.length ? supabase.from("core_production_orders").select("id, order_code").in("id", orderIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pm: Record<string, string> = {};
    (p.data ?? []).forEach((r: any) => { pm[r.id] = r.name; });
    const vm: Record<string, string> = {};
    (v.data ?? []).forEach((r: any) => {
      vm[r.id] = r.color && r.size ? `${r.color} / ${r.size}` : (r.variant_label ?? r.size ?? "");
    });
    const om: Record<string, string> = {};
    (o.data ?? []).forEach((r: any) => { om[r.id] = r.order_code; });
    setProductNames(pm);
    setVariantLabels(vm);
    setOrderCodes(om);

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

  function downloadReceipt(lineId: string) {
    if (!run) return;
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    const links = entryLinks.filter(l => l.payroll_operator_line_id === lineId);
    const rows = links.map((l: any) => ({
      scanned_at: l.work_entry?.created_at ?? null,
      order_code: l.work_entry?.production_order_id ? (orderCodes[l.work_entry.production_order_id] ?? null) : null,
      unit_code: l.work_entry?.unit_code ?? null,
      product_name: l.work_entry?.core_product_id ? (productNames[l.work_entry.core_product_id] ?? null) : null,
      variant_label: l.work_entry?.core_variant_id ? (variantLabels[l.work_entry.core_variant_id] ?? null) : null,
      process_name: l.work_entry?.process_name ?? null,
      rate: l.work_entry?.rate_snapshot ?? null,
      amount: l.amount ?? null,
    }));
    const adj = adjustments
      .filter(a => a.payroll_operator_line_id === lineId)
      .map(a => ({ adjustment_type: a.adjustment_type, amount: a.amount, reason: a.reason }));
    generatePayrollReceiptPdf(
      run,
      line,
      rows,
      adj,
      STATUS_BADGE[run.status]?.label ?? run.status
    );
  }


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
                      <Button size="sm" variant="ghost" onClick={() => printable(l.id)}>
                        Ver
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadReceipt(l.id)}>
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
                <Button variant="outline" onClick={() => downloadReceipt(printLine.id)}>
                  <Printer className="h-4 w-4 mr-1" /> Descargar PDF
                </Button>
                <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
              </DialogFooter>

            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
