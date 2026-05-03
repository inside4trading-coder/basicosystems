import { useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, Paperclip, X } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
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

const MAX_FILE_MB = 10;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

export function MarkPaidDialog({ instance, open, onOpenChange, onSaved }: Props) {
  const { markAsPaid, updateInstance } = useAdminData();
  const { user } = useAuth();
  const [paidBy, setPaidBy] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [actualAmount, setActualAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isVariable = !instance?.amount || instance.amount <= 0;

  useEffect(() => {
    if (open) {
      setPaidBy(user?.email ?? "");
      setReference("");
      setPaidAt(new Date().toISOString().slice(0, 10));
      setActualAmount("");
      setFile(null);
    }
  }, [open, user?.email]);

  if (!instance) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      toast.error("Formato no permitido. Usa imagen o PDF.");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Archivo muy grande (máx ${MAX_FILE_MB}MB)`);
      return;
    }
    setFile(f);
  };

  const uploadProof = async (instanceId: string): Promise<string | undefined> => {
    if (!file) return undefined;
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${instanceId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("admin-payments")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    return path;
  };

  const handleSave = async () => {
    const parsed = schema.safeParse({ paidBy, reference, paidAt });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    if (isVariable) {
      const n = Number(actualAmount);
      if (!actualAmount || !Number.isFinite(n) || n <= 0) {
        toast.error("Ingresa el monto pagado");
        return;
      }
    }
    setSaving(true);
    try {
      if (isVariable) {
        await updateInstance(instance.id, { amount: Number(actualAmount) } as any);
      }
      const proofPath = await uploadProof(instance.id);
      await markAsPaid(instance.id, parsed.data.paidBy, parsed.data.reference ?? "", proofPath);
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
            <span className="font-bold">{isVariable ? "Variable" : fmtMoney(instance.amount, instance.currency)}</span>
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

          <div>
            <Label>Comprobante (imagen o PDF)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {!file ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                className="w-full justify-start"
              >
                <Paperclip className="h-4 w-4" />
                Adjuntar comprobante
              </Button>
            ) : (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Máx {MAX_FILE_MB}MB. Opcional.</p>
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
