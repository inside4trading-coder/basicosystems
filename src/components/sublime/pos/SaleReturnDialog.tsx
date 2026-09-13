import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { refFormat } from "@/lib/posMoney";
import { POS_PAYMENT_METHODS, posMethod, type PosPaymentMethodId } from "@/lib/posPaymentMethods";
import { POS_BANKS } from "@/lib/posBanks";
import { setPendingExchange } from "@/lib/posExchange";
import type { SaleRow } from "@/hooks/useSublimeSalesHistory";
import {
  useOpenCashSessionAtLocation,
  useRegisterSaleReturn,
  useSaleReturns,
} from "@/hooks/useSublimeSaleReturns";

type Mode = "return" | "void";

export function SaleReturnDialog({
  sale,
  mode,
  open,
  onOpenChange,
}: {
  sale: SaleRow | null;
  mode: Mode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: returns = [] } = useSaleReturns(sale?.id ?? null);
  const { data: session } = useOpenCashSessionAtLocation(sale?.location_id ?? null);
  const register = useRegisterSaleReturn();

  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<PosPaymentMethodId>("cash_usd");
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [reference, setReference] = useState("");
  const [isExchange, setIsExchange] = useState(false);
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());

  const returnedByItem = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of returns) for (const i of r.items) m[i.sale_item_id] = (m[i.sale_item_id] ?? 0) + i.qty;
    return m;
  }, [returns]);

  const lines = (sale?.items ?? []).map((i) => {
    const already = returnedByItem[i.id] ?? 0;
    return { item: i, already, remaining: Math.max(0, i.qty - already) };
  });

  const selected =
    mode === "void"
      ? lines.filter((l) => l.remaining > 0).map((l) => ({ sale_item_id: l.item.id, qty: l.remaining }))
      : lines
          .filter((l) => (qty[l.item.id] ?? 0) > 0)
          .map((l) => ({ sale_item_id: l.item.id, qty: Math.min(qty[l.item.id], l.remaining) }));

  const selectedValue = selected.reduce((a, s) => {
    const l = lines.find((x) => x.item.id === s.sale_item_id);
    return a + (l ? l.item.unit_final_ref * s.qty : 0);
  }, 0);

  useEffect(() => {
    if (!open) return;
    setQty({});
    setReason("");
    setBank("");
    setReference("");
    setIsExchange(false);
    setAttemptKey(crypto.randomUUID());
  }, [open, sale?.id, mode]);

  useEffect(() => {
    setAmount(selectedValue > 0 ? selectedValue.toFixed(2) : "");
    // solo sugiere el importe; el cajero puede ajustarlo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue.toFixed(2), method]);

  const def = posMethod(method);
  const amountNum = Number(amount.replace(",", ".")) || 0;
  const rate = sale?.bcv_rate ?? 0;
  const amountRef = def.currency === "USD" ? amountNum : rate > 0 ? amountNum / rate : 0;
  const cashRefund = (method === "cash_usd" || method === "cash_ves") && amountNum > 0;
  const blockedByCash = cashRefund && !session;

  const submit = async () => {
    if (!sale) return;
    if (selected.length === 0) {
      toast.error("Selecciona al menos una unidad a devolver.");
      return;
    }
    if (blockedByCash) {
      toast.error("No hay caja abierta: abre caja para devolver efectivo.");
      return;
    }
    try {
      const res = await register.mutateAsync({
        idempotencyKey: attemptKey,
        saleId: sale.id,
        kind: mode,
        items: selected,
        reason,
        refunds:
          amountNum > 0
            ? [
                {
                  method,
                  currency: def.currency,
                  amount: amountNum,
                  amount_ref: Number(amountRef.toFixed(2)),
                  bank: bank || null,
                  reference: reference || null,
                },
              ]
            : [],
        cashSessionId: cashRefund ? (session?.id ?? null) : null,
      });

      toast.success(
        `${mode === "void" ? "Venta anulada" : "Devolución registrada"} · ${res.return_number}`
      );

      if (mode === "return" && isExchange) {
        setPendingExchange({
          returnId: res.return_id,
          returnNumber: res.return_number,
          saleNumber: sale.sale_number,
          refundedRef: Number(amountRef.toFixed(2)),
        });
        onOpenChange(false);
        navigate("/pos");
        return;
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo completar la operación.");
      setAttemptKey(crypto.randomUUID());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "void" ? "Anular venta" : "Devolver productos"} · {sale?.sale_number}
          </DialogTitle>
        </DialogHeader>

        {sale && (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-muted-foreground">
              La venta original no se modifica. Esta operación crea movimientos nuevos y auditables.
              La mercancía vuelve al stock de la tienda como vendible.
            </p>

            <div className="space-y-2">
              {lines.map((l) => (
                <div
                  key={l.item.id}
                  className="rounded-xl border border-border/60 p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{l.item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[l.item.subtitle, l.item.sku].filter(Boolean).join(" · ") || "Ítem manual"} ·{" "}
                      {refFormat(l.item.unit_final_ref)} c/u
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vendidas {l.item.qty}
                      {l.already > 0 ? ` · ya devueltas ${l.already}` : ""}
                    </p>
                  </div>
                  {mode === "void" ? (
                    <Badge variant={l.remaining > 0 ? "default" : "secondary"}>
                      {l.remaining > 0 ? `Devuelve ${l.remaining}` : "Nada pendiente"}
                    </Badge>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={l.remaining}
                      disabled={l.remaining === 0}
                      className="w-20 text-right"
                      value={qty[l.item.id] ?? ""}
                      onChange={(e) =>
                        setQty((q) => ({
                          ...q,
                          [l.item.id]: Math.max(0, Math.min(l.remaining, Number(e.target.value) || 0)),
                        }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/60 p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Valor devuelto</span>
              <span className="tabular-nums font-bold">{refFormat(selectedValue)}</span>
            </div>

            <div className="space-y-1">
              <Label>Motivo</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Talla incorrecta, cambio de opinión…"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Reembolso</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={method} onValueChange={(v) => setMethod(v as PosPaymentMethodId)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POS_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={def.currency === "USD" ? "Monto REF" : "Monto Bs."}
                />
                {def.currency === "VES" && (
                  <Select value={bank} onValueChange={setBank}>
                    <SelectTrigger><SelectValue placeholder="Banco (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {POS_BANKS.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Referencia (opcional)"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Equivale a {refFormat(amountRef)}. Deja el monto en blanco si no devuelves dinero ahora.
              </p>
              {cashRefund && (
                <p className={`text-xs ${session ? "text-muted-foreground" : "text-destructive"}`}>
                  {session
                    ? `Se registrará en la caja abierta ${session.session_number}.`
                    : "No hay caja abierta: abre caja para devolver efectivo."}
                </p>
              )}
            </div>

            {mode === "return" && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isExchange} onCheckedChange={(v) => setIsExchange(!!v)} />
                Es un cambio: al confirmar iré al POS a vender el producto nuevo
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={register.isPending || selected.length === 0 || blockedByCash}
            variant={mode === "void" ? "destructive" : "default"}
          >
            {register.isPending
              ? "Procesando…"
              : mode === "void"
                ? "Anular venta"
                : isExchange
                  ? "Devolver y cambiar"
                  : "Confirmar devolución"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
