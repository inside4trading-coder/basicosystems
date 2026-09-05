import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Trash2, ScanLine, CheckCircle2, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MobileQrScanner } from "@/components/espana/MobileQrScanner";

interface Session {
  location: { id: string; name: string };
  payment_methods: { id: string; name: string; key: string; color?: string | null }[];
  needs_pin: boolean;
}
interface CartLine {
  variant_id: string;
  label: string;
  sku: string;
  unit_price_eur: number;
  quantity: number;
  stock: number;
}

export default function PosPublico() {
  const { locationSlug = "", publicToken = "" } = useParams();
  const [status, setStatus] = useState<"loading" | "pin" | "invalid" | "ready">("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [pin, setPin] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentId, setPaymentId] = useState("");
  const [customer, setCustomer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { sale_number: string; total: number; lines: CartLine[]; payment: string }>(null);

  const resolve = async (withPin?: string) => {
    setStatus("loading");
    const { data, error } = await supabase.functions.invoke("esp-public-pos-resolve", {
      body: { slug: locationSlug, token: publicToken, pin: withPin ?? undefined },
    });
    if (error || (data as any)?.error) { setStatus("invalid"); return; }
    if ((data as any)?.needs_pin && !withPin) { setStatus("pin"); return; }
    setSession(data as Session);
    setPaymentId((data as Session).payment_methods[0]?.id || "");
    setStatus("ready");
  };

  useEffect(() => { resolve(); /* eslint-disable-next-line */ }, [locationSlug, publicToken]);

  const total = useMemo(() => cart.reduce((a, l) => a + l.unit_price_eur * l.quantity, 0), [cart]);

  const addByCode = async (code: string) => {
    if (!code || !session) return;
    const { data, error } = await supabase.functions.invoke("esp-public-pos-search", {
      body: { slug: locationSlug, token: publicToken, pin: pin || undefined, query: code },
    });
    if (error || (data as any)?.error) {
      const msg = (data as any)?.error;
      if (msg === "not_found") toast.error("Producto no encontrado");
      else toast.error(msg || error?.message || "Error");
      return;
    }
    const v: any = data;
    if ((v.stock_in_location ?? 0) <= 0) { toast.error("Sin stock en esta sede"); return; }
    setCart(prev => {
      const idx = prev.findIndex(l => l.variant_id === v.variant_id);
      if (idx >= 0) {
        const nq = prev[idx].quantity + 1;
        if (nq > v.stock_in_location) { toast.error("Stock insuficiente"); return prev; }
        const next = [...prev]; next[idx] = { ...next[idx], quantity: nq }; return next;
      }
      return [...prev, {
        variant_id: v.variant_id,
        label: v.variant_label || v.product_name,
        sku: v.sku,
        unit_price_eur: Number(v.price_eur || 0),
        quantity: 1,
        stock: v.stock_in_location,
      }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.flatMap(l => {
      if (l.variant_id !== id) return [l];
      const n = l.quantity + delta;
      if (n <= 0) return [];
      if (n > l.stock) { toast.error("Stock insuficiente"); return [l]; }
      return [{ ...l, quantity: n }];
    }));
  };

  const confirmSale = async () => {
    if (!session || !paymentId || cart.length === 0) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("esp-public-pos-sale", {
      body: {
        slug: locationSlug,
        token: publicToken,
        pin: pin || undefined,
        payment_method_id: paymentId,
        items: cart.map(l => ({ variant_id: l.variant_id, quantity: l.quantity })),
        customer_name: customer || undefined,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      const raw = (data as any)?.error || error?.message || "";
      const msg =
        raw === "invalid" ? "Link no válido o desactivado" :
        raw === "invalid_pin" ? "PIN incorrecto" :
        raw || "No se pudo registrar la venta pública";
      toast.error(msg);
      return;
    }
    const res: any = (data as any).sale || {};
    setDone({
      sale_number: res.sale_number || "—",
      total: Number(res.total_eur || total),
      lines: cart,
      payment: session.payment_methods.find(p => p.id === paymentId)?.name || "",
    });
    setCart([]);
    setCustomer("");
  };

  if (status === "loading") {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (status === "invalid") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-black">Link no válido o desactivado</h2>
          <p className="text-sm text-muted-foreground mt-2">Solicita un link actualizado al administrador.</p>
        </Card>
      </div>
    );
  }
  if (status === "pin") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="p-6 max-w-sm w-full space-y-3">
          <h2 className="font-bold">PIN de sede</h2>
          <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" />
          <Button className="w-full" onClick={() => resolve(pin)}>Entrar</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">BASICO POS</p>
          <h1 className="text-base font-black leading-tight">{session?.location.name}</h1>
        </div>
        <Badge variant="outline" className="text-[10px]">Público</Badge>
      </header>

      <main className="p-3 space-y-3 max-w-2xl mx-auto pb-32">
        <Card className="p-3 space-y-2">
          <Button className="w-full h-14 text-base" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-5 w-5 mr-2" />Escanear
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); addByCode(manualCode); setManualCode(""); }}
          >
            <Input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Código manual / SKU" />
            <Button type="submit" variant="secondary">Agregar</Button>
          </form>
        </Card>

        <Card className="p-3">
          <h3 className="text-sm font-bold mb-2 flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Carrito ({cart.length})</h3>
          {cart.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Sin productos.</p>}
          <div className="space-y-2">
            {cart.map(l => (
              <div key={l.variant_id} className="flex items-center gap-2 border rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.label}</p>
                  <p className="text-[11px] text-muted-foreground">{l.sku} · €{l.unit_price_eur.toFixed(2)}</p>
                </div>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(l.variant_id, -1)}><Minus className="h-3 w-3" /></Button>
                <span className="w-6 text-center text-sm font-bold">{l.quantity}</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(l.variant_id, 1)}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCart(prev => prev.filter(x => x.variant_id !== l.variant_id))}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="flex items-center justify-between border-t mt-3 pt-3">
              <span className="text-sm font-bold">Total</span>
              <span className="num text-2xl font-black">€{total.toFixed(2)}</span>
            </div>
          )}
        </Card>

        <Card className="p-3">
          <label className="text-xs font-medium">Cliente (opcional)</label>
          <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nombre" />
        </Card>

        <Card className="p-3">
          <label className="text-sm font-bold">Método de pago</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {session?.payment_methods.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaymentId(p.id)}
                className={`h-14 rounded-xl border-2 text-sm font-bold transition-colors ${paymentId === p.id ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </Card>
      </main>

      <div className="fixed bottom-0 inset-x-0 p-3 bg-card border-t z-20">
        <Button className="w-full h-14 text-base font-bold" disabled={submitting || cart.length === 0 || !paymentId} onClick={confirmSale}>
          {submitting ? "Procesando..." : `Confirmar venta · €${total.toFixed(2)}`}
        </Button>
        <p className="text-[10px] text-center text-muted-foreground mt-1">Venta registrada en {session?.location.name}</p>
      </div>

      <MobileQrScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => { setScanOpen(false); addByCode(code); }}
      />

      {done && (
        <div className="fixed inset-0 z-30 bg-background/95 grid place-items-center p-4" onClick={() => setDone(null)}>
          <Card className="p-6 max-w-md w-full text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <h3 className="text-xl font-black">Venta registrada</h3>
            <p className="text-sm">Nº <span className="font-mono font-bold">{done.sale_number}</span></p>
            <p className="num text-2xl font-black">€{done.total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Pago: {done.payment}</p>
            <Button className="w-full" onClick={() => setDone(null)}>Continuar</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
