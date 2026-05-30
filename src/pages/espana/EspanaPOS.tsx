import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Minus, Plus, Trash2, ScanLine, ShoppingCart, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";

interface Loc { id: string; name: string; code: string; inventory_mode: string; linked_location_id: string | null; is_active: boolean }
interface Channel { id: string; name: string; key: string; location_id: string | null; is_active: boolean }
interface Pay { id: string; name: string; key: string; color: string | null; location_id: string | null; is_active: boolean; sort_order: number }
interface ProdLite { id: string; name: string; sku: string; status: string; price_eur: number | null }
interface VarLite {
  id: string; product_id: string; variant_sku: string; size: string | null; color: string | null;
  scan_code: string | null; barcode: string | null; qr_code: string | null;
  status: string; price_eur: number | null;
}
interface CartLine {
  variant_id: string; product_id: string; label: string; sku: string;
  unit_price_eur: number; quantity: number; stock: number;
}

export default function EspanaPOS() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const isPriv = isAdmin || profile?.role === "manager";

  const [locs, setLocs] = useState<Loc[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [pays, setPays] = useState<Pay[]>([]);
  const [products, setProducts] = useState<ProdLite[]>([]);
  const [variants, setVariants] = useState<VarLite[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, Record<string, number>>>({});

  const [userAccess, setUserAccess] = useState<{ default_location_id: string | null; can_choose_location: boolean; allowed_location_ids: string[] } | null>(null);
  const [locationId, setLocationId] = useState<string>("");
  const [channelId, setChannelId] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { sale_number: string; total: number; lines: CartLine[]; payment: string; location: string; channel: string }>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [l, c, p, pr, v, s] = await Promise.all([
        supabase.from("esp_locations").select("*").eq("is_active", true).order("name"),
        supabase.from("esp_sales_channels").select("*").eq("is_active", true).order("name"),
        supabase.from("esp_payment_methods").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("esp_products").select("id,name,sku,status,price_eur").eq("status", "active").eq("is_sellable", true),
        supabase.from("esp_product_variants").select("id,product_id,variant_sku,size,color,scan_code,barcode,qr_code,status,price_eur").eq("status", "active"),
        supabase.from("esp_inventory_stock").select("location_id,variant_id,quantity_on_hand"),
      ]);
      if (l.data) setLocs(l.data as Loc[]);
      if (c.data) setChannels(c.data as Channel[]);
      if (p.data) setPays(p.data as Pay[]);
      if (pr.data) setProducts(pr.data as ProdLite[]);
      if (v.data) setVariants(v.data as VarLite[]);
      const m: Record<string, Record<string, number>> = {};
      (s.data as any[] | null)?.forEach((x) => {
        m[x.variant_id] = m[x.variant_id] || {};
        m[x.variant_id][x.location_id] = x.quantity_on_hand;
      });
      setStockMap(m);
      if (user) {
        const { data } = await supabase.from("esp_user_location_access").select("default_location_id,can_choose_location,allowed_location_ids").eq("user_id", user.id).maybeSingle();
        if (data) setUserAccess(data as any);
      }
    })();
  }, [user]);

  const sellableLocs = useMemo(() => locs.filter(l => l.inventory_mode === "own_stock" || l.inventory_mode === "linked_stock"), [locs]);
  const availableLocs = useMemo(() => {
    if (isAdmin) return sellableLocs;
    if (!userAccess) return isPriv ? sellableLocs : [];
    if (!userAccess.can_choose_location) {
      return userAccess.default_location_id ? sellableLocs.filter(l => l.id === userAccess.default_location_id) : [];
    }
    const allowed = new Set(userAccess.allowed_location_ids);
    if (userAccess.default_location_id) allowed.add(userAccess.default_location_id);
    return sellableLocs.filter(l => allowed.has(l.id));
  }, [sellableLocs, userAccess, isAdmin, isPriv]);

  // auto-select default location
  useEffect(() => {
    if (locationId) return;
    if (userAccess?.default_location_id && availableLocs.some(l => l.id === userAccess.default_location_id)) {
      setLocationId(userAccess.default_location_id);
    } else if (availableLocs.length === 1) {
      setLocationId(availableLocs[0].id);
    }
  }, [availableLocs, userAccess, locationId]);

  const currentLoc = locs.find(l => l.id === locationId) || null;
  const invLocId = currentLoc?.inventory_mode === "linked_stock" && currentLoc.linked_location_id ? currentLoc.linked_location_id : locationId;
  const invLocName = locs.find(l => l.id === invLocId)?.name || "";

  // auto-select channel matching location
  useEffect(() => {
    if (!locationId || channelId) return;
    const match = channels.find(c => c.location_id === locationId) || channels[0];
    if (match) setChannelId(match.id);
  }, [locationId, channels, channelId]);

  const visiblePays = pays.filter(p => !p.location_id || p.location_id === locationId);

  const stockOf = (variantId: string) => stockMap[variantId]?.[invLocId] ?? 0;

  const findByCode = (raw: string): VarLite | null => {
    const c = raw.trim().toLowerCase();
    if (!c) return null;
    return variants.find(v =>
      v.scan_code?.toLowerCase() === c ||
      v.variant_sku.toLowerCase() === c ||
      v.barcode?.toLowerCase() === c ||
      v.qr_code?.toLowerCase() === c
    ) || null;
  };

  const addVariantToCart = (v: VarLite) => {
    const p = products.find(pp => pp.id === v.product_id);
    if (!p) { toast.error("Producto inactivo"); return; }
    const stock = stockOf(v.id);
    if (stock <= 0 && !isAdmin) { toast.error("Sin stock en esta sede"); return; }
    const price = v.price_eur ?? p.price_eur ?? 0;
    const label = `${p.name}${v.size ? ` · ${v.size}` : ""}${v.color ? ` · ${v.color}` : ""}`;
    setCart(prev => {
      const idx = prev.findIndex(l => l.variant_id === v.id);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = next[idx].quantity + 1;
        if (newQty > stock && !isAdmin) { toast.error("Stock insuficiente"); return prev; }
        next[idx] = { ...next[idx], quantity: newQty };
        return next;
      }
      return [...prev, { variant_id: v.id, product_id: v.product_id, label, sku: v.variant_sku, unit_price_eur: Number(price), quantity: 1, stock }];
    });
  };

  const onScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId) { toast.error("Selecciona sede"); return; }
    const v = findByCode(code);
    if (!v) { toast.error("Producto no encontrado"); return; }
    addVariantToCart(v);
    setCode("");
    codeInputRef.current?.focus();
  };

  const updateQty = (variantId: string, delta: number) => {
    setCart(prev => prev.flatMap(l => {
      if (l.variant_id !== variantId) return [l];
      const next = l.quantity + delta;
      if (next <= 0) return [];
      if (next > l.stock && !isAdmin) { toast.error("Stock insuficiente"); return [l]; }
      return [{ ...l, quantity: next }];
    }));
  };
  const removeLine = (variantId: string) => setCart(prev => prev.filter(l => l.variant_id !== variantId));

  const total = cart.reduce((a, l) => a + l.unit_price_eur * l.quantity, 0);

  const searchResults = useMemo(() => {
    if (!search || search.length < 2) return [];
    const s = search.toLowerCase();
    return variants
      .map(v => ({ v, p: products.find(p => p.id === v.product_id) }))
      .filter(x => x.p && (`${x.p.sku} ${x.p.name} ${x.v.variant_sku} ${x.v.size ?? ""}`.toLowerCase().includes(s)))
      .slice(0, 10);
  }, [search, variants, products]);

  const confirmSale = async () => {
    if (!locationId) return toast.error("Sede requerida");
    if (!paymentId) return toast.error("Método de pago requerido");
    if (cart.length === 0) return toast.error("Carrito vacío");
    setSubmitting(true);
    const items = cart.map(l => ({ variant_id: l.variant_id, quantity: l.quantity, unit_price_eur: l.unit_price_eur }));
    const { data, error } = await supabase.rpc("esp_register_pos_sale", {
      p_channel_id: channelId || null,
      p_location_id: locationId,
      p_payment_method_id: paymentId,
      p_items: items,
      p_notes: null,
      p_payment_reference: null,
      p_allow_negative: false,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    setDone({
      sale_number: res.sale_number,
      total: Number(res.total_eur),
      lines: cart,
      payment: pays.find(p => p.id === paymentId)?.name || "",
      location: currentLoc?.name || "",
      channel: channels.find(c => c.id === channelId)?.name || "",
    });
    setCart([]);
    // refresh stock
    const { data: s } = await supabase.from("esp_inventory_stock").select("location_id,variant_id,quantity_on_hand");
    const m: Record<string, Record<string, number>> = {};
    (s as any[] | null)?.forEach((x) => {
      m[x.variant_id] = m[x.variant_id] || {};
      m[x.variant_id][x.location_id] = x.quantity_on_hand;
    });
    setStockMap(m);
  };

  if (!isPriv) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Necesitas rol admin o manager para usar el POS.</p>
      </Card>
    );
  }

  if (availableLocs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h3 className="text-lg font-bold mb-2">Sin sede asignada</h3>
        <p className="text-sm text-muted-foreground">Debes asignar una sede antes de registrar ventas. Pídelo en Configuración España.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black tracking-tight">POS Móvil</h2>
          <p className="text-xs text-muted-foreground">Registrar venta presencial y descontar inventario.</p>
        </div>
        <div className="flex items-center gap-2">
          {availableLocs.length > 1 || isAdmin ? (
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Sede" /></SelectTrigger>
              <SelectContent>{availableLocs.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className="text-xs">{currentLoc?.name || "—"}</Badge>
          )}
        </div>
      </div>

      {currentLoc?.inventory_mode === "linked_stock" && (
        <Card className="p-3 bg-muted/40 text-xs">Inventario tomado de: <strong>{invLocName}</strong></Card>
      )}

      <Card className="p-4 space-y-3">
        <form onSubmit={onScanSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={codeInputRef}
              autoFocus
              placeholder="Escanear código / QR / SKU..."
              className="pl-10 text-base h-12"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 px-6">Agregar</Button>
        </form>
        <div className="relative">
          <Input placeholder="Buscar manualmente (nombre, SKU, talla)..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {searchResults.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 border rounded-lg bg-background shadow-lg max-h-72 overflow-y-auto">
              {searchResults.map(({ v, p }) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { if (p) addVariantToCart(v); setSearch(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between gap-2 border-b last:border-0"
                >
                  <span>
                    <span className="font-medium">{p?.name}</span>{" "}
                    <span className="text-muted-foreground text-xs">· {v.variant_sku}{v.size ? ` · ${v.size}` : ""}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">stock: {stockOf(v.id)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Carrito ({cart.length})</h3>
        {cart.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Sin productos en el carrito.</p>}
        <div className="space-y-2">
          {cart.map(l => (
            <div key={l.variant_id} className="flex items-center gap-2 border rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{l.label}</p>
                <p className="text-[11px] text-muted-foreground">{l.sku} · stock: {l.stock} · €{l.unit_price_eur.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(l.variant_id, -1)}><Minus className="h-3 w-3" /></Button>
                <span className="w-7 text-center text-sm font-bold">{l.quantity}</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(l.variant_id, 1)}><Plus className="h-3 w-3" /></Button>
              </div>
              <div className="w-20 text-right text-sm font-bold">€{(l.unit_price_eur * l.quantity).toFixed(2)}</div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeLine(l.variant_id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="flex items-center justify-between border-t mt-3 pt-3">
            <span className="text-sm font-bold">Total</span>
            <span className="text-2xl font-black">€{total.toFixed(2)}</span>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <Label className="text-sm font-bold">Método de pago</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          {visiblePays.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPaymentId(p.id)}
              className={`h-14 rounded-xl border-2 text-sm font-bold transition-colors ${paymentId === p.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
              style={paymentId === p.id && p.color ? { borderColor: p.color } : undefined}
            >
              {p.name}
            </button>
          ))}
        </div>
        {visiblePays.length === 0 && <p className="text-xs text-muted-foreground mt-2">No hay métodos de pago configurados.</p>}
      </Card>

      <div className="sticky bottom-2">
        <Button className="w-full h-14 text-base font-bold" disabled={submitting || cart.length === 0 || !paymentId} onClick={confirmSale}>
          {submitting ? "Procesando..." : `Confirmar venta · €${total.toFixed(2)}`}
        </Button>
      </div>

      <Dialog open={!!done} onOpenChange={(o) => !o && setDone(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Venta registrada</DialogTitle>
          </DialogHeader>
          {done && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Número</span><span className="font-mono font-bold">{done.sale_number}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sede</span><span>{done.location}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Canal</span><span>{done.channel || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pago</span><span>{done.payment}</span></div>
              <div className="border-t pt-2 mt-2 space-y-1">
                {done.lines.map(l => (
                  <div key={l.variant_id} className="flex justify-between text-xs">
                    <span>{l.quantity}× {l.label}</span>
                    <span>€{(l.unit_price_eur * l.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t pt-2 mt-2 font-bold"><span>Total</span><span>€{done.total.toFixed(2)}</span></div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full" onClick={() => {
              if (!done) return;
              const txt = `${done.sale_number} · ${done.location} · ${done.payment}\n${done.lines.map(l => `${l.quantity}× ${l.label} = €${(l.unit_price_eur*l.quantity).toFixed(2)}`).join("\n")}\nTotal: €${done.total.toFixed(2)}`;
              navigator.clipboard.writeText(txt); toast.success("Resumen copiado");
            }}><Copy className="h-3.5 w-3.5 mr-2" />Copiar</Button>
            <Button variant="outline" className="w-full" onClick={() => { setDone(null); window.location.href = "/espana/ventas"; }}>Ver ventas</Button>
            <Button className="w-full" onClick={() => { setDone(null); codeInputRef.current?.focus(); }}>Nueva venta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
