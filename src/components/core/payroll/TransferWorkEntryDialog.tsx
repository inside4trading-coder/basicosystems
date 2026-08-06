import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

export type TransferableWorkEntry = {
  id: string;
  unit_code: string | null;
  process_name: string | null;
  operator_id: string | null;
  operator_name_snapshot: string | null;
  payroll_amount: number | null;
  currency: string | null;
};

type Operator = { id: string; first_name: string | null; last_name: string | null; alias: string | null };

function opName(o: Operator) {
  const n = `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim();
  return n || o.alias || "Operario";
}

export function TransferWorkEntryDialog({
  entry,
  onClose,
  onTransferred,
}: {
  entry: TransferableWorkEntry | null;
  onClose: () => void;
  onTransferred: () => void;
}) {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [newOperatorId, setNewOperatorId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setNewOperatorId("");
    setReason("");
    (async () => {
      const { data } = await supabase
        .from("core_factory_operators")
        .select("id,first_name,last_name,alias")
        .eq("status", "active")
        .order("first_name");
      setOperators((data ?? []) as Operator[]);
    })();
  }, [entry]);

  if (!entry) return null;

  const amount = `${entry.currency ?? "USD"} ${Number(entry.payroll_amount ?? 0).toFixed(2)}`;

  const submit = async () => {
    if (!newOperatorId) {
      toast({ title: "Selecciona el nuevo operario", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "El motivo de transferencia es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("core_transfer_work_entry", {
      p_work_entry_id: entry.id,
      p_new_operator_id: newOperatorId,
      p_reason: reason.trim(),
    });
    setSaving(false);
    const res = data as { ok?: boolean; error?: string; new_operator_name?: string } | null;
    if (error || !res?.ok) {
      toast({
        title: "No se pudo transferir",
        description: error?.message ?? res?.error ?? "Error desconocido",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Trabajo transferido",
      description: `Ahora está adjudicado a ${res.new_operator_name ?? "el nuevo operario"}.`,
    });
    onTransferred();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferir trabajo</DialogTitle>
          <DialogDescription>
            Solo cambia la adjudicación de nómina. El escaneo, la unidad y el avance de producción no se modifican.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Operario actual</Label>
              <div className="text-sm font-medium">{entry.operator_name_snapshot ?? "Sin operario"}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Monto actual</Label>
              <div className="text-sm font-bold">{amount}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Unidad / QR</Label>
              <div className="text-sm font-mono break-all">{entry.unit_code ?? "—"}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Proceso</Label>
              <div className="text-sm">{entry.process_name ?? "—"}</div>
            </div>
          </div>

          <div>
            <Label>Nuevo operario *</Label>
            <Select value={newOperatorId} onValueChange={setNewOperatorId}>
              <SelectTrigger><SelectValue placeholder="Selecciona operario" /></SelectTrigger>
              <SelectContent>
                {operators
                  .filter((o) => o.id !== entry.operator_id)
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id}>{opName(o)}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Motivo de transferencia *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: el escaneo se hizo con el operario equivocado"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Transfiriendo..." : "Confirmar transferencia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
