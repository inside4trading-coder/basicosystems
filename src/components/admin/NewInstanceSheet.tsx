import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";
import { z } from "zod";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdminData } from "@/hooks/useAdminData";
import type { InstanceStatus, Obligation } from "@/types/admin";

interface Props {
  obligation: Obligation;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

const schema = z.object({
  period_label: z.string().trim().nonempty("Período requerido").max(60),
  due_date: z.string().nonempty("Fecha requerida"),
  amount: z.coerce.number().min(0, "Monto inválido"),
  currency: z.string().trim().nonempty(),
  status: z.enum(["pendiente", "proximo_vencer", "pagado", "vencido", "pausado", "anulado"]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const STATUS_OPTIONS: { value: InstanceStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "proximo_vencer", label: "Próximo a vencer" },
  { value: "pagado", label: "Pagado" },
  { value: "pausado", label: "Pausado" },
];

function suggestNextPeriod(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("es-VE", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
}

function suggestNextDueDate(dueDay: number | null): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  if (dueDay) d.setDate(Math.min(dueDay, 28));
  return formatLocalDate(d);
}

export function NewInstanceSheet({ obligation, open, onOpenChange, onCreated }: Props) {
  const { createInstance } = useAdminData();
  const [period, setPeriod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState<InstanceStatus>("pendiente");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPeriod(suggestNextPeriod());
      setDueDate(suggestNextDueDate(obligation.due_day));
      setAmount(String(obligation.amount ?? 0));
      setCurrency(obligation.currency ?? "USD");
      setStatus("pendiente");
      setNotes("");
    }
  }, [open, obligation]);

  const handleSave = async () => {
    const parsed = schema.safeParse({
      period_label: period,
      due_date: dueDate,
      amount,
      currency,
      status,
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSaving(true);
    try {
      await createInstance({
        obligation_id: obligation.id,
        period_label: parsed.data.period_label,
        due_date: parsed.data.due_date,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        status: parsed.data.status,
        notes: parsed.data.notes ?? "",
      });
      toast.success("Instancia creada");
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al crear instancia");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nueva instancia</SheetTitle>
          <SheetDescription>{obligation.name}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="period">Período *</Label>
            <Input id="period" value={period} onChange={(e) => setPeriod(e.target.value)} maxLength={60} />
          </div>
          <div>
            <Label htmlFor="dueDate">Fecha de vencimiento *</Label>
            <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="variable_amount_new"
              checked={Number(amount) === 0}
              onCheckedChange={(v) => setAmount(v ? "0" : "0.01")}
            />
            <Label htmlFor="variable_amount_new" className="cursor-pointer text-sm font-normal">
              Sin monto fijo (variable, ej. impuestos)
            </Label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
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
            <div>
              <Label htmlFor="currency">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="VES">VES</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="status">Estado inicial</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as InstanceStatus)}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="brand" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Crear instancia
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
