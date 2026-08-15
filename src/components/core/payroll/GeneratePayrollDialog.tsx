import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { logCoreAudit } from "@/lib/coreAudit";
import { formatDMY } from "@/lib/dateUtils";
import { getPayrollWeek, periodsOverlap } from "@/lib/corePayrollWeek";
import { AlertTriangle } from "lucide-react";

type ExistingRun = {
  id: string;
  payroll_code: string | null;
  period_start: string;
  period_end: string;
  status: string;
};

const WEEK_OPTIONS = [
  { value: "0", label: "Semana actual" },
  { value: "-1", label: "Semana anterior" },
  { value: "-2", label: "Hace 2 semanas" },
  { value: "1", label: "Semana siguiente" },
];

export function GeneratePayrollDialog({
  open,
  onOpenChange,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onGenerated: (runId: string) => void;
}) {
  const [offset, setOffset] = useState("0");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runs, setRuns] = useState<ExistingRun[]>([]);
  const [preview, setPreview] = useState<{ entries: number; operators: number; total: number } | null>(null);

  const week = useMemo(() => getPayrollWeek(Number(offset)), [offset]);

  const conflict = useMemo(() => {
    return runs.find(
      (r) =>
        !["cancelled", "merged"].includes(r.status) &&
        periodsOverlap(week.start, week.end, r.period_start, r.period_end),
    );
  }, [runs, week]);

  const load = useCallback(async () => {
    setLoading(true);
    setPreview(null);
    const [{ data: runsData }, { data: entries }] = await Promise.all([
      supabase.from("core_payroll_runs").select("id,payroll_code,period_start,period_end,status"),
      supabase
        .from("core_production_work_entries")
        .select("id,operator_id,payroll_amount")
        .eq("payroll_status", "pending")
        .gte("created_at", `${week.start}T00:00:00`)
        .lt("created_at", `${week.endExclusive}T00:00:00`),
    ]);
    setRuns((runsData ?? []) as ExistingRun[]);
    const valid = (entries ?? []).filter((e) => e.operator_id && Number(e.payroll_amount ?? 0) > 0);
    setPreview({
      entries: valid.length,
      operators: new Set(valid.map((e) => e.operator_id as string)).size,
      total: valid.reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0),
    });
    setLoading(false);
  }, [week.start, week.endExclusive]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const generate = async () => {
    if (conflict) return;
    setSaving(true);
    try {
      const { data: entries, error: entriesErr } = await supabase
        .from("core_production_work_entries")
        .select("*")
        .eq("payroll_status", "pending")
        .gte("created_at", `${week.start}T00:00:00`)
        .lt("created_at", `${week.endExclusive}T00:00:00`);
      if (entriesErr) throw new Error(entriesErr.message);

      // Excluir trabajos ya vinculados a cualquier nómina
      const ids = (entries ?? []).map((e) => e.id);
      const linked = new Set<string>();
      if (ids.length) {
        const { data: links } = await supabase
          .from("core_payroll_work_entry_links")
          .select("work_entry_id")
          .in("work_entry_id", ids);
        (links ?? []).forEach((l) => linked.add(l.work_entry_id as string));
      }
      const valid = (entries ?? []).filter(
        (e) => e.operator_id && Number(e.payroll_amount ?? 0) > 0 && !linked.has(e.id),
      );
      if (valid.length === 0) {
        toast({ title: "Sin trabajos para nominar", description: "No hay trabajos pendientes en el período.", variant: "destructive" });
        return;
      }

      const byOp = new Map<string, typeof valid>();
      valid.forEach((e) => {
        const arr = byOp.get(e.operator_id as string) ?? [];
        arr.push(e);
        byOp.set(e.operator_id as string, arr);
      });
      const subtotal = valid.reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0);

      const { data: { user } } = await supabase.auth.getUser();
      const { data: run, error: runErr } = await supabase
        .from("core_payroll_runs")
        .insert({
          period_start: week.start,
          period_end: week.end,
          payment_date: week.payment,
          status: "draft",
          total_amount: subtotal,
          operators_count: byOp.size,
          work_entries_count: valid.length,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select()
        .single();
      if (runErr || !run) throw new Error(runErr?.message ?? "No se pudo crear la nómina");

      for (const [opId, es] of byOp.entries()) {
        const sub = es.reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0);
        const { data: line } = await supabase
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
        if (!line) continue;
        await supabase.from("core_payroll_work_entry_links").insert(
          es.map((e) => ({
            payroll_run_id: run.id,
            payroll_operator_line_id: line.id,
            work_entry_id: e.id,
            operator_id: opId,
            amount: Number(e.payroll_amount ?? 0),
            currency: e.currency ?? "USD",
          })),
        );
        await supabase
          .from("core_production_work_entries")
          .update({ payroll_status: "included_in_payroll" })
          .in("id", es.map((e) => e.id));
      }

      await logCoreAudit({
        table: "core_payroll_runs",
        recordId: run.id,
        action: "payroll_generated",
        newValue: { period_start: week.start, period_end: week.end, payment_date: week.payment, total: subtotal, operators: byOp.size, entries: valid.length },
      });

      toast({ title: "Nómina generada", description: `${run.payroll_code} — ${byOp.size} operarios, ${valid.length} trabajos` });
      onOpenChange(false);
      onGenerated(run.id);
    } catch (err) {
      toast({ title: "Error creando nómina", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar nómina semanal</DialogTitle>
          <DialogDescription>
            Semana operativa viernes → jueves. El pago se realiza el viernes siguiente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Semana</Label>
            <Select value={offset} onValueChange={setOffset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEEK_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border p-3 text-sm space-y-1">
            <p>Se generará la nómina del período: <b>{formatDMY(week.start)} → {formatDMY(week.end)}</b></p>
            <p>Pago: <b>{formatDMY(week.payment)}</b></p>
            <p>Trabajos incluidos: <b>{loading ? "…" : preview?.entries ?? 0}</b></p>
            <p>Operarios: <b>{loading ? "…" : preview?.operators ?? 0}</b></p>
            <p>Total: <b>USD {(preview?.total ?? 0).toFixed(2)}</b></p>
          </div>

          {conflict && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Ya existe una nómina para ese período operativo</p>
                <p className="text-muted-foreground">
                  {conflict.payroll_code} ({formatDMY(conflict.period_start)} → {formatDMY(conflict.period_end)}){" "}
                  <Badge variant="outline" className="ml-1">{conflict.status}</Badge>
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={generate} disabled={saving || loading || !!conflict || (preview?.entries ?? 0) === 0}>
            {saving ? "Generando..." : "Confirmar y generar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
