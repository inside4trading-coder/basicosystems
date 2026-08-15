import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatDMY } from "@/lib/dateUtils";
import { AlertTriangle } from "lucide-react";

export type MergeableRun = {
  id: string;
  payroll_code: string | null;
  period_start: string;
  period_end: string;
  status: string;
  total_amount: number;
  currency: string;
  work_entries_count: number;
  operators_count: number;
};

type LinkRow = { work_entry_id: string; operator_id: string; amount: number };

export function MergePayrollsDialog({
  open,
  onOpenChange,
  runs,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  runs: MergeableRun[];
  onMerged: () => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmUnpaid, setConfirmUnpaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState<{ target: LinkRow[]; source: LinkRow[] } | null>(null);

  const eligible = useMemo(
    () => runs.filter((r) => !["merged", "cancelled"].includes(r.status)),
    [runs],
  );
  const target = eligible.find((r) => r.id === targetId) ?? null;
  const source = eligible.find((r) => r.id === sourceId) ?? null;

  useEffect(() => {
    if (!open) {
      setTargetId(""); setSourceId(""); setReason(""); setConfirmUnpaid(false); setLinks(null);
    }
  }, [open]);

  useEffect(() => {
    if (!target || !source) { setLinks(null); return; }
    (async () => {
      const [t, s] = await Promise.all([
        supabase.from("core_payroll_work_entry_links").select("work_entry_id,operator_id,amount").eq("payroll_run_id", target.id),
        supabase.from("core_payroll_work_entry_links").select("work_entry_id,operator_id,amount").eq("payroll_run_id", source.id),
      ]);
      setLinks({ target: (t.data ?? []) as LinkRow[], source: (s.data ?? []) as LinkRow[] });
    })();
  }, [target, source]);

  const preview = useMemo(() => {
    if (!target || !source || !links) return null;
    const tIds = new Set(links.target.map((l) => l.work_entry_id));
    const dupes = links.source.filter((l) => tIds.has(l.work_entry_id)).length;
    const tTotal = links.target.reduce((s, l) => s + Number(l.amount ?? 0), 0);
    const sTotal = links.source.reduce((s, l) => s + Number(l.amount ?? 0), 0);
    const operators = new Set([...links.target, ...links.source].map((l) => l.operator_id)).size;
    return {
      dupes,
      tTotal,
      sTotal,
      total: tTotal + sTotal,
      entries: links.target.length + links.source.length - dupes,
      operators,
      periodStart: target.period_start < source.period_start ? target.period_start : source.period_start,
      periodEnd: target.period_end > source.period_end ? target.period_end : source.period_end,
    };
  }, [target, source, links]);

  const sourcePaid = source?.status === "paid";
  const targetPaid = target?.status === "paid";

  const submit = async () => {
    if (!target || !source) return;
    if (!reason.trim()) {
      toast({ title: "El motivo de fusión es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("core_merge_payrolls", {
      p_target_payroll_id: target.id,
      p_source_payroll_id: source.id,
      p_reason: reason.trim(),
      p_confirm_unpaid: confirmUnpaid,
    });
    setSaving(false);
    const res = data as { ok?: boolean; error?: string; target_payroll_code?: string; work_entries_count?: number; total_amount?: number } | null;
    if (error || !res?.ok) {
      toast({ title: "No se pudo fusionar", description: error?.message ?? res?.error ?? "Error desconocido", variant: "destructive" });
      return;
    }
    toast({
      title: "Nóminas fusionadas",
      description: `${res.target_payroll_code}: ${res.work_entries_count} trabajos, USD ${Number(res.total_amount ?? 0).toFixed(2)}`,
    });
    onMerged();
    onOpenChange(false);
  };

  const runLabel = (r: MergeableRun) =>
    `${r.payroll_code} · ${formatDMY(r.period_start)} → ${formatDMY(r.period_end)} · ${r.status}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fusionar nóminas</DialogTitle>
          <DialogDescription>
            Esta acción moverá los trabajos de la nómina origen hacia la nómina destino y dejará la nómina origen
            marcada como fusionada. No se borrarán trabajos ni historial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nómina destino *</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue placeholder="Selecciona destino" /></SelectTrigger>
                <SelectContent>
                  {eligible.filter((r) => r.id !== sourceId && r.status !== "paid").map((r) => (
                    <SelectItem key={r.id} value={r.id}>{runLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nómina origen *</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
                <SelectContent>
                  {eligible.filter((r) => r.id !== targetId).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{runLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {targetPaid && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              La nómina destino está pagada. No se puede fusionar sobre ella.
            </div>
          )}

          {target && source && preview && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p>Destino: <b>{target.payroll_code}</b> ({formatDMY(target.period_start)} → {formatDMY(target.period_end)})</p>
              <p>Origen: <b>{source.payroll_code}</b> ({formatDMY(source.period_start)} → {formatDMY(source.period_end)})</p>
              <p>Nuevo período consolidado: <b>{formatDMY(preview.periodStart)} → {formatDMY(preview.periodEnd)}</b></p>
              <p>Operarios incluidos: <b>{preview.operators}</b></p>
              <p>Trabajos totales: <b>{preview.entries}</b></p>
              <p>Total destino: <b>USD {preview.tTotal.toFixed(2)}</b></p>
              <p>Total origen: <b>USD {preview.sTotal.toFixed(2)}</b></p>
              <p>Total consolidado: <b>USD {preview.total.toFixed(2)}</b></p>
              {preview.dupes > 0 && (
                <p className="text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> {preview.dupes} trabajos repetidos: no se duplicarán.
                </p>
              )}
            </div>
          )}

          {sourcePaid && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm space-y-2">
              <p className="font-medium">La nómina origen figura como pagada.</p>
              <label className="flex items-start gap-2">
                <Checkbox checked={confirmUnpaid} onCheckedChange={(v) => setConfirmUnpaid(v === true)} />
                <span>Confirmo que esta nómina no fue pagada realmente y puede fusionarse.</span>
              </label>
            </div>
          )}

          <div>
            <Label>Motivo de fusión *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: se generaron dos nóminas para la misma semana operativa"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={saving || !target || !source || targetPaid || !reason.trim() || (sourcePaid && !confirmUnpaid)}
          >
            {saving ? "Fusionando..." : "Confirmar fusión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
