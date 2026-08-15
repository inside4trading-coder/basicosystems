// Cancelar una prenda/unidad dentro de una OP.
// No borra procesos ni historial: solo marca la unidad como cancelled y mueve
// su reserva de partida hacia No Restock (RPC core_cancel_production_unit).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logCoreAudit } from "@/lib/coreAudit";

export type CancelUnitTarget = {
  id: string;
  unit_code: string;
  sku?: string | null;
  variant_sku?: string | null;
  size?: string | null;
  variant_label?: string | null;
  /** true si la unidad ya tiene procesos completados */
  hasCompletedProcesses?: boolean;
};

type Props = {
  unit: CancelUnitTarget | null;
  onOpenChange: (open: boolean) => void;
  onCancelled?: () => void | Promise<void>;
};

export function CancelProductionUnitDialog({ unit, onOpenChange, onCancelled }: Props) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (unit) { setReason(""); setNotes(""); }
  }, [unit?.id]);

  const submit = async () => {
    if (!unit) return;
    if (!reason.trim()) { toast.error("Motivo obligatorio"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("core_cancel_production_unit" as any, {
        p_unit_id: unit.id,
        p_reason: reason.trim(),
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      const res: any = data ?? {};
      await logCoreAudit({
        table: "core_production_units",
        recordId: unit.id,
        action: "cancel_unit",
        field: "status",
        oldValue: "activa",
        newValue: `cancelled · ${reason.trim()}`,
      });
      const moved = Number(res?.cost_moved ?? 0);
      toast.success(
        moved > 0
          ? `Prenda cancelada · $${moved.toFixed(2)} movidos a No Restock`
          : "Prenda cancelada",
      );
      onOpenChange(false);
      if (onCancelled) await onCancelled();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cancelar la prenda");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!unit} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar prenda de la OP</DialogTitle>
        </DialogHeader>
        {unit && (
          <div className="space-y-3">
            <div className="rounded-md border p-3 text-sm">
              <div className="font-mono font-semibold">{unit.unit_code}</div>
              <div className="text-xs text-muted-foreground">
                {unit.variant_sku ?? unit.sku ?? "—"} · {unit.size ?? unit.variant_label ?? "—"}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Esta prenda dejará de contar como pendiente de producción/inventario y su
              reserva se moverá a No Restock.
            </p>

            {unit.hasCompletedProcesses && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Esta prenda ya tenía procesos registrados. El historial se conservará.
                </span>
              </div>
            )}

            <div>
              <Label>Motivo *</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: No se fabricará / no restock"
              />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Volver
          </Button>
          <Button variant="destructive" onClick={submit} disabled={saving || !reason.trim()}>
            {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Ban className="h-3 w-3 mr-1" />}
            Confirmar cancelación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
