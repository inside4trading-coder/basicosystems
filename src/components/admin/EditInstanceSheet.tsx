import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminData } from "@/hooks/useAdminData";
import { useAdminScope } from "@/contexts/AdminScope";
import type { ObligationInstance, InstanceStatus } from "@/types/admin";

interface Props {
  instance: ObligationInstance | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

const STATUSES: InstanceStatus[] = ["pendiente", "proximo_vencer", "pagado", "vencido", "pausado", "anulado"];

export function EditInstanceSheet({ instance, open, onOpenChange, onSaved }: Props) {
  const { updateInstance, updateInstanceAndFuture } = useAdminData();
  const { instances: INSTANCES_TABLE } = useAdminScope();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [applyToFuture, setApplyToFuture] = useState(false);

  const [periodLabel, setPeriodLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState<InstanceStatus>("pendiente");
  const [paidAt, setPaidAt] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!instance) return;
    setPeriodLabel(instance.period_label ?? "");
    setDueDate(instance.due_date?.slice(0, 10) ?? "");
    setAmount(String(instance.amount ?? 0));
    setCurrency(instance.currency ?? "USD");
    setStatus(instance.status);
    setPaidAt(instance.paid_at?.slice(0, 10) ?? "");
    setPaidBy(instance.paid_by ?? "");
    setPaymentRef(instance.payment_reference ?? "");
    setNotes(instance.notes ?? "");
    setApplyToFuture(false);
  }, [instance]);

  if (!instance) return null;

  const handleSave = async () => {
    if (!periodLabel.trim()) {
      toast.error("El título / período es obligatorio");
      return;
    }
    if (!dueDate) {
      toast.error("La fecha de vencimiento es obligatoria");
      return;
    }
    setSaving(true);
    try {
      const patch = {
        period_label: periodLabel.trim(),
        due_date: dueDate,
        amount: Number(amount) || 0,
        currency: currency.trim().toUpperCase() || "USD",
        status,
        paid_at: paidAt || null,
        paid_by: paidBy.trim(),
        payment_reference: paymentRef.trim(),
        notes: notes.trim(),
      } as Partial<ObligationInstance>;

      if (applyToFuture && instance.obligation_id) {
        const { bulkCount } = await updateInstanceAndFuture(
          instance.id,
          patch,
          instance.obligation_id,
          instance.due_date.slice(0, 10),
        );
        toast.success(
          bulkCount > 0
            ? `Actualizado este mes y ${bulkCount} mes${bulkCount === 1 ? "" : "es"} futuro${bulkCount === 1 ? "" : "s"}`
            : "Obligación actualizada (no había meses futuros editables)",
        );
      } else {
        await updateInstance(instance.id, patch);
        toast.success("Obligación actualizada");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      let futureCount = 0;
      if (applyToFuture && instance.obligation_id) {
        const { data: futureRows, error: futureErr } = await (supabase.from("admin_instances" as any) as any)
          .delete()
          .eq("obligation_id", instance.obligation_id)
          .gt("due_date", instance.due_date.slice(0, 10))
          .in("status", ["pendiente", "proximo_vencer", "pausado"])
          .select("id");
        if (futureErr) throw futureErr;
        futureCount = futureRows?.length ?? 0;
      }

      const { error } = await (supabase.from("admin_instances" as any) as any)
        .delete()
        .eq("id", instance.id);
      if (error) throw error;

      toast.success(
        applyToFuture
          ? `Eliminado este mes y ${futureCount} mes${futureCount === 1 ? "" : "es"} futuro${futureCount === 1 ? "" : "s"}`
          : "Obligación eliminada",
      );
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl font-black">Editar obligación</SheetTitle>
          <SheetDescription>
            {instance.obligation_name ?? "Instancia"} — modifica todos los campos.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="period_label">Título / Período</Label>
            <Input
              id="period_label"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="Ej. Enero 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="due_date">Vencimiento</Label>
              <Input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as InstanceStatus)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="variable_amount_edit"
              checked={Number(amount) === 0}
              onCheckedChange={(v) => setAmount(v ? "0" : "0.01")}
            />
            <Label htmlFor="variable_amount_edit" className="cursor-pointer text-sm font-normal">
              Sin monto fijo (variable, ej. impuestos)
            </Label>
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Monto</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={Number(amount) === 0 ? "" : amount}
                disabled={Number(amount) === 0}
                placeholder={Number(amount) === 0 ? "Variable" : ""}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Moneda</Label>
              <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paid_at">Pagado el</Label>
              <Input id="paid_at" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paid_by">Pagado por</Label>
              <Input id="paid_by" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment_ref">Referencia de pago</Label>
            <Input id="payment_ref" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="rounded-md border bg-muted/30 p-3 flex items-start gap-2.5">
            <Checkbox
              id="apply_future"
              checked={applyToFuture}
              onCheckedChange={(v) => setApplyToFuture(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="apply_future" className="cursor-pointer text-sm font-bold">
                Aplicar también a los meses futuros
              </Label>
              <p className="text-xs text-muted-foreground leading-snug">
                Al guardar: replica monto, moneda, notas y estado en las instancias futuras pendientes. Al eliminar: borra también esos meses futuros. No afecta meses ya pagados, vencidos o anulados.
              </p>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 flex-row justify-between gap-2 sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar esta obligación?</AlertDialogTitle>
                <AlertDialogDescription>
                  {applyToFuture
                    ? "Se eliminará este mes y todos los meses futuros pendientes de esta obligación. Esta acción es permanente."
                    : "Esta acción es permanente y no se puede deshacer."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Eliminando..." : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
