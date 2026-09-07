import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Money, bsAmount, toRef } from "@/lib/posMoney";
import { POS_BANKS, posBankLabel } from "@/lib/posBanks";
import { posChannelButtonClass } from "@/lib/posChannelStyle";
import { posChannelLabel, type PosSalesChannelId } from "@/lib/posSalesChannels";
import {
  POS_PAYMENT_METHODS,
  posMethod,
  type PosPaymentMethodId,
} from "@/lib/posPaymentMethods";
import { POS_TAX_PCT } from "./usePosCart";
import { PosChannelPicker } from "./PosChannelPicker";

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
  channel: PosSalesChannelId | null;
  setChannel: (c: PosSalesChannelId | null) => void;
  channelDetail: string;
  setChannelDetail: (d: string) => void;
  onConfirm: () => void;
}) {
  const paid = paidUsdOf(payments, rate);
  const missing = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);

  const [picker, setPicker] = useState<PosPaymentMethodId | null>(null);
  const [amount, setAmount] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(true);

  const def = picker ? posMethod(picker) : null;
  const suggested = def ? (def.currency === "USD" ? missing : missing * rate) : 0;
  const shownAmount = amount !== "" ? amount : suggested > 0 ? suggested.toFixed(2) : "";

  const selectMethod = (id: PosPaymentMethodId) => {
    setPicker(id);
    setAmount("");
    setFields({});
    setError(null);
  };

  const usePaymentMethod = () => {
    if (!picker || !def) {
      setError("Selecciona un método de pago.");
      return;
    }
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
    setPicker(null);
    setAmount("");
    setFields({});
    setError(null);
    setAdding(false);
  };

  const canFinish = missing <= 0.009 && payments.length > 0 && channel !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight">Cobrar</DialogTitle>
        </DialogHeader>

        <Card className="p-5 rounded-2xl border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Amount label="Total" value={total} rate={rate} size="lg" />
          <Amount label="Pagado" value={paid} rate={rate} tone="primary" />
          <Amount label="Faltante" value={missing} rate={rate} tone={missing > 0 ? "destructive" : "muted"} />
          <Amount label="Cambio" value={change} rate={rate} tone={change > 0 ? "primary" : "muted"} />
          <p className="col-span-2 sm:col-span-4 text-[11px] text-muted-foreground">
            Precios con IVA {POS_TAX_PCT}% incluido · Tasa BCV Bs. {bsAmount(1, rate)} / REF
          </p>
        </Card>

        <Card className="p-4 rounded-2xl border-border/60">
          <PosChannelPicker
            channel={channel}
            setChannel={setChannel}
            channelDetail={channelDetail}
            setChannelDetail={setChannelDetail}
          />
        </Card>

        {payments.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">
              Pagos registrados {payments.length > 1 ? "· venta mixta" : ""}
            </p>
            {payments.map((p) => {
              const d = posMethod(p.method);
              const ref = toRef(Number(p.amount) || 0, d.currency, rate);
              return (
                <Card key={p.id} className="p-3 rounded-xl flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm flex items-center gap-2">
                      {d.label}
                      <Badge variant="secondary">{currencyLabel(d.currency)}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[
                        p.fields.bank ? posBankLabel(p.fields.bank) : null,
                        p.fields.terminal,
                        p.fields.reference ? `Ref. ${p.fields.reference}` : null,
                        p.fields.holder,
                        p.fields.installments ? `${p.fields.installments} cuotas` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Sin datos adicionales"}
                    </p>
                  </div>
                  <Money value={ref} rate={rate} size="sm" />
                  <button
                    type="button"
                    onClick={() => setPayments(payments.filter((x) => x.id !== p.id))}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Quitar pago"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Card>
              );
            })}
          </div>
        ) : null}

        {!adding && payments.length > 0 ? (
          <Button variant="outline" className="w-full h-12 font-black" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-2" />
            AÑADIR MÉTODO DE PAGO
          </Button>
        ) : (
          <Card className="p-4 rounded-2xl border-border/60 space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">
              {payments.length === 0 ? "Método de pago" : "Nuevo método de pago"}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {POS_PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMethod(m.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-sm font-semibold transition-colors text-left",
                    picker === m.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <span className="block">{m.label}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                    {currencyLabel(m.currency)}
                    {m.hint ? ` · ${m.hint}` : ""}
                  </span>
                </button>
              ))}
            </div>

            {def ? (
              <>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Monto en {currencyLabel(def.currency)}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={shownAmount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-12 text-lg font-bold"
                    />
                  </div>
                  {def.fields.map((f) => (
                    <div key={f.id} className="space-y-1.5">
                      <Label>
                        {f.label}
                        {f.required ? " *" : ""}
                      </Label>
                      {f.type === "bank" ? (
                        <Select
                          value={fields[f.id] ?? ""}
                          onValueChange={(v) => setFields({ ...fields, [f.id]: v })}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Selecciona el banco" />
                          </SelectTrigger>
                          <SelectContent>
                            {POS_BANKS.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={fields[f.id] ?? ""}
                          onChange={(e) => setFields({ ...fields, [f.id]: e.target.value })}
                          placeholder={f.placeholder}
                          className="h-12"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}

            <Button className="w-full h-12 font-black" disabled={!picker} onClick={usePaymentMethod}>
              USAR ESTE MÉTODO DE PAGO
            </Button>
          </Card>
        )}

        <Button
          size="lg"
          className={cn("w-full h-16 text-base font-black", posChannelButtonClass(channel))}
          disabled={!canFinish}
          onClick={onConfirm}
        >
          FINALIZAR VENTA
          {channel ? ` · ${posChannelLabel(channel, channelDetail)}` : ""}
        </Button>
        {!canFinish ? (
          <p className="text-xs text-center text-muted-foreground">
            {channel === null
              ? "Selecciona el origen de la venta para finalizar."
              : missing > 0
                ? "Registra pagos hasta que el faltante sea cero."
                : "Registra al menos un método de pago."}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Amount({
  label,
  value,
  rate,
  size = "md",
  tone,
}: {
  label: string;
  value: number;
  rate: number;
  size?: "md" | "lg";
  tone?: "default" | "muted" | "destructive" | "primary";
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <Money value={value} rate={rate} size={size} align="left" tone={tone} />
    </div>
  );
}
