import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
import { useAdminData } from "@/hooks/useAdminData";
import { useAuth } from "@/hooks/useAuth";
import { ALL_IMPORTANCE, IMPORTANCE_LABEL, frequencyFromLabel } from "./adminConstants";
import type { ImportanceLevel, InstanceStatus, ObligationFrequency } from "@/types/admin";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

const templateSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  category: z.string().trim().nonempty("Categoría requerida"),
  provider: z.string().trim().max(120).optional().or(z.literal("")),
  frequency: z.string().trim().nonempty("Frecuencia requerida"),
  due_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
  importance: z.enum(["critica", "alta", "media", "baja"]),
  responsible: z.string().trim().max(120).optional().or(z.literal("")),
  payment_method: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const instanceSchema = z.object({
  period_label: z.string().trim().nonempty("Período requerido").max(60),
  due_date: z.string().nonempty("Fecha requerida"),
  amount: z.coerce.number().min(0, "Monto inválido"),
  currency: z.string().trim().nonempty(),
  status: z.enum(["pendiente", "proximo_vencer", "pagado", "vencido", "pausado", "anulado"]),
});

type TemplateInput = z.infer<typeof templateSchema>;
type InstanceInput = z.infer<typeof instanceSchema>;

const STATUS_OPTIONS: { value: InstanceStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "proximo_vencer", label: "Próximo a vencer" },
  { value: "pagado", label: "Pagado" },
  { value: "pausado", label: "Pausado" },
];

function suggestPeriod(date: Date): string {
  return date.toLocaleDateString("es-VE", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
}

export function CreateObligationSheet({ open, onOpenChange, onCreated }: Props) {
  const { fetchConfig, createObligation, createInstance } = useAdminData();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);

  // Config options
  const [categories, setCategories] = useState<string[]>([]);
  const [frequencies, setFrequencies] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [responsibles, setResponsibles] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<string[]>(["USD"]);

  // Step 1
  const [tpl, setTpl] = useState<TemplateInput>({
    name: "",
    category: "",
    provider: "",
    frequency: "",
    due_day: null,
    importance: "media",
    responsible: "",
    payment_method: "",
    notes: "",
  });

  // Step 2
  const today = useMemo(() => new Date(), []);
  const [inst, setInst] = useState<InstanceInput>({
    period_label: suggestPeriod(today),
    due_date: today.toISOString().slice(0, 10),
    amount: 0,
    currency: "USD",
    status: "pendiente",
  });

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSaving(false);
    setTpl({
      name: "",
      category: "",
      provider: "",
      frequency: "",
      due_day: null,
      importance: "media",
      responsible: "",
      payment_method: "",
      notes: "",
    });
    const t = new Date();
    setInst({
      period_label: suggestPeriod(t),
      due_date: t.toISOString().slice(0, 10),
      amount: 0,
      currency: "USD",
      status: "pendiente",
    });

    Promise.all([
      fetchConfig("obligation_category"),
      fetchConfig("frequency"),
      fetchConfig("payment_method"),
      fetchConfig("responsible").catch(() => []),
      fetchConfig("currency"),
    ]).then(([cats, freqs, pms, resps, curs]) => {
      setCategories(cats.map((c) => c.value));
      setFrequencies(freqs.map((f) => f.value));
      setPaymentMethods(pms.map((p) => p.value));
      setResponsibles(resps.map((r) => r.value));
      const list = curs.map((c) => c.value);
      setCurrencies(list.length ? list : ["USD"]);
    });
  }, [open, fetchConfig]);

  // Auto-update due_date when due_day changes (recurring) for current month
  useEffect(() => {
    if (!tpl.due_day) return;
    const d = new Date();
    d.setDate(Math.min(tpl.due_day, 28));
    setInst((prev) => ({
      ...prev,
      due_date: d.toISOString().slice(0, 10),
      period_label: suggestPeriod(d),
    }));
  }, [tpl.due_day]);

  const goStep2 = () => {
    const parsed = templateSchema.safeParse(tpl);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa los campos");
      return;
    }
    setStep(2);
  };

  const handleSave = async () => {
    const t = templateSchema.safeParse(tpl);
    if (!t.success) {
      toast.error(t.error.issues[0]?.message ?? "Revisa la plantilla");
      setStep(1);
      return;
    }
    const i = instanceSchema.safeParse(inst);
    if (!i.success) {
      toast.error(i.error.issues[0]?.message ?? "Revisa la instancia");
      return;
    }

    setSaving(true);
    try {
      const obligation = await createObligation({
        name: t.data.name,
        category: t.data.category,
        provider: t.data.provider || "",
        frequency: frequencyFromLabel(t.data.frequency) as ObligationFrequency,
        due_day: t.data.due_day ?? null,
        importance: t.data.importance,
        responsible: t.data.responsible || "",
        payment_method: t.data.payment_method || "",
        notes: t.data.notes || "",
        amount: i.data.amount,
        currency: i.data.currency,
        status: "active",
        created_by: user?.email ?? "",
      });

      await createInstance({
        obligation_id: obligation.id,
        period_label: i.data.period_label,
        due_date: i.data.due_date,
        amount: i.data.amount,
        currency: i.data.currency,
        status: i.data.status,
        notes: "",
      });

      toast.success("Obligación creada correctamente");
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al crear la obligación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl font-black">Nueva obligación</SheetTitle>
          <SheetDescription>
            Paso {step} de 2 — {step === 1 ? "Datos de la plantilla" : "Primera instancia"}
          </SheetDescription>
        </SheetHeader>

        {step === 1 && (
          <div className="mt-6 space-y-3">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={tpl.name}
                onChange={(e) => setTpl({ ...tpl, name: e.target.value })}
                placeholder="Ej. SENIAT IVA mensual"
                maxLength={120}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría *</Label>
                <Select value={tpl.category} onValueChange={(v) => setTpl({ ...tpl, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="provider">Proveedor / Entidad</Label>
                <Input
                  id="provider"
                  value={tpl.provider ?? ""}
                  onChange={(e) => setTpl({ ...tpl, provider: e.target.value })}
                  maxLength={120}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frecuencia *</Label>
                <Select value={tpl.frequency} onValueChange={(v) => setTpl({ ...tpl, frequency: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {frequencies.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="due_day">Día de vencimiento (1-31)</Label>
                <Input
                  id="due_day"
                  type="number"
                  min={1}
                  max={31}
                  value={tpl.due_day ?? ""}
                  onChange={(e) =>
                    setTpl({ ...tpl, due_day: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Importancia *</Label>
                <Select
                  value={tpl.importance}
                  onValueChange={(v) => setTpl({ ...tpl, importance: v as ImportanceLevel })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_IMPORTANCE.map((i) => (
                      <SelectItem key={i} value={i}>{IMPORTANCE_LABEL[i]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsable</Label>
                {responsibles.length > 0 ? (
                  <Select
                    value={tpl.responsible ?? ""}
                    onValueChange={(v) => setTpl({ ...tpl, responsible: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {responsibles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={tpl.responsible ?? ""}
                    onChange={(e) => setTpl({ ...tpl, responsible: e.target.value })}
                    placeholder="Nombre del responsable"
                    maxLength={120}
                  />
                )}
              </div>
            </div>

            <div>
              <Label>Método de pago</Label>
              <Select
                value={tpl.payment_method ?? ""}
                onValueChange={(v) => setTpl({ ...tpl, payment_method: v })}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={tpl.notes ?? ""}
                onChange={(e) => setTpl({ ...tpl, notes: e.target.value })}
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="brand" onClick={goStep2}>
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 space-y-3">
            <div className="kpi-card !p-3 !shadow-none bg-muted/30">
              <div className="text-xs uppercase font-bold text-muted-foreground">Plantilla</div>
              <div className="font-bold">{tpl.name}</div>
              <div className="text-xs text-muted-foreground">
                {tpl.category} · {tpl.frequency} · {IMPORTANCE_LABEL[tpl.importance]}
              </div>
            </div>

            <div>
              <Label htmlFor="period">Período *</Label>
              <Input
                id="period"
                value={inst.period_label}
                onChange={(e) => setInst({ ...inst, period_label: e.target.value })}
                placeholder="Ej. Abril 2026"
                maxLength={60}
              />
            </div>

            <div>
              <Label htmlFor="due_date">Fecha de vencimiento *</Label>
              <Input
                id="due_date"
                type="date"
                value={inst.due_date}
                onChange={(e) => setInst({ ...inst, due_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={inst.amount}
                  onChange={(e) => setInst({ ...inst, amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={inst.currency} onValueChange={(v) => setInst({ ...inst, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Estado inicial</Label>
              <Select
                value={inst.status}
                onValueChange={(v) => setInst({ ...inst, status: v as InstanceStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
                <ChevronLeft className="h-4 w-4" /> Atrás
              </Button>
              <Button variant="brand" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear obligación
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
