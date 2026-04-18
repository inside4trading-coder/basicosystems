import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminData } from "@/hooks/useAdminData";
import { useAuth } from "@/hooks/useAuth";
import type { ObligationInstance } from "@/types/admin";
import { fmtMoney } from "./adminConstants";

interface Props {
  instance: ObligationInstance | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

const schema = z.object({
  paidBy: z.string().trim().nonempty("Indica quién pagó").max(120),
  reference: z.string().trim().max(200).optional().or(z.literal("")),
  paidAt: z.string().nonempty("Selecciona la fecha"),
});

export function MarkPaidDialog({ instance, open, onOpenChange, onSaved }: Props) {
  const { markAsPaid } = useAdminData();
  const { user } = useAuth();
  const [paidBy, setPaidBy] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPaidBy(user?.email ?? "");
      setReference("");
      setPaidAt(new Date().toISOString().slice(0, 10));
    }
  }, [open, user?.email]);

  if (!instance) return null;

  const handleSave = async () => {
    const parsed = schema.safeParse({ paidBy, reference, paidAt });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSaving(true);
    try {
      await markAsPaid(instance.id, parsed.data.paidBy, parsed.data.reference ?? "");
      toast.success("Obligación marcada como pagada");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al marcar como pagada");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-status-success" />
            Marcar como pagada
          </DialogTitle>
          <DialogDescription>
            {instance.obligation_name} · {instance.period_label} ·{" "}
            <span className="font-bold">{fmtMoney(instance.amount, instance.currency)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="paidBy">Pagado por *</Label>
            <Input
              id="paidBy"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              placeholder="Nombre o email"
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="reference">Referencia de pago</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. TRX-2026-001"
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="paidAt">Fecha de pago *</Label>
            <Input id="paidAt" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="brand" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
