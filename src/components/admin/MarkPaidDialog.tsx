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
import { useAdminScope } from "@/contexts/AdminScope";
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
const MAX_FILES = 10;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

export function MarkPaidDialog({ instance, open, onOpenChange, onSaved }: Props) {
  const { markAsPaid, updateInstance } = useAdminData();
  const { storagePrefix } = useAdminScope();
  const { user } = useAuth();
  const [paidBy, setPaidBy] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [actualAmount, setActualAmount] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isVariable = !instance?.amount || instance.amount <= 0;
  const existingProofs = instance?.payment_proof_urls ?? [];

  useEffect(() => {
    if (open) {
      setPaidBy(user?.email ?? "");
      setReference("");
      setPaidAt(new Date().toISOString().slice(0, 10));
      setActualAmount("");
      setFiles([]);
    }
  }, [open, user?.email]);

  if (!instance) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    if (!incoming.length) return;
    const valid: File[] = [];
    for (const f of incoming) {
      if (!ALLOWED.includes(f.type)) {
        toast.error(`${f.name}: formato no permitido`);
        continue;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name}: archivo muy grande (máx ${MAX_FILE_MB}MB)`);
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => {
      const merged = [...prev, ...valid].slice(0, MAX_FILES);
      if (prev.length + valid.length > MAX_FILES) {
        toast.error(`Máximo ${MAX_FILES} archivos por pago`);
      }
      return merged;
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadAll = async (instanceId: string): Promise<string[]> => {
    const paths: string[] = [];
    for (const f of files) {
      const ext = f.name.split(".").pop() ?? "bin";
      const path = `${storagePrefix}${instanceId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("admin-payments")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (upErr) throw upErr;
      paths.push(path);
    }
    return paths;
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
      const newPaths = await uploadAll(instance.id);
      await markAsPaid(
        instance.id,
        parsed.data.paidBy,
        parsed.data.reference ?? "",
        newPaths,
        existingProofs ?? [],
      );
      toast.success("Obligación marcada como pagada");
      onSaved();
      onOpenChange(false);
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
          {isVariable && (
            <div>
              <Label htmlFor="actualAmount">Monto pagado * <span className="text-xs font-normal text-muted-foreground">({instance.currency})</span></Label>
              <Input
                id="actualAmount"
                type="number"
                step="0.01"
                min={0}
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                placeholder="Ej. 150.00"
              />
            </div>
          )}
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
            <Label>Comprobantes (imagen o PDF)</Label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="w-full justify-start"
              disabled={files.length >= MAX_FILES}
            >
              <Paperclip className="h-4 w-4" />
              {files.length === 0 ? "Adjuntar comprobantes" : "Agregar otro comprobante"}
            </Button>
            {files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <span className="truncate">{f.name}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {existingProofs && existingProofs.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Ya hay {existingProofs.length} comprobante{existingProofs.length === 1 ? "" : "s"} guardado{existingProofs.length === 1 ? "" : "s"}. Los nuevos se agregarán.
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Máx {MAX_FILES} archivos · {MAX_FILE_MB}MB c/u. Opcional.</p>
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
