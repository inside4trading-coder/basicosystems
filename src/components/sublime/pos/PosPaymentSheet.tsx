import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { usdFormat } from "@/lib/sublimeMock";
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

export const paidUsdOf = (payments: PosPaymentLine[], rate: number) =>
  payments.reduce((a, p) => {
    const n = Number(p.amount) || 0;
    return a + (posMethod(p.method).currency === "USD" ? n : n / rate);
  }, 0);

export function PosPaymentSheet({
  open,
  onOpenChange,
  total,
  rate,
  payments,
  setPayments,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  rate: number;
  payments: PosPaymentLine[];
  setPayments: (p: PosPaymentLine[]) => void;
  onConfirm: () => void;
}) {
  const [picker, setPicker] = useState<PosPaymentMethodId>("cash_usd");
  const paid = paidUsdOf(payments, rate);
  const missing = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);

  const addPayment = () => {
    const def = posMethod(picker);
    const remaining = Math.max(0, total - paid);
    const suggested = def.currency === "USD" ? remaining : remaining * rate;
    setPayments([
      ...payments,
      {
        id: `pay-${Date.now()}`,
        method: picker,
        amount: suggested > 0 ? suggested.toFixed(2) : "",
        fields: {},
      },
    ]);
  };

  const update = (id: string, patch: Partial<PosPaymentLine>) =>
    setPayments(payments.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight">Cobrar</DialogTitle>
        </DialogHeader>

        <Card className="p-5 rounded-2xl border-border/60 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total USD</p>
            <p className="num text-4xl font-black tabular-nums text-foreground leading-none">
              {usdFormat(total)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Equivalente VES · tasa {rate.toFixed(2)}
            </p>
            <p className="num text-2xl font-black tabular-nums text-foreground">
              Bs. {(total * rate).toLocaleString("es-VE", { maximumFractionDigits: 2 })}
            </p>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          {POS_PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPicker(m.id)}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                picker === m.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
              <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.currency}
              </span>
            </button>
          ))}
        </div>

        <Button variant="outline" onClick={addPayment}>
          <Plus className="h-4 w-4 mr-2" />
          Añadir otro método
        </Button>

        <div className="space-y-3">
          {payments.map((p) => {
            const def = posMethod(p.method);
            return (
              <Card key={p.id} className="p-4 rounded-2xl border-border/60 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-foreground">
                    {def.label}{" "}
                    <span className="text-xs font-medium text-muted-foreground">({def.currency})</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setPayments(payments.filter((x) => x.id !== p.id))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Quitar pago"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Monto {def.currency}</Label>
                    <Input
                      type="number"
                      value={p.amount}
                      onChange={(e) => update(p.id, { amount: e.target.value })}
                      className="h-11 text-base"
                    />
                  </div>
                  {def.fields.map((f) => (
                    <div key={f.id} className="space-y-1.5">
                      <Label className="text-xs">
                        {f.label}
                        {f.required ? " *" : ""}
                      </Label>
                      <Input
                        value={p.fields[f.id] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(e) => update(p.id, { fields: { ...p.fields, [f.id]: e.target.value } })}
                        className="h-11"
                      />
                    </div>
                  ))}
                </div>
                {def.currency === "VES" ? (
                  <p className="text-xs text-muted-foreground">
                    Equivale a {usdFormat((Number(p.amount) || 0) / rate)}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>

        <Separator />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Total label="Total" value={usdFormat(total)} />
          <Total label="Pagado" value={usdFormat(paid)} />
          <Total label="Faltante" value={usdFormat(missing)} tone={missing > 0 ? "warn" : "ok"} />
          <Total label="Cambio" value={usdFormat(change)} />
        </div>

        <Button
          size="lg"
          className="w-full h-14 text-base font-black"
          disabled={payments.length === 0 || missing > 0.009}
          onClick={onConfirm}
        >
          CONFIRMAR PAGO
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num text-xl font-black tabular-nums",
          tone === "warn" ? "text-destructive" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}
