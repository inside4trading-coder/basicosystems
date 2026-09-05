import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, RefreshCw, Loader2, Link2, Archive, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const SCI_RE = /^-?\d+([.,]\d+)?[eE][+-]?\d+$/;
const isSci = (s: unknown) => !!s && SCI_RE.test(String(s).trim());
const isEmpty = (s: unknown) => s == null || String(s).trim() === "";

type Product = { id: string; sku: string | null; name: string; source: string | null; status: string | null; has_variants: boolean | null; woo_product_id: number | null; woo_permalink: string | null; woo_synced_at: string | null };
type Variant = { id: string; product_id: string; variant_sku: string | null; size: string | null; color: string | null; scan_code: string | null; source: string | null; status: string | null; woo_variation_id: number | null; woo_synced_at: string | null };
type UnmappedItem = {
  id: string; woo_order_id: number; woo_order_item_id: number | null; name: string | null; sku: string | null;
  woo_product_id: number | null; woo_variation_id: number | null; quantity: number; total_eur: number | null;
  product_id: string | null; variant_id: string | null; mapping_status: string; mapping_note: string | null;
  created_at: string;
  esp_woo_orders?: { customer_name: string | null; customer_email: string | null; order_number: string | null; status: string } | null;
};

export default function EspanaWooProblemas() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [items, setItems] = useState<UnmappedItem[]>([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulking, setBulking] = useState(false);
  const [mapItem, setMapItem] = useState<UnmappedItem | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, v, it] = await Promise.all([
      supabase.from("esp_products").select("id, sku, name, source, status, has_variants, woo_product_id, woo_permalink, woo_synced_at"),
      supabase.from("esp_product_variants").select("id, product_id, variant_sku, size, color, scan_code, source, status, woo_variation_id, woo_synced_at"),
      supabase.from("esp_woo_order_items")
        .select("id, woo_order_id, woo_order_item_id, name, sku, woo_product_id, woo_variation_id, quantity, total_eur, product_id, variant_id, mapping_status, mapping_note, created_at, esp_woo_orders(customer_name, customer_email, order_number, status)")
        .or("product_id.is.null,variant_id.is.null")
        .neq("mapping_status", "mapped")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    setProducts((p.data || []) as any);
    setVariants((v.data || []) as any);
    setItems((it.data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const variantsByProduct = useMemo(() => {
    const m = new Map<string, Variant[]>();
    variants.forEach(v => { const a = m.get(v.product_id) || []; a.push(v); m.set(v.product_id, a); });
    return m;
  }, [variants]);

  // SKU problems
  const invalidProducts = products.filter(p => isSci(p.sku));
  const productsNoSku = products.filter(p => isEmpty(p.sku) && p.status === "active");
  const productsNoVariants = products.filter(p => !((variantsByProduct.get(p.id) || []).length));
  const invalidVariants = variants.filter(v => isSci(v.variant_sku) || isSci(v.scan_code));
  const variantsNoSku = variants.filter(v => isEmpty(v.variant_sku) && v.status === "active");
  const variantsNoScan = variants.filter(v => isEmpty(v.scan_code) && v.status === "active");

  // Items breakdown
  const legacyCandidates = items.filter(i =>
    i.mapping_status === "pending" && !i.woo_product_id && !i.woo_variation_id && isEmpty(i.sku)
  );
  const itemsPending = items.filter(i => i.mapping_status === "pending");
  const itemsLegacy = items.filter(i => i.mapping_status === "legacy_unmapped");
  const itemsIgnored = items.filter(i => i.mapping_status === "ignored");

  const reasonFor = (i: UnmappedItem) => {
    if (!i.woo_product_id && !i.woo_variation_id && isEmpty(i.sku)) return "Sin referencias Woo (legacy)";
    if (i.woo_variation_id && !i.variant_id) return "woo_variation_id no encontrado en catálogo";
    if (i.woo_product_id && !i.product_id) return "woo_product_id no encontrado en catálogo";
    if (!isEmpty(i.sku) && !i.variant_id) return "SKU no encontrado en catálogo";
    return "Pendiente de revisar";
  };

  const criticalCount = invalidProducts.length + invalidVariants.length + variantsNoScan.length + productsNoSku.length;
  const legacyCount = legacyCandidates.length + itemsLegacy.length;

  const updateItemStatus = async (id: string, status: string, note?: string) => {
    const { error } = await supabase.from("esp_woo_order_items")
      .update({ mapping_status: status, mapping_note: note ?? null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item actualizado");
    load();
  };

  const bulkMarkLegacy = async () => {
    setBulking(true);
    const ids = legacyCandidates.map(i => i.id);
    if (!ids.length) { setBulking(false); setBulkConfirm(false); return; }
    const { error } = await supabase.from("esp_woo_order_items")
      .update({ mapping_status: "legacy_unmapped", mapping_note: "Producto Woo histórico sin referencias recuperables." })
      .in("id", ids);
    setBulking(false); setBulkConfirm(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} items marcados como legacy`);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="num text-2xl font-black tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" /> Problemas Woo
          </h2>
          <p className="text-sm text-muted-foreground">SKUs inválidos, items sin mapear y mantenimiento de catálogo · sin tocar WooCommerce</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
          Refrescar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Críticos" value={criticalCount} tone="destructive" />
        <KPI label="SKU inválido" value={invalidProducts.length + invalidVariants.length} tone="destructive" />
        <KPI label="Sin scan_code" value={variantsNoScan.length} tone="amber" />
        <KPI label="Items sin mapear" value={itemsPending.length} tone="amber" />
        <KPI label="Legacy" value={legacyCount} tone="muted" />
      </div>

      <Tabs defaultValue="sku">
        <TabsList>
          <TabsTrigger value="sku">SKUs y catálogo</TabsTrigger>
          <TabsTrigger value="unmapped">Items sin mapear ({itemsPending.length})</TabsTrigger>
          <TabsTrigger value="legacy">Legacy ({itemsLegacy.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sku" className="space-y-4">
          <Section title={`SKUs en notación científica · productos (${invalidProducts.length})`} warn>
            {invalidProducts.length === 0 ? <Empty>Sin productos con SKU inválido.</Empty> : (
              <Table>
                <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>SKU</TableHead><TableHead>Source</TableHead><TableHead>Woo</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {invalidProducts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs font-mono text-destructive">{String(p.sku)}</TableCell>
                      <TableCell className="text-xs">{p.source || "manual"}</TableCell>
                      <TableCell className="text-xs">{p.woo_product_id ? <Badge variant="outline">#{p.woo_product_id}</Badge> : "—"}</TableCell>
                      <TableCell className="text-right">
                        {p.woo_permalink && <a href={p.woo_permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" />Abrir Woo</a>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {invalidProducts.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">⚠ Estos productos vienen de WooCommerce. Corrige el SKU en WooCommerce y vuelve a sincronizar para no romper el matching.</p>
            )}
          </Section>

          <Section title={`Variantes con variant_sku o scan_code inválido (${invalidVariants.length})`} warn>
            {invalidVariants.length === 0 ? <Empty>Sin variantes con SKU/scan inválido.</Empty> : (
              <Table>
                <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Variante</TableHead><TableHead>variant_sku</TableHead><TableHead>scan_code</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invalidVariants.map(v => {
                    const p = products.find(p => p.id === v.product_id);
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs">{p?.name || "—"}</TableCell>
                        <TableCell className="text-xs">{[v.size, v.color].filter(Boolean).join(" · ") || "—"}</TableCell>
                        <TableCell className="text-xs font-mono text-destructive">{isSci(v.variant_sku) ? String(v.variant_sku) : v.variant_sku || "—"}</TableCell>
                        <TableCell className="text-xs font-mono text-destructive">{isSci(v.scan_code) ? String(v.scan_code) : v.scan_code || "—"}</TableCell>
                        <TableCell className="text-xs">{v.source || "manual"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section title={`Variantes activas sin scan_code (${variantsNoScan.length})`}>
            {variantsNoScan.length === 0 ? <Empty>Todas las variantes activas tienen scan_code.</Empty> : (
              <ul className="text-xs space-y-1 max-h-60 overflow-auto">
                {variantsNoScan.slice(0, 100).map(v => {
                  const p = products.find(p => p.id === v.product_id);
                  return <li key={v.id}>· <span className="font-medium">{p?.name}</span> — {[v.size, v.color].filter(Boolean).join(" · ")} <span className="font-mono text-muted-foreground">[{v.variant_sku}]</span></li>;
                })}
              </ul>
            )}
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MiniSection title={`Productos activos sin SKU (${productsNoSku.length})`} items={productsNoSku.map(p => p.name)} />
            <MiniSection title={`Variantes activas sin SKU (${variantsNoSku.length})`} items={variantsNoSku.map(v => products.find(p=>p.id===v.product_id)?.name + " · " + [v.size,v.color].filter(Boolean).join(" "))} />
            <MiniSection title={`Productos sin variantes (${productsNoVariants.length})`} items={productsNoVariants.map(p => p.name)} />
          </div>
        </TabsContent>

        <TabsContent value="unmapped" className="space-y-4">
          {legacyCandidates.length > 0 && (
            <Card className="p-4 bg-amber-500/10 border-amber-500/30">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold">{legacyCandidates.length} items sin referencias Woo (legacy)</p>
                  <p className="text-xs text-muted-foreground">Items históricos sin woo_product_id, woo_variation_id ni SKU. Probablemente productos borrados en WooCommerce.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setBulkConfirm(true)}>
                  <Archive className="h-3.5 w-3.5 mr-2" />Marcar todos como legacy
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Producto Woo</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsPending.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Sin items pendientes 🎉</TableCell></TableRow>}
                {itemsPending.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs">#{i.esp_woo_orders?.order_number || i.woo_order_id}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate">{i.name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{i.sku || <span className="text-muted-foreground italic">vacío</span>}</TableCell>
                    <TableCell className="text-right text-xs">{i.quantity}</TableCell>
                    <TableCell className="text-right text-xs">{i.total_eur != null ? `€${Number(i.total_eur).toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-xs max-w-[160px] truncate">{i.esp_woo_orders?.customer_name || "—"}</TableCell>
                    <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{reasonFor(i)}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setMapItem(i)}>
                          <Link2 className="h-3 w-3 mr-1" />Mapear
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => updateItemStatus(i.id, "legacy_unmapped", "Marcado como legacy manualmente")}>
                          <Archive className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => updateItemStatus(i.id, "ignored", "Ignorado manualmente")}>
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="legacy" className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Producto Woo</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Cant.</TableHead><TableHead>Estado</TableHead><TableHead>Nota</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...itemsLegacy, ...itemsIgnored].length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sin items marcados como legacy.</TableCell></TableRow>}
                {[...itemsLegacy, ...itemsIgnored].map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs">#{i.esp_woo_orders?.order_number || i.woo_order_id}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate">{i.name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{i.sku || "—"}</TableCell>
                    <TableCell className="text-right text-xs">{i.quantity}</TableCell>
                    <TableCell className="text-xs"><Badge variant="outline">{i.mapping_status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{i.mapping_note || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => updateItemStatus(i.id, "pending", null)}>
                        Reabrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar {legacyCandidates.length} items como legacy</DialogTitle>
            <DialogDescription>
              Esto no borra datos. Solo deja de tratarlos como problemas activos. Se usará la nota: "Producto Woo histórico sin referencias recuperables."
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkConfirm(false)}>Cancelar</Button>
            <Button onClick={bulkMarkLegacy} disabled={bulking}>
              {bulking && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManualMapDialog item={mapItem} products={products} variants={variants} onClose={() => setMapItem(null)} onSaved={load} />
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: number; tone: "destructive" | "amber" | "muted" }) {
  const cls = tone === "destructive" ? "text-destructive" : tone === "amber" ? "text-amber-600" : "text-muted-foreground";
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`text-2xl font-black ${cls}`}>{value}</p>
    </Card>
  );
}

function Section({ title, warn, children }: { title: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <Card className={`p-4 ${warn ? "border-destructive/30" : ""}`}>
      <h3 className="text-sm font-bold mb-3">{title}</h3>
      {children}
    </Card>
  );
}
function Empty({ children }: { children: React.ReactNode }) { return <p className="text-xs text-muted-foreground">{children}</p>; }
function MiniSection({ title, items }: { title: string; items: (string | null | undefined)[] }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-bold mb-2">{title}</p>
      {items.length === 0 ? <p className="text-[11px] text-muted-foreground">Nada que revisar.</p> : (
        <ul className="text-[11px] space-y-0.5 max-h-40 overflow-auto">
          {items.slice(0, 60).map((n, i) => <li key={i} className="truncate">· {n}</li>)}
        </ul>
      )}
    </Card>
  );
}

function ManualMapDialog({ item, products, variants, onClose, onSaved }: {
  item: UnmappedItem | null; products: Product[]; variants: Variant[]; onClose: () => void; onSaved: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selVariant, setSelVariant] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (item) { setSearch(item.name || item.sku || ""); setSelVariant(""); setNote(""); } }, [item]);

  const results = useMemo(() => {
    if (!item || !search.trim()) return [] as { v: Variant; p: Product }[];
    const q = search.toLowerCase();
    const out: { v: Variant; p: Product }[] = [];
    for (const v of variants) {
      const p = products.find(p => p.id === v.product_id);
      if (!p) continue;
      const hay = `${p.name} ${p.sku || ""} ${v.variant_sku || ""} ${v.size || ""} ${v.color || ""}`.toLowerCase();
      if (hay.includes(q)) out.push({ v, p });
      if (out.length >= 30) break;
    }
    return out;
  }, [search, products, variants, item]);

  const save = async () => {
    if (!item || !selVariant) return;
    const v = variants.find(x => x.id === selVariant);
    if (!v) return;
    setSaving(true);
    const { error } = await supabase.from("esp_woo_order_items").update({
      product_id: v.product_id,
      variant_id: v.id,
      mapping_status: "manually_mapped",
      mapping_note: note || "Mapeado manualmente",
      mapped_manually_at: new Date().toISOString(),
    }).eq("id", item.id);
    if (error) { setSaving(false); toast.error(error.message); return; }

    // Sync esp_sale_items snapshot (only if currently null, don't touch totals/quantity)
    if (item.woo_order_item_id) {
      await supabase.from("esp_sale_items")
        .update({ product_id: v.product_id, variant_id: v.id })
        .eq("woo_order_item_id", item.woo_order_item_id)
        .is("product_id", null);
    }
    setSaving(false);
    toast.success("Item mapeado manualmente");
    onClose(); onSaved();
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mapear item manualmente</DialogTitle>
          <DialogDescription>
            {item && <>Item Woo: <span className="font-mono">{item.name}</span> · SKU: <span className="font-mono">{item.sku || "vacío"}</span> · Cant. {item.quantity}</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Buscar producto o variante por nombre, SKU, talla, color..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="max-h-72 overflow-auto border rounded-md">
            <Table>
              <TableHeader><TableRow><TableHead></TableHead><TableHead>Producto</TableHead><TableHead>Variante</TableHead><TableHead>SKU</TableHead></TableRow></TableHeader>
              <TableBody>
                {results.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">Sin resultados. Escribe para buscar.</TableCell></TableRow>}
                {results.map(({ v, p }) => (
                  <TableRow key={v.id} className={selVariant === v.id ? "bg-primary/10" : "cursor-pointer"} onClick={() => setSelVariant(v.id)}>
                    <TableCell className="w-8"><input type="radio" checked={selVariant === v.id} onChange={() => setSelVariant(v.id)} /></TableCell>
                    <TableCell className="text-xs">{p.name}</TableCell>
                    <TableCell className="text-xs">{[v.size, v.color].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{v.variant_sku || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Textarea placeholder="Nota opcional (motivo del mapeo, contexto histórico...)" value={note} onChange={e => setNote(e.target.value)} rows={2} />
          <p className="text-[11px] text-muted-foreground">No se modifica WooCommerce ni el total/cantidad del pedido. Si la venta ya existe sin producto vinculado, se actualizará el snapshot.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!selVariant || saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}Confirmar mapeo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
