import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ArrowDownToLine, ArrowUpFromLine, Sliders, ArrowLeftRight, History, Download, QrCode, Check, ChevronsUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Loc { id: string; name: string; code: string; inventory_mode: string }
interface Variant {
  id: string; product_id: string; variant_sku: string; size: string | null; color: string | null; status: string;
  scan_code: string | null;
}
interface Product { id: string; sku: string; name: string }
interface Stock { location_id: string; variant_id: string; quantity_on_hand: number; low_stock_threshold: number }
interface Movement {
  id: string; created_at: string; movement_type: string; quantity: number;
  quantity_before: number | null; quantity_after: number | null;
  location_id: string | null; from_location_id: string | null; to_location_id: string | null;
  variant_id: string; reason: string | null; notes: string | null;
}

type Mode = "in" | "out" | "adjust" | "transfer" | null;

export default function EspanaInventario() {
  const [locs, setLocs] = useState<Loc[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [prefillVariantId, setPrefillVariantId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<{ variantId: string } | null>(null);
  const openMode = (m: Mode, vid?: string) => { setPrefillVariantId(vid ?? null); setMode(m); };

  const load = async () => {
    const [l, p, v, s] = await Promise.all([
      supabase.from("esp_locations").select("id,name,code,inventory_mode").eq("is_active", true).order("name"),
      supabase.from("esp_products").select("id,sku,name").order("name"),
      supabase.from("esp_product_variants").select("id,product_id,variant_sku,size,color,status,scan_code").order("sort_order"),
      supabase.from("esp_inventory_stock").select("location_id,variant_id,quantity_on_hand,low_stock_threshold"),
    ]);
    if (l.data) setLocs(l.data as Loc[]);
    if (p.data) setProducts(p.data as Product[]);
    if (v.data) setVariants(v.data as Variant[]);
    if (s.data) setStock(s.data as Stock[]);
  };
  useEffect(() => { load(); }, []);

  const productById = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);

  const stockMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    stock.forEach((s) => {
      m[s.variant_id] = m[s.variant_id] || {};
      m[s.variant_id][s.location_id] = s.quantity_on_hand;
    });
    return m;
  }, [stock]);

  const thresholdMap = useMemo(() => Object.fromEntries(stock.map(s => [`${s.variant_id}_${s.location_id}`, s.low_stock_threshold])), [stock]);

  const filteredVariants = useMemo(() => variants.filter((v) => {
    if (v.status !== "active") return false;
    const p = productById[v.product_id];
    if (!p) return false;
    if (q && !`${p.sku} ${p.name} ${v.variant_sku} ${v.size ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [variants, productById, q]);

  const totalFor = (vid: string) => Object.values(stockMap[vid] || {}).reduce((a, b) => a + b, 0);
  const isLow = (vid: string) => {
    const totals = stockMap[vid] || {};
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    return total > 0 && total <= 2;
  };

  const exportCsv = () => {
    const header = ["product_sku", "product_name", "variant_sku", "size", ...locs.map(l => l.code), "total"];
    const lines = filteredVariants.map((v) => {
      const p = productById[v.product_id];
      const cells = locs.map(l => stockMap[v.id]?.[l.id] ?? 0);
      return [p?.sku, p?.name, v.variant_sku, v.size ?? "", ...cells, totalFor(v.id)]
        .map(s => `"${String(s ?? "").replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([header.join(",") + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventario-espana-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Inventario por sedes</h2>
          <p className="text-sm text-muted-foreground">Stock real por sede y variante.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild><Link to="/espana/etiquetas"><QrCode className="h-4 w-4 mr-2" />Etiquetas</Link></Button>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Exportar</Button>
          <Button variant="outline" onClick={() => setMode("in")}><ArrowDownToLine className="h-4 w-4 mr-2" />Entrada</Button>
          <Button variant="outline" onClick={() => setMode("out")}><ArrowUpFromLine className="h-4 w-4 mr-2" />Salida</Button>
          <Button variant="outline" onClick={() => setMode("adjust")}><Sliders className="h-4 w-4 mr-2" />Ajuste</Button>
          <Button onClick={() => setMode("transfer")}><ArrowLeftRight className="h-4 w-4 mr-2" />Transferir</Button>
        </div>
      </div>

      <Card className="p-4">
        <Input placeholder="Buscar producto / SKU / talla..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm mb-3" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU variante</TableHead>
                <TableHead>Talla</TableHead>
                {locs.map(l => <TableHead key={l.id} className="text-right whitespace-nowrap">{l.name}</TableHead>)}
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVariants.length === 0 && <TableRow><TableCell colSpan={locs.length + 6} className="text-center py-8 text-sm text-muted-foreground">Sin variantes activas.</TableCell></TableRow>}
              {(() => {
                // Group visually by product with zebra alternation
                let lastProductId: string | null = null;
                let groupIdx = -1;
                return filteredVariants.map((v) => {
                  const p = productById[v.product_id];
                  const isNewGroup = v.product_id !== lastProductId;
                  if (isNewGroup) { groupIdx++; lastProductId = v.product_id; }
                  const zebra = groupIdx % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-zinc-50 dark:bg-zinc-900/30";
                  const border = isNewGroup ? "border-t-2 border-t-zinc-300 dark:border-t-zinc-700" : "";
                  return (
                    <TableRow key={v.id} className={`${zebra} ${border}`}>
                      <TableCell className="font-medium">{isNewGroup ? p?.name : <span className="text-muted-foreground/70 pl-3">↳</span>}</TableCell>
                      <TableCell className="font-mono text-xs">{v.variant_sku}</TableCell>
                      <TableCell>{v.size || "—"}</TableCell>
                      {locs.map(l => {
                        const qty = stockMap[v.id]?.[l.id] ?? 0;
                        const noStock = l.inventory_mode === "no_stock";
                        return <TableCell key={l.id} className={`text-right ${noStock ? "text-muted-foreground/50" : ""}`}>{noStock ? "—" : qty}</TableCell>;
                      })}
                      <TableCell className="text-right font-bold">{totalFor(v.id)}</TableCell>
                      <TableCell>{isLow(v.id) && <Badge variant="destructive" className="text-[10px]">bajo</Badge>}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button size="sm" variant="ghost" title="Entrada" onClick={() => openMode("in", v.id)}><ArrowDownToLine className="h-3.5 w-3.5 text-green-600" /></Button>
                          <Button size="sm" variant="ghost" title="Salida" onClick={() => openMode("out", v.id)}><ArrowUpFromLine className="h-3.5 w-3.5 text-red-600" /></Button>
                          <Button size="sm" variant="ghost" title="Ajuste" onClick={() => openMode("adjust", v.id)}><Sliders className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" title="Transferir" onClick={() => openMode("transfer", v.id)}><ArrowLeftRight className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" title="Historial" onClick={() => setHistoryOpen({ variantId: v.id })}><History className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" asChild title="Etiquetas">
                            <Link to={`/espana/etiquetas?producto=${v.product_id}`}><QrCode className="h-3.5 w-3.5" /></Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </div>
      </Card>

      <MovementDialog mode={mode} prefillVariantId={prefillVariantId} onClose={() => { setMode(null); setPrefillVariantId(null); }} locs={locs} variants={variants} products={products} onSaved={load} stockMap={stockMap} />
      {historyOpen && <HistoryDialog variantId={historyOpen.variantId} variants={variants} products={products} locs={locs} onClose={() => setHistoryOpen(null)} />}
    </div>
  );
}

function MovementDialog({ mode, prefillVariantId, onClose, locs, variants, products, stockMap, onSaved }: {
  mode: Mode; prefillVariantId?: string | null; onClose: () => void; locs: Loc[]; variants: Variant[]; products: Product[];
  stockMap: Record<string, Record<string, number>>; onSaved: () => void;
}) {
  const [variantId, setVariantId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode) { setVariantId(prefillVariantId || ""); setLocationId(""); setFromId(""); setToId(""); setQty(1); setReason(""); setNotes(""); }
  }, [mode, prefillVariantId]);

  if (!mode) return null;

  const titles: Record<string, string> = { in: "Entrada manual", out: "Salida manual", adjust: "Ajuste de stock", transfer: "Transferencia entre sedes" };
  const sellableLocs = locs.filter(l => l.inventory_mode !== "no_stock" && l.inventory_mode !== "woo_stock");

  const submit = async () => {
    if (!variantId) return toast.error("Selecciona variante");
    if (mode !== "transfer" && !locationId) return toast.error("Selecciona sede");
    if (mode === "transfer" && (!fromId || !toId)) return toast.error("Sedes origen y destino requeridas");
    if (!qty || qty <= 0) return toast.error("Cantidad inválida");
    if ((mode === "out" || mode === "adjust") && !reason) return toast.error("Motivo requerido");

    setSaving(true);
    let payload: any;
    if (mode === "in") payload = { p_movement_type: "manual_in", p_variant_id: variantId, p_quantity: qty, p_location_id: locationId, p_reason: reason || null, p_notes: notes || null };
    if (mode === "out") payload = { p_movement_type: "manual_out", p_variant_id: variantId, p_quantity: qty, p_location_id: locationId, p_reason: reason, p_notes: notes || null };
    if (mode === "adjust") payload = { p_movement_type: "adjustment", p_variant_id: variantId, p_quantity: qty, p_location_id: locationId, p_reason: reason, p_notes: notes || null };
    if (mode === "transfer") payload = { p_movement_type: "transfer", p_variant_id: variantId, p_quantity: qty, p_from_location_id: fromId, p_to_location_id: toId, p_reason: reason || null, p_notes: notes || null };

    const { error } = await supabase.rpc("esp_apply_movement", payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Movimiento registrado");
    onSaved(); onClose();
  };

  const variantOptions = variants.filter(v => v.status === "active").map(v => {
    const p = products.find(pp => pp.id === v.product_id);
    return { id: v.id, label: `${p?.name || "?"} · ${v.variant_sku}${v.size ? ` · ${v.size}` : ""}` };
  });

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{titles[mode]}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Variante</Label>
            <Select value={variantId} onValueChange={setVariantId}>
              <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {variantOptions.map(v => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {mode !== "transfer" && (
            <div className="space-y-1.5">
              <Label>Sede</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Sede..." /></SelectTrigger>
                <SelectContent>
                  {sellableLocs.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {variantId && locationId && <p className="text-[11px] text-muted-foreground">Stock actual: {stockMap[variantId]?.[locationId] ?? 0}</p>}
            </div>
          )}

          {mode === "transfer" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Desde</Label>
                <Select value={fromId} onValueChange={setFromId}>
                  <SelectTrigger><SelectValue placeholder="Origen" /></SelectTrigger>
                  <SelectContent>{sellableLocs.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Hacia</Label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                  <SelectContent>{sellableLocs.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{mode === "adjust" ? "Nueva cantidad (absoluta)" : "Cantidad"}</Label>
            <Input type="number" min={mode === "adjust" ? 0 : 1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>

          <div className="space-y-1.5">
            <Label>Motivo {(mode === "out" || mode === "adjust") && "*"}</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: rotura, recepción, regalo..." />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Guardando..." : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ variantId, variants, products, locs, onClose }: {
  variantId: string; variants: Variant[]; products: Product[]; locs: Loc[]; onClose: () => void;
}) {
  const [movs, setMovs] = useState<Movement[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("esp_inventory_movements").select("*").eq("variant_id", variantId).order("created_at", { ascending: false }).limit(100);
      if (data) setMovs(data as Movement[]);
    })();
  }, [variantId]);
  const locName = (id: string | null) => id ? (locs.find(l => l.id === id)?.name || "—") : "—";
  const v = variants.find(x => x.id === variantId);
  const p = v && products.find(pp => pp.id === v.product_id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Historial · {p?.name} · {v?.variant_sku}{v?.size ? ` · ${v.size}` : ""}</DialogTitle></DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Sede</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Antes → Después</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Sin movimientos.</TableCell></TableRow>}
            {movs.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-xs">{new Date(m.created_at).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{m.movement_type}</Badge></TableCell>
                <TableCell className="text-xs">
                  {m.movement_type.startsWith("transfer") ? `${locName(m.from_location_id)} → ${locName(m.to_location_id)}` : locName(m.location_id)}
                </TableCell>
                <TableCell className="text-right">{m.quantity}</TableCell>
                <TableCell className="text-right text-xs">{m.quantity_before ?? "—"} → {m.quantity_after ?? "—"}</TableCell>
                <TableCell className="text-xs">{m.reason || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
