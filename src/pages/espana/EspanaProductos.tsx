import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Package, Copy, Download } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  sku: string;
  name: string;
  product_type: string | null;
  status: string;
  is_sellable: boolean;
  price_eur: number | null;
  cost_eur: number | null;
  color: string | null;
  category: string | null;
  description: string | null;
  notes: string | null;
  image_url: string | null;
  has_variants: boolean;
  woo_product_id: number | null;
  source?: string | null;
  woo_permalink?: string | null;
  woo_status?: string | null;
  woo_synced_at?: string | null;
  fulfillment_mode?: string | null;
  web_stock_policy?: string | null;
  is_made_to_order?: boolean | null;
  requires_fabrication?: boolean | null;
  woo_manage_stock?: boolean | null;
  woo_stock_status?: string | null;
  woo_stock_quantity?: number | null;
}
interface Variant {
  id: string;
  product_id: string;
  variant_sku: string;
  size: string | null;
  color: string | null;
  barcode: string | null;
  qr_code: string | null;
  scan_code: string | null;
  status: string;
  price_eur: number | null;
  cost_eur: number | null;
  sort_order: number | null;
}

const STATUS = ["active", "inactive", "draft", "archived"];

export default function EspanaProductos() {
  const [rows, setRows] = useState<Product[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, Variant[]>>({});
  const [stockByVariant, setStockByVariant] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, v, s] = await Promise.all([
      supabase.from("esp_products").select("*").order("created_at", { ascending: false }),
      supabase.from("esp_product_variants").select("*").order("sort_order", { ascending: true }),
      supabase.from("esp_inventory_stock").select("variant_id, quantity_on_hand"),
    ]);
    if (p.data) setRows(p.data as Product[]);
    const map: Record<string, Variant[]> = {};
    (v.data as Variant[] | null)?.forEach((x) => {
      map[x.product_id] = map[x.product_id] || [];
      map[x.product_id].push(x);
    });
    setVariantsByProduct(map);
    const sm: Record<string, number> = {};
    (s.data as any[] | null)?.forEach((x) => {
      sm[x.variant_id] = (sm[x.variant_id] || 0) + (x.quantity_on_hand || 0);
    });
    setStockByVariant(sm);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (sourceFilter !== "all" && (r.source || "manual") !== sourceFilter) return false;
    if (q && !`${r.sku} ${r.name}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, q, statusFilter, sourceFilter]);

  const totalStock = (productId: string) => {
    const vs = variantsByProduct[productId] || [];
    return vs.reduce((acc, v) => acc + (stockByVariant[v.id] || 0), 0);
  };

  const exportCsv = () => {
    const header = "sku,name,product_type,status,price_eur,cost_eur,color,category";
    const lines = rows.map(r =>
      [r.sku, r.name, r.product_type ?? "", r.status, r.price_eur ?? "", r.cost_eur ?? "", r.color ?? "", r.category ?? ""]
        .map(s => `"${String(s).replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `productos-espana-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Productos España</h2>
          <p className="text-sm text-muted-foreground">Catálogo de productos, variantes y precios.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
          <Button onClick={() => { setEditing({ id: "", sku: "", name: "", product_type: "", status: "active", is_sellable: true, price_eur: null, cost_eur: null, color: "", category: "", description: "", notes: "", image_url: "", has_variants: true, woo_product_id: null }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nuevo producto
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex gap-2 mb-3 flex-wrap">
          <Input placeholder="Buscar por SKU o nombre..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda fuente</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="woocommerce_es">WooCommerce ES</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-center">Variantes</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Woo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Cargando...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Sin productos todavía.</TableCell></TableRow>}
              {filtered.map((p) => {
                const isWoo = p.source === "woocommerce_es";
                const mode = p.fulfillment_mode || "made_to_order";
                const isPhysical = mode === "physical_stock";
                const isMto = mode === "made_to_order";
                const isHybrid = mode === "hybrid";
                const noStockWebProblem =
                  isPhysical && p.woo_manage_stock && (p.woo_stock_quantity ?? 0) <= 0;
                return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{String(p.sku ?? "")}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{p.name}</span>
                      {isWoo
                        ? <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px]">Woo ES</Badge>
                        : <Badge variant="outline" className="text-[10px]">Manual</Badge>}
                      {isMto && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">Fabricación ligera</Badge>}
                      {isPhysical && <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-600">Stock físico</Badge>}
                      {isHybrid && <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-600">Híbrido</Badge>}
                      {p.requires_fabrication && <Badge variant="outline" className="text-[10px]">Req. fabricación</Badge>}
                      {!p.sku && <Badge variant="destructive" className="text-[10px]">Sin SKU</Badge>}
                      {p.sku && /^-?\d+([.,]\d+)?[eE][+-]?\d+$/.test(String(p.sku).trim()) && <Badge variant="destructive" className="text-[10px]">SKU inválido</Badge>}
                      {!(variantsByProduct[p.id]?.length) && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600/40">Sin variantes</Badge>}
                      {(variantsByProduct[p.id] || []).some(v => !v.scan_code && !v.variant_sku) && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600/40">Sin scan_code</Badge>}
                      {(variantsByProduct[p.id] || []).some(v => /^-?\d+([.,]\d+)?[eE][+-]?\d+$/.test(String(v.variant_sku ?? "").trim())) && <Badge variant="destructive" className="text-[10px]">Variante SKU inválido</Badge>}
                      {noStockWebProblem && <Badge variant="destructive" className="text-[10px]">Sin stock web</Badge>}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs">{p.product_type || "—"}</TableCell>
                  <TableCell><Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge></TableCell>
                  <TableCell className="text-right">{p.price_eur != null ? `€${Number(p.price_eur).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-center">{(variantsByProduct[p.id] || []).length}</TableCell>
                  <TableCell className="text-right">{totalStock(p.id)}</TableCell>
                  <TableCell className="text-xs">
                    {p.woo_product_id ? (
                      <span className="inline-flex flex-col">
                        <span>#{p.woo_product_id}</span>
                        <span className="text-[10px] text-muted-foreground">
                          manage_stock: {p.woo_manage_stock ? "Sí" : "No"}
                        </span>
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ProductDialog
        open={open}
        onOpenChange={setOpen}
        product={editing}
        variants={editing?.id ? variantsByProduct[editing.id] || [] : []}
        stockByVariant={stockByVariant}
        onSaved={() => { setOpen(false); load(); }}
      />
    </div>
  );
}

function ProductDialog({ open, onOpenChange, product, variants, stockByVariant, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  product: Product | null; variants: Variant[]; stockByVariant: Record<string, number>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Product | null>(product);
  const [vList, setVList] = useState<Variant[]>(variants);
  const [saving, setSaving] = useState(false);
  const [newV, setNewV] = useState<Partial<Variant>>({ variant_sku: "", size: "", color: "", price_eur: null, status: "active" });

  useEffect(() => { setForm(product); setVList(variants); }, [product, variants]);

  if (!form) return null;
  const isNew = !form.id;

  const save = async () => {
    if (!form.sku || !form.name) { toast.error("SKU y nombre son obligatorios"); return; }
    setSaving(true);
    const payload: any = {
      sku: form.sku, name: form.name, product_type: form.product_type || null,
      status: form.status, is_sellable: form.is_sellable, price_eur: form.price_eur,
      cost_eur: form.cost_eur, color: form.color || null, category: form.category || null,
      description: form.description || null, notes: form.notes || null,
      image_url: form.image_url || null, has_variants: form.has_variants,
      fulfillment_mode: form.fulfillment_mode || "made_to_order",
      web_stock_policy: form.web_stock_policy || "no_web_stock",
      is_made_to_order: !!form.is_made_to_order,
      requires_fabrication: !!form.requires_fabrication,
    };
    let res;
    if (isNew) {
      res = await supabase.from("esp_products").insert(payload).select().single();
    } else {
      res = await supabase.from("esp_products").update(payload).eq("id", form.id).select().single();
    }
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Producto guardado");
    onSaved();
  };

  const addVariant = async () => {
    if (!form.id) { toast.error("Guarda el producto primero"); return; }
    if (!newV.variant_sku) { toast.error("SKU de variante requerido"); return; }
    const { data, error } = await supabase.from("esp_product_variants").insert({
      product_id: form.id,
      variant_sku: newV.variant_sku!,
      size: newV.size || null, color: newV.color || null,
      price_eur: newV.price_eur ?? null, status: newV.status || "active",
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setVList([...vList, data as Variant]);
    setNewV({ variant_sku: "", size: "", color: "", price_eur: null, status: "active" });
    toast.success("Variante creada");
  };

  const toggleVariant = async (v: Variant) => {
    const ns = v.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("esp_product_variants").update({ status: ns }).eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    setVList(vList.map(x => x.id === v.id ? { ...x, status: ns } : x));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew ? "Nuevo producto" : `Editar: ${form.name}`}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>SKU *</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Tipo</Label><Input value={form.product_type || ""} onChange={e => setForm({ ...form, product_type: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Categoría</Label><Input value={form.category || ""} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Color</Label><Input value={form.color || ""} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Precio EUR</Label><Input type="number" step="0.01" value={form.price_eur ?? ""} onChange={e => setForm({ ...form, price_eur: e.target.value ? Number(e.target.value) : null })} /></div>
          <div className="space-y-1.5"><Label>Coste EUR</Label><Input type="number" step="0.01" value={form.cost_eur ?? ""} onChange={e => setForm({ ...form, cost_eur: e.target.value ? Number(e.target.value) : null })} /></div>
          <div className="flex items-center gap-2"><Switch checked={form.is_sellable} onCheckedChange={(v) => setForm({ ...form, is_sellable: v })} /><Label>Vendible</Label></div>
          <div className="flex items-center gap-2"><Switch checked={form.has_variants} onCheckedChange={(v) => setForm({ ...form, has_variants: v })} /><Label>Con variantes</Label></div>
          <div className="col-span-2 space-y-1.5"><Label>Descripción</Label><Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div>

        {!isNew && (
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-bold flex items-center gap-2"><Package className="h-4 w-4" />Variantes / Tallas</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead><TableHead>Talla</TableHead><TableHead>Color</TableHead>
                    <TableHead>Scan code</TableHead><TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Stock</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vList.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.variant_sku}</TableCell>
                      <TableCell>{v.size || "—"}</TableCell>
                      <TableCell>{v.color || "—"}</TableCell>
                      <TableCell className="font-mono text-xs flex items-center gap-1">
                        {v.scan_code || v.variant_sku}
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => { navigator.clipboard.writeText(v.scan_code || v.variant_sku); toast.success("Copiado"); }}><Copy className="h-3 w-3" /></Button>
                      </TableCell>
                      <TableCell className="text-right">{v.price_eur != null ? `€${Number(v.price_eur).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-right">{stockByVariant[v.id] || 0}</TableCell>
                      <TableCell><Badge variant={v.status === "active" ? "default" : "outline"}>{v.status}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => toggleVariant(v)}>{v.status === "active" ? "Desactivar" : "Activar"}</Button></TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell><Input placeholder="SKU variante" value={newV.variant_sku || ""} onChange={e => setNewV({ ...newV, variant_sku: e.target.value })} /></TableCell>
                    <TableCell><Input placeholder="Talla" value={newV.size || ""} onChange={e => setNewV({ ...newV, size: e.target.value })} /></TableCell>
                    <TableCell><Input placeholder="Color" value={newV.color || ""} onChange={e => setNewV({ ...newV, color: e.target.value })} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">auto = SKU</TableCell>
                    <TableCell><Input type="number" step="0.01" placeholder="€" value={newV.price_eur ?? ""} onChange={e => setNewV({ ...newV, price_eur: e.target.value ? Number(e.target.value) : null })} /></TableCell>
                    <TableCell></TableCell><TableCell></TableCell>
                    <TableCell><Button size="sm" onClick={addVariant}><Plus className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
