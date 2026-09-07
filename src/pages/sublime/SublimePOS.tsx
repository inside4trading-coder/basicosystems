import { useMemo, useState } from "react";
import { CheckCircle2, Minus, Plus, ScanLine, ShoppingCart, Trash2, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { PAYMENT_METHOD_LABEL, type Currency, type PaymentMethod } from "@/types/sublimeHub";
import { mockCustomers, mockProducts, mockVariants, usdFormat } from "@/lib/sublimeMock";

type CartLine = { variantId: string; qty: number };
type PaymentLine = { id: string; method: PaymentMethod; currency: Currency; amount: string; reference: string; bank: string };

const BCV_RATE = 150;

export default function SublimePOS() {
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("none");
  const [customerName, setCustomerName] = useState("");
  const [customerId2, setCustomerId2] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerBirth, setCustomerBirth] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [discount, setDiscount] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [doneOpen, setDoneOpen] = useState(false);

  const catalog = useMemo(
    () =>
      mockVariants
        .map((v) => ({ v, p: mockProducts.find((x) => x.id === v.productId)! }))
        .filter(({ v, p }) =>
          q.trim() === "" ? true : `${p.title} ${v.sku} ${v.size} ${v.color}`.toLowerCase().includes(q.toLowerCase())
        ),
    [q]
  );

  const lines = cart.map((c) => {
    const v = mockVariants.find((x) => x.id === c.variantId)!;
    const p = mockProducts.find((x) => x.id === v.productId)!;
    return { ...c, v, p, subtotal: v.pvp * c.qty };
  });
  const subtotal = lines.reduce((a, l) => a + l.subtotal, 0);
  const discountUsd = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountUsd);
  const paidUsd = payments.reduce(
    (a, p) => a + (p.currency === "USD" ? Number(p.amount) || 0 : (Number(p.amount) || 0) / BCV_RATE),
    0
  );
  const pending = total - paidUsd;

  const add = (variantId: string) =>
    setCart((prev) => {
      const found = prev.find((c) => c.variantId === variantId);
      return found
        ? prev.map((c) => (c.variantId === variantId ? { ...c, qty: c.qty + 1 } : c))
        : [...prev, { variantId, qty: 1 }];
    });

  const changeQty = (variantId: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((c) => (c.variantId === variantId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );

  const addPayment = () =>
    setPayments((p) => [
      ...p,
      { id: `p-${Date.now()}`, method: "cash", currency: "USD", amount: "", reference: "", bank: "" },
    ]);

  const resetSale = () => {
    setCart([]);
    setPayments([]);
    setDiscount("");
    setCustomerId("none");
    setCustomerName("");
    setCustomerId2("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerBirth("");
    setCustomerAddress("");
    setDoneOpen(false);
  };

  return (
    <div className="space-y-6">
      <HubHeader icon={ShoppingCart} title="POS Sublime" subtitle="Buscar o identificar producto y cobrar" />
      <MockNotice text="Venta simulada: no descuenta inventario ni registra cobros reales todavía." />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Catálogo */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex gap-2">
            <Input
              className="h-12 text-base"
              placeholder="Buscar por nombre, SKU o código…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button variant="outline" className="h-12" onClick={() => toast.info("Lector listo para identificar prendas.")}>
              <ScanLine className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {catalog.map(({ v, p }) => (
              <Card
                key={v.id}
                className="p-4 rounded-2xl border-border/60 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => add(v.id)}
              >
                <p className="font-semibold text-sm leading-tight">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{v.size} · {v.color}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{v.sku}</p>
                <p className="num text-lg font-black tabular-nums mt-2">{usdFormat(v.pvp)}</p>
                <Badge variant="secondary" className="mt-2">{v.quantity} disp.</Badge>
              </Card>
            ))}
          </div>
        </div>

        {/* Carrito */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 rounded-2xl border-border/60 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Carrito</p>
            {lines.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sin productos.</p>}
            {lines.map((l) => (
              <div key={l.variantId} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.p.title}</p>
                  <p className="text-xs text-muted-foreground">{l.v.size} · {l.v.color}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => changeQty(l.variantId, -1)}><Minus className="h-4 w-4" /></Button>
                <span className="w-6 text-center tabular-nums">{l.qty}</span>
                <Button size="icon" variant="ghost" onClick={() => changeQty(l.variantId, 1)}><Plus className="h-4 w-4" /></Button>
                <span className="w-20 text-right tabular-nums text-sm">{usdFormat(l.subtotal)}</span>
                <Button size="icon" variant="ghost" onClick={() => setCart((p) => p.filter((c) => c.variantId !== l.variantId))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Separator />
            <div className="space-y-1 text-sm">
              <Row label="Subtotal" value={usdFormat(subtotal)} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Descuento</span>
                <Input className="h-8 w-24 text-right" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold">Total</span>
                <span className="num text-2xl font-black tabular-nums">{usdFormat(total)}</span>
              </div>
            </div>
            <Button className="w-full h-12" disabled={lines.length === 0} onClick={() => setPayOpen(true)}>
              Cobrar
            </Button>
          </Card>

          <Card className="p-4 rounded-2xl border-border/60 space-y-3">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente (opcional)</p>
            </div>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Venta sin cliente</SelectItem>
                {mockCustomers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                <SelectItem value="new">Nuevo cliente…</SelectItem>
              </SelectContent>
            </Select>
            {customerId === "new" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Nombre" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                <Input placeholder="Cédula" value={customerId2} onChange={(e) => setCustomerId2(e.target.value)} />
                <Input placeholder="Teléfono" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                <Input placeholder="Correo" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                <Input placeholder="Fecha de nacimiento" value={customerBirth} onChange={(e) => setCustomerBirth(e.target.value)} />
                <Input placeholder="Dirección" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Pago */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pago</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total a cobrar</span>
              <span className="num text-2xl font-black tabular-nums">{usdFormat(total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Tasa referencial: Bs {BCV_RATE} por USD</p>

            {payments.map((p, i) => (
              <Card key={p.id} className="p-3 rounded-xl border-border/60 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={p.method} onValueChange={(v) => setPayments((prev) => prev.map((x, j) => j === i ? { ...x, method: v as PaymentMethod } : x))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                        <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={p.currency} onValueChange={(v) => setPayments((prev) => prev.map((x, j) => j === i ? { ...x, currency: v as Currency } : x))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="VES">VES</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Monto" value={p.amount} onChange={(e) => setPayments((prev) => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                  <Input placeholder="Referencia" value={p.reference} onChange={(e) => setPayments((prev) => prev.map((x, j) => j === i ? { ...x, reference: e.target.value } : x))} />
                  <Input placeholder="Banco / cuenta" value={p.bank} onChange={(e) => setPayments((prev) => prev.map((x, j) => j === i ? { ...x, bank: e.target.value } : x))} />
                </div>
                <Button size="sm" variant="ghost" onClick={() => setPayments((prev) => prev.filter((_, j) => j !== i))}>
                  Quitar pago
                </Button>
              </Card>
            ))}

            <Button variant="outline" className="w-full" onClick={addPayment}>
              <Plus className="h-4 w-4 mr-2" /> Añadir pago
            </Button>

            <div className="rounded-xl border border-border/60 p-3 space-y-1 text-sm">
              <Row label="Pagado" value={usdFormat(paidUsd)} />
              <Row label={pending > 0 ? "Falta" : "Vuelto"} value={usdFormat(Math.abs(pending))} />
            </div>

            <div className="rounded-xl border border-border/60 p-3 space-y-1 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Resumen</p>
              <Row label="Productos" value={String(lines.reduce((a, l) => a + l.qty, 0))} />
              <Row label="Subtotal" value={usdFormat(subtotal)} />
              <Row label="Descuento" value={usdFormat(discountUsd)} />
              <Row label="Total" value={usdFormat(total)} />
              <Row label="Cliente" value={customerId === "none" ? "Sin cliente" : customerId === "new" ? customerName || "Nuevo cliente" : mockCustomers.find((c) => c.id === customerId)?.name ?? "—"} />
            </div>

            <Button
              className="w-full h-12"
              disabled={payments.length === 0}
              onClick={() => {
                setPayOpen(false);
                setDoneOpen(true);
              }}
            >
              Confirmar venta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Venta completada</DialogTitle></DialogHeader>
          <div className="py-4 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="num text-3xl font-black tabular-nums">{usdFormat(total)}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => toast.success("Comprobante generado (simulado).")}>
                Generar comprobante
              </Button>
              <Button onClick={resetSale}>Nueva venta</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
