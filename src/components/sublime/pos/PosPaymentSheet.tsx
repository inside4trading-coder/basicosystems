import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Money, bsAmount, refAmount, toRef } from "@/lib/posMoney";
import {
  POS_SALES_CHANNELS,
  posChannel,
  type PosSalesChannelId,
} from "@/lib/posSalesChannels";
import {
  POS_PAYMENT_METHODS,
  posMethod,
  type PosPaymentMethodId,
} from "@/lib/posPaymentMethods";

export interface PosPaymentLine {
  id: string;
  method: PosPaymentMethodId;
  amount: string;
  fields: Record<string, string>;
}

/** Etiqueta visible de la moneda de un método. */
export const currencyLabel = (c: "USD" | "VES") => (c === "USD" ? "REF" : "Bs.");

export const paidUsdOf = (payments: PosPaymentLine[], rate: number) =>
  payments.reduce(
    (a, p) => a + toRef(Number(p.amount) || 0, posMethod(p.method).currency, rate),
    0
  );

export function PosPaymentSheet({
  open,
  onOpenChange,
  total,
  rate,
  payments,
  setPayments,
  channel,
  setChannel,
  channelDetail,
  setChannelDetail,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  rate: number;
  payments: PosPaymentLine[];
  setPayments: (p: PosPaymentLine[]) => void;
  channel: PosSalesChannelId;
  setChannel: (c: PosSalesChannelId) => void;
  channelDetail: string;
  setChannelDetail: (d: string) => void;
  onConfirm: () => void;
}) {
  const paid = paidUsdOf(payments, rate);
  const missing = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);

  const [picker, setPicker] = useState<PosPaymentMethodId>("card");
  const [amount, setAmount] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const def = posMethod(picker);
  const suggested = def.currency === "USD" ? missing : missing * rate;
  const shownAmount = amount !== "" ? amount : suggested > 0 ? suggested.toFixed(2) : "";


  const selectMethod = (id: PosPaymentMethodId) => {
    setPicker(id);
    setAmount("");
    setFields({});
    setError(null);
  };

  const usePaymentMethod = () => {
    const value = Number(shownAmount);
    if (!value || value <= 0) {
      setError("Indica el monto del pago.");
      return;
    }
    const missingField = def.fields.find((f) => f.required && !(fields[f.id] ?? "").trim());
    if (missingField) {
      setError(`Falta ${missingField.label.toLowerCase()}.`);
      return;
    }
    setPayments([
      ...payments,
      { id: `pay-${Date.now()}`, method: picker, amount: String(value), fields },
    ]);
    setAmount("");
    setFields({});
    setError(null);
  };

  const channelDef = posChannel(channel);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight">Cobrar</DialogTitle>
        </DialogHeader>

        <Card className="p-5 rounded-2xl border-border/60 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total a cobrar</p>
            <Money value={total} rate={rate} size="xl" align="left" />
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Tasa BCV</p>
            <p className="num text-lg font-black tabular-nums">Bs. {bsAmount(1, rate)} / REF</p>
          </div>
        </Card>

        {/* Selector de método */}
        <div className="flex flex-wrap gap-2">
          {POS_PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => selectMethod(m.id)}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                picker === m.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
              <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                {currencyLabel(m.currency)}
              </span>
            </button>
          ))}
        </div>

        {/* Campos del método seleccionado */}
        <Card className="p-4 rounded-2xl border-border/60 space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold">
            {def.label}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Monto en {currencyLabel(def.currency)}</Label>
              <Input
                type="number"
                value={shownAmount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 text-base"
              />
              {def.currency === "VES" ? (
                <p className="text-[11px] text-muted-foreground">
                  Equivale a REF {refAmount((Number(shownAmount) || 0) / rate)}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Equivale a Bs. {bsAmount(Number(shownAmount) || 0, rate)}
                </p>
              )}
            </div>
            {def.fields.map((f) => (
              <div key={f.id} className="space-y-1.5">
                <Label className="text-xs">
                  {f.label}
                  {f.required ? " *" : ""}
                </Label>
                <Input
                  value={fields[f.id] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setFields({ ...fields, [f.id]: e.target.value })}
                  className="h-11"
                />
              </div>
            ))}
          </div>
          {error ? <p className="text-xs text-destructive font-semibold">{error}</p> : null}
          <Button className="w-full h-12 font-black" onClick={usePaymentMethod}>
            {payments.length === 0 ? (
              "USAR ESTE MÉTODO DE PAGO"
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                AÑADIR MÉTODO DE PAGO
              </>
            )}
          </Button>
        </Card>

        {/* Pagos registrados */}
        {payments.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold">Pagos</p>
            {payments.map((p, i) => {
              const d = posMethod(p.method);
              const ref = toRef(Number(p.amount) || 0, d.currency, rate);
              return (
                <Card key={p.id} className="p-3 rounded-xl border-border/60 flex items-center gap-3">
                  <span className="num text-sm font-black text-muted-foreground">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-foreground">{d.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[p.fields.bank, p.fields.terminal, p.fields.holder, p.fields.reference && `Ref. ${p.fields.reference}`]
                        .filter(Boolean)
                        .join(" · ") || "Sin datos adicionales"}
                    </p>
                  </div>
                  <Money value={ref} rate={rate} size="sm" />
                  <button
                    type="button"
                    onClick={() => setPayments(payments.filter((x) => x.id !== p.id))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Quitar pago"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Card>
              );
            })}
          </div>
        ) : null}

        <Separator />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Total label="Total" value={total} rate={rate} />
          <Total label="Pagado" value={paid} rate={rate} />
          <Total label="Faltante" value={missing} rate={rate} tone={missing > 0.009 ? "warn" : "ok"} />
          <Total label="Cambio" value={change} rate={rate} />
        </div>

        <Separator />

        {/* Canal / origen de la venta */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold">
            Origen de la venta
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={channel} onValueChange={(v) => setChannel(v as PosSalesChannelId)}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POS_SALES_CHANNELS.map((c) => (
                  <SelectItem key={c.id} value={c.id} disabled={c.systemAssigned}>
                    {c.label}
                    {c.systemAssigned ? " (asignado por el pedido)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {channelDef.requiresDetail ? (
              <Input
                value={channelDetail}
                onChange={(e) => setChannelDetail(e.target.value)}
                placeholder="Detalle del origen"
                className="h-11"
              />
            ) : (
              <p className="text-xs text-muted-foreground self-center">
                El origen es independiente del método de pago.
              </p>
            )}
          </div>
        </div>

        <Button
          size="lg"
          className="w-full h-14 text-base font-black"
          disabled={payments.length === 0 || missing > 0.009}
          onClick={onConfirm}
        >
          FINALIZAR VENTA
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Total({
  label,
  value,
  rate,
  tone,
}: {
  label: string;
  value: number;
  rate: number;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <Money value={value} rate={rate} size="md" align="left" tone={tone === "warn" ? "destructive" : "default"} />
    </div>
  );
}
