import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, Search, Power, PowerOff, Copy, Upload, Download, FileSpreadsheet, RefreshCw, Inbox, Cloud, ChevronDown, ChevronRight } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";
import { cn } from "@/lib/utils";

type Variant = {
  id: string;
  core_product_id: string;
  size: string;
  variant_sku: string | null;
  woo_sku: string | null;
  status: string;
  sort_order: number | null;
};

type Product = {
  id: string;
  core_sku: string;
  name: string;
  product_type: string | null;
  color: string | null;
  commercial_status: string;
  is_restockable: boolean;
  unit_cost: number;
  currency: string;
  estimated_sale_price: number | null;
  woo_product_id: number | null;
  woo_product_name: string | null;
  sku_source: string;
  sync_status: string;
  updated_at: string;
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Borrador", variant: "outline" },
  active: { label: "Activo", variant: "default" },
  inactive: { label: "Inactivo", variant: "secondary" },
  discontinued: { label: "Descontinuado", variant: "destructive" },
  stock_only: { label: "Solo venta stock", variant: "secondary" },
};

const PRODUCT_TYPES = ["Franela", "Hoodie", "Jogger", "Cargo", "Short", "Gorra", "Accesorio", "Producto terminado", "Otro"];

export default function CoreProducts() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextSku, setNextSku] = useState<string>("CORE000001");
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fType, setFType] = useState("all");
  const [fRestock, setFRestock] = useState("all");

  const [toDelete, setToDelete] = useState<Product | null>(null);

  async function loadNextSku() {
    const { data } = await supabase.from("core_settings").select("sku_prefix, sku_digits, sku_last_number").maybeSingle();
    const prefix = data?.sku_prefix ?? "CORE";
    const digits = data?.sku_digits ?? 6;
    const last = data?.sku_last_number ?? 0;
    setNextSku(`${prefix}${String(last + 1).padStart(digits, "0")}`);
  }

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [variantsByProduct, setVariantsByProduct] = useState<Map<string, Variant[]>>(new Map());

  async function loadVariants(productId: string) {
    const { data, error } = await supabase
      .from("core_product_variants")
      .select("id, core_product_id, size, variant_sku, woo_sku, status, sort_order")
      .eq("core_product_id", productId)
      .order("sort_order", { nullsFirst: false })
      .order("size");
    if (error) { toast.error(error.message); return; }
    setVariantsByProduct(prev => {
      const m = new Map(prev);
      m.set(productId, (data as any) ?? []);
      return m;
    });
  }

  async function toggleExpand(p: Product) {
    const n = new Set(expanded);
    if (n.has(p.id)) { n.delete(p.id); setExpanded(n); return; }
    n.add(p.id);
    setExpanded(n);
    if (!variantsByProduct.has(p.id)) await loadVariants(p.id);
  }

  async function toggleVariantStatus(v: Variant) {
    const newStatus = v.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("core_product_variants").update({ status: newStatus }).eq("id", v.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_product_variants", recordId: v.id, action: "update", field: "status", oldValue: v.status, newValue: newStatus });
    toast.success(`Talla ${v.size}: ${newStatus === "active" ? "activada" : "desactivada"}`);
    loadVariants(v.core_product_id);
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("core_products")
      .select("id, core_sku, name, product_type, color, commercial_status, is_restockable, unit_cost, currency, estimated_sale_price, woo_product_id, woo_product_name, sku_source, sync_status, updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error("Error cargando productos: " + error.message);
    setItems((data as any) ?? []);
    const { count } = await supabase.from("core_woo_product_candidates").select("id", { count: "exact", head: true }).in("status", ["pendiente", "conflicto", "requiere_sku"]);
    setPendingCount(count ?? 0);
    setLoading(false);
    loadNextSku();
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter(p => {
    if (search) {
      const s = search.toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !p.core_sku.toLowerCase().includes(s)) return false;
    }
    if (fStatus !== "all" && p.commercial_status !== fStatus) return false;
    if (fType !== "all" && p.product_type !== fType) return false;
    if (fRestock === "yes" && !p.is_restockable) return false;
    if (fRestock === "no" && p.is_restockable) return false;
    return true;
  }), [items, search, fStatus, fType, fRestock]);

  async function toggleStatus(p: Product) {
    const newStatus = p.commercial_status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("core_products").update({ commercial_status: newStatus }).eq("id", p.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_products", recordId: p.id, action: "update", field: "commercial_status", oldValue: p.commercial_status, newValue: newStatus });
    toast.success(newStatus === "active" ? "Producto activado" : "Producto desactivado");
    load();
  }

  async function toggleRestock(p: Product) {
    const newVal = !p.is_restockable;
    const { error } = await supabase.from("core_products").update({ is_restockable: newVal }).eq("id", p.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_products", recordId: p.id, action: "update", field: "is_restockable", oldValue: p.is_restockable, newValue: newVal });
    toast.success(newVal ? "Marcado restockeable" : "Marcado no restockeable");
    load();
  }

  async function duplicate(p: Product) {
    const { data: full } = await supabase.from("core_products").select("*").eq("id", p.id).maybeSingle();
    if (!full) return toast.error("No se pudo cargar");
    const { data: vars } = await supabase.from("core_product_variants").select("*").eq("core_product_id", p.id);

    // generate next sku
    const { data: settings } = await supabase.from("core_settings").select("id, sku_prefix, sku_digits, sku_last_number").maybeSingle();
    const prefix = settings?.sku_prefix ?? "CORE";
    const digits = settings?.sku_digits ?? 6;
    const nextNum = (settings?.sku_last_number ?? 0) + 1;
    const newSku = `${prefix}${String(nextNum).padStart(digits, "0")}`;

    const { id, created_at, updated_at, core_sku, woo_product_id, woo_product_name, woo_sku, woo_permalink, woo_status, woo_stock_quantity, woo_regular_price, woo_sale_price, woo_last_sync_at, ...rest } = full as any;
    const { data: newRow, error } = await supabase
      .from("core_products")
      .insert({ ...rest, core_sku: newSku, name: `${full.name} (copia)`, commercial_status: "draft" })
      .select()
      .single();
    if (error || !newRow) return toast.error(error?.message ?? "No se pudo duplicar");

    if (settings?.id) {
      await supabase.from("core_settings").update({ sku_last_number: nextNum }).eq("id", settings.id);
    }

    if (vars && vars.length > 0) {
      const newVars = (vars as any[]).map(({ id, created_at, updated_at, core_product_id, woo_variation_id, woo_sku, woo_stock_quantity, woo_regular_price, woo_sale_price, woo_last_sync_at, ...r }) => ({
        ...r, core_product_id: newRow.id,
      }));
      await supabase.from("core_product_variants").insert(newVars);
    }

    await logCoreAudit({ table: "core_products", recordId: newRow.id, action: "duplicate", oldValue: p.id, newValue: newRow.id });
    toast.success(`Producto duplicado: ${newSku}`);
    load();
  }

  async function handleDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("core_products").delete().eq("id", toDelete.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_products", recordId: toDelete.id, action: "delete", field: "record", oldValue: toDelete.core_sku, newValue: null });
    toast.success("Producto eliminado");
    setToDelete(null);
    load();
  }

  const placeholder = () => toast.info("La importación/exportación del Catálogo de Fabricación se conectará al sistema de Templates de Carga en un siguiente ajuste.");

  async function runSync(mode: "catalog" | "sales") {
    setSyncing(true);
    try {
      const params = new URLSearchParams({ mode });
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/core-woo-sync?${params}`;
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${sess.session?.access_token}`, "Content-Type": "application/json" } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error de sincronización");
      const s = json.summary;
      toast.success(`${mode === "catalog" ? "Catálogo" : "Ventas"}: ${s.scanned} escaneados · ${s.auto_linked} auto-enlazados · ${s.candidates_added} pendientes${s.conflicts ? ` · ${s.conflicts} conflictos` : ""}`);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Error sincronizando");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Productos Core</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo maestro de productos de fabricación conectados a costos, WooCommerce y restock.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Próximo SKU estimado (fallback): <span className="font-mono font-semibold text-foreground">{nextSku}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={loadNextSku} title="Refrescar"><RefreshCw className="h-3 w-3" /></Button>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => runSync("catalog")} disabled={syncing}>
            <Cloud className="h-4 w-4 mr-1" />{syncing ? "Sincronizando…" : "Sincronizar catálogo Woo"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => runSync("sales")} disabled={syncing}>
            <RefreshCw className="h-4 w-4 mr-1" />Sincronizar ventas
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/core/productos/pendientes")}>
            <Inbox className="h-4 w-4 mr-1" />Pendientes Woo
            {pendingCount > 0 && <Badge variant="destructive" className="ml-2 px-1.5 h-5">{pendingCount}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={placeholder}><FileSpreadsheet className="h-4 w-4 mr-1" />Formato base</Button>
          <Button variant="outline" size="sm" onClick={placeholder}><Upload className="h-4 w-4 mr-1" />Importar</Button>
          <Button variant="outline" size="sm" onClick={placeholder}><Download className="h-4 w-4 mr-1" />Exportar</Button>
          <Button size="sm" onClick={() => navigate("/core/productos/nuevo")}><Plus className="h-4 w-4 mr-1" />Nuevo producto Core</Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
              <SelectItem value="discontinued">Descontinuados</SelectItem>
              <SelectItem value="stock_only">Solo stock</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fType} onValueChange={setFType}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fRestock} onValueChange={setFRestock}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Restock: todos</SelectItem>
              <SelectItem value="yes">Restockeables</SelectItem>
              <SelectItem value="no">No restockeables</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>SKU Core</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Restock</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead>WooCommerce</TableHead>
                <TableHead>Actualización</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sin productos</TableCell></TableRow>
              ) : filtered.map(p => {
                const st = STATUS_LABELS[p.commercial_status] ?? { label: p.commercial_status, variant: "outline" as const };
                const isOpen = expanded.has(p.id);
                const vars = variantsByProduct.get(p.id) ?? [];
                const activeCount = vars.filter(v => v.status === "active").length;
                return (
                  <Fragment key={p.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggleExpand(p)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(p)} title="Ver tallas">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        <div>{p.core_sku}</div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {p.sku_source === "woocommerce" && <Badge variant="outline" className="text-[10px] py-0 px-1">Woo</Badge>}
                          {p.sync_status === "draft_from_woo" && <Badge variant="secondary" className="text-[10px] py-0 px-1">borrador Woo</Badge>}
                          {p.sync_status === "conflict" && <Badge variant="destructive" className="text-[10px] py-0 px-1">conflicto</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.color && <div className="text-xs text-muted-foreground">{p.color}</div>}
                        {isOpen && vars.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">{activeCount} de {vars.length} tallas activas</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.product_type || "—"}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Switch checked={p.is_restockable} onCheckedChange={() => toggleRestock(p)} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(p.unit_cost).toFixed(2)} {p.currency}</TableCell>
                      <TableCell className="text-xs">
                        {p.woo_product_id ? (
                          <span className="text-muted-foreground">#{p.woo_product_id}{p.woo_product_name ? ` · ${p.woo_product_name}` : ""}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/core/productos/${p.id}`)} title="Ver/Editar"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/core/productos/${p.id}`)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => duplicate(p)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleStatus(p)} title={p.commercial_status === "active" ? "Desactivar" : "Activar"}>
                            {p.commercial_status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(p)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell colSpan={9} className="py-3">
                          {vars.length === 0 ? (
                            <div className="text-xs text-muted-foreground italic">Este producto no tiene tallas/variaciones configuradas. <Button variant="link" size="sm" className="h-auto p-0 ml-1" onClick={() => navigate(`/core/productos/${p.id}`)}>Configurar</Button></div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tallas / variaciones en Core</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {vars.map(v => (
                                  <div key={v.id} className={cn(
                                    "flex items-center justify-between gap-3 rounded-md border px-3 py-2 bg-background",
                                    v.status !== "active" && "opacity-60"
                                  )}>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-sm">Talla {v.size}</div>
                                      <div className="text-[11px] font-mono text-muted-foreground truncate">{v.variant_sku || v.woo_sku || "—"}</div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className={cn("text-[10px] font-medium", v.status === "active" ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                                        {v.status === "active" ? "ON" : "OFF"}
                                      </span>
                                      <Switch checked={v.status === "active"} onCheckedChange={() => toggleVariantStatus(v)} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto Core?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará <strong>{toDelete?.core_sku} — {toDelete?.name}</strong> y todas sus tallas/variaciones.
              Cuando existan órdenes de producción o partidas asociadas, ya no podrá eliminarse, solo desactivarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
