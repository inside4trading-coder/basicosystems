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
import { Plus, Pencil, Trash2, Eye, Search, Power, PowerOff, Copy, Upload, Download, FileSpreadsheet, RefreshCw, Inbox, Cloud, ChevronDown, ChevronRight, History } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";
import { cn } from "@/lib/utils";
import { formatDMY } from "@/lib/dateUtils";
import { downloadTemplate, exportCatalog } from "@/lib/coreProductImport";
import { ProductImportDialog } from "@/components/core/ProductImportDialog";

type Variant = {
  id: string;
  core_product_id: string;
  size: string;
  color: string | null;
  variant_sku: string | null;
  woo_sku: string | null;
  woo_variation_id: number | null;
  status: string;
  sort_order: number | null;
  cost_override_enabled: boolean;
  uses_parent_cost_structure: boolean;
  variant_unit_cost_usd: number | null;
  resolved_unit_cost?: number;
  cost_source?: string;
};

type CostRange = {
  variant_count: number;
  variants_with_override: number;
  has_overrides: boolean;
  min_unit_cost: number;
  max_unit_cost: number;
  base_unit_cost: number;
};


type Product = {
  id: string;
  core_sku: string;
  name: string;
  product_type: string | null;
  color: string | null;
  commercial_status: string;
  is_restockable: boolean;
  product_priority: string | null;
  replenishment_mode: string | null;
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

const PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
  core_essential: { label: "Core / Esencial", cls: "bg-red-600 text-white border-transparent" },
  regular: { label: "Regular", cls: "bg-muted text-foreground" },
  seasonal: { label: "Temporada", cls: "bg-amber-500 text-black border-transparent" },
  limited_drop: { label: "Drop limitado", cls: "bg-purple-600 text-white border-transparent" },
  test: { label: "Prueba", cls: "bg-blue-500 text-white border-transparent" },
  low: { label: "Baja prioridad", cls: "bg-muted text-muted-foreground" },
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
  const [toResetVariant, setToResetVariant] = useState<Variant | null>(null);


  async function loadNextSku() {
    const { data } = await supabase.from("core_settings").select("sku_prefix, sku_digits, sku_last_number").maybeSingle();
    const prefix = data?.sku_prefix ?? "CORE";
    const digits = data?.sku_digits ?? 6;
    const last = data?.sku_last_number ?? 0;
    setNextSku(`${prefix}${String(last + 1).padStart(digits, "0")}`);
  }

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [variantsByProduct, setVariantsByProduct] = useState<Map<string, Variant[]>>(new Map());

  const [costRanges, setCostRanges] = useState<Map<string, CostRange>>(new Map());

  async function loadVariants(productId: string) {
    const { data, error } = await supabase
      .from("core_product_variants")
      .select("id, core_product_id, size, color, variant_sku, woo_sku, woo_variation_id, status, sort_order, cost_override_enabled, uses_parent_cost_structure, variant_unit_cost_usd")
      .eq("core_product_id", productId)
      .order("sort_order", { nullsFirst: false })
      .order("color", { nullsFirst: true })
      .order("size");
    if (error) { toast.error(error.message); return; }
    const list = ((data as any) ?? []) as Variant[];
    // Resolve cost per variant with source
    let rpcError: string | null = null;
    const enriched = await Promise.all(list.map(async v => {
      const { data: r, error: rErr } = await supabase.rpc("resolve_core_variant_unit_cost_with_source" as any, {
        p_product_id: productId, p_variant_id: v.id,
      });
      if (rErr) rpcError = rErr.message;
      const row = Array.isArray(r) ? r[0] : r;
      return { ...v, resolved_unit_cost: Number(row?.unit_cost ?? 0), cost_source: row?.cost_source ?? "zero_fallback" };
    }));
    if (rpcError) toast.error("No se pudo resolver el costo de las variantes: " + rpcError);

    setVariantsByProduct(prev => {
      const m = new Map(prev);
      m.set(productId, enriched);
      return m;
    });
  }

  async function loadCostRange(productId: string) {
    const { data } = await supabase.rpc("resolve_core_product_variant_cost_range" as any, { p_product_id: productId });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setCostRanges(prev => {
        const m = new Map(prev);
        m.set(productId, {
          variant_count: Number(row.variant_count) || 0,
          variants_with_override: Number(row.variants_with_override) || 0,
          has_overrides: !!row.has_overrides,
          min_unit_cost: Number(row.min_unit_cost) || 0,
          max_unit_cost: Number(row.max_unit_cost) || 0,
          base_unit_cost: Number(row.base_unit_cost) || 0,
        });
        return m;
      });
    }
  }

  async function toggleExpand(p: Product) {
    const n = new Set(expanded);
    if (n.has(p.id)) { n.delete(p.id); setExpanded(n); return; }
    n.add(p.id);
    setExpanded(n);
    if (!variantsByProduct.has(p.id)) await loadVariants(p.id);
    if (!costRanges.has(p.id)) await loadCostRange(p.id);
  }

  async function resetVariantToBase(v: Variant) {
    const { error } = await supabase.from("core_product_variants").update({
      uses_parent_cost_structure: true,
      cost_override_enabled: false,
      variant_unit_cost_usd: null,
      cost_updated_at: new Date().toISOString(),
    } as any).eq("id", v.id);
    if (error) return toast.error(error.message);
    // Archive variant structure if any
    if ((v as any).cost_structure_id) {
      await supabase.from("core_cost_structures").update({ status: "inactive" }).eq("id", (v as any).cost_structure_id);
    }
    await logCoreAudit({
      table: "core_product_variants", recordId: v.id, action: "variant_cost_reset",
      field: "cost_override_enabled", oldValue: true, newValue: false,
    });
    toast.success("Variante vuelve a heredar base");
    await loadVariants(v.core_product_id);
    await loadCostRange(v.core_product_id);
  }

  async function toggleVariantStatus(v: Variant) {
    const newStatus = v.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("core_product_variants").update({ status: newStatus }).eq("id", v.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_product_variants", recordId: v.id, action: "update", field: "status", oldValue: v.status, newValue: newStatus });
    toast.success(`Talla ${v.size}: ${newStatus === "active" ? "activada" : "desactivada"}`);
    loadVariants(v.core_product_id);
    loadCostRange(v.core_product_id);
  }


  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("core_products")
      .select("id, core_sku, name, product_type, color, commercial_status, is_restockable, product_priority, replenishment_mode, unit_cost, currency, estimated_sale_price, woo_product_id, woo_product_name, sku_source, sync_status, updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error("Error cargando productos: " + error.message);
    const products = ((data as any) ?? []) as Product[];
    setItems(products);
    const { count } = await supabase.from("core_woo_product_candidates").select("id", { count: "exact", head: true }).in("status", ["pendiente", "conflicto", "requiere_sku"]);
    setPendingCount(count ?? 0);
    setLoading(false);
    loadNextSku();
    // Lazy-load cost ranges only for products that actually have variant overrides,
    // detected via a single grouped query to avoid N RPC calls on catalog paint.
    const productIds = products.map(p => p.id);
    if (productIds.length > 0) {
      const { data: overrideRows } = await supabase
        .from("core_product_variants")
        .select("core_product_id")
        .in("core_product_id", productIds)
        .eq("cost_override_enabled", true);
      const withOverrides = Array.from(new Set(((overrideRows as any) ?? []).map((r: any) => r.core_product_id)));
      // Resolve ranges only for those (small subset)
      await Promise.all(withOverrides.map(pid => loadCostRange(pid as string)));
    }
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

  const [importOpen, setImportOpen] = useState(false);
  async function handleExport() {
    try {
      await exportCatalog({ search, status: fStatus, type: fType, restock: fRestock });
      toast.success("Catálogo exportado");
    } catch (e: any) { toast.error(e?.message ?? "Error exportando"); }
  }

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
          <h1 className="text-3xl font-black tracking-tight">Catálogo de Fabricación</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todos los productos fabricables conectados a costos, WooCommerce y restock. La prioridad estratégica (Core / Esencial, Regular, etc.) se define dentro de cada producto.
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
          <Button variant="outline" size="sm" onClick={() => navigate("/core/productos/importaciones")} title="Historial de importaciones"><History className="h-4 w-4 mr-1" />Historial</Button>
          <Button variant="outline" size="sm" onClick={downloadTemplate}><FileSpreadsheet className="h-4 w-4 mr-1" />Formato base</Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" />Importar</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Exportar</Button>
          <Button size="sm" onClick={() => navigate("/core/productos/nuevo")}><Plus className="h-4 w-4 mr-1" />Nuevo producto de fabricación</Button>
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
                          {p.sync_status === "draft_from_woo" && !(p.commercial_status === "active" && p.woo_product_id && Number(p.unit_cost) > 0) && <Badge variant="secondary" className="text-[10px] py-0 px-1">borrador Woo</Badge>}
                          {p.woo_product_id && p.sync_status !== "draft_from_woo" && p.sync_status !== "conflict" && <Badge variant="outline" className="text-[10px] py-0 px-1 border-green-600 text-green-700">Woo conectado</Badge>}
                          {p.sync_status === "conflict" && <Badge variant="destructive" className="text-[10px] py-0 px-1">conflicto</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {(() => {
                            const pr = PRIORITY_LABELS[p.product_priority ?? "regular"] ?? PRIORITY_LABELS.regular;
                            return <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5", pr.cls)}>{pr.label}</Badge>;
                          })()}
                          {p.color && <span className="text-xs text-muted-foreground">{p.color}</span>}
                        </div>
                        {isOpen && vars.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">{activeCount} de {vars.length} tallas activas</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.product_type || "—"}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Switch checked={p.is_restockable} onCheckedChange={() => toggleRestock(p)} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(() => {
                          const range = costRanges.get(p.id);
                          if (range && range.has_overrides && range.min_unit_cost !== range.max_unit_cost) {
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <span title="Rango de costo entre variantes (min–max)">
                                  {range.min_unit_cost.toFixed(2)}–{range.max_unit_cost.toFixed(2)} {p.currency}
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1 border-red-600 text-red-700" title="Algunas variantes tienen costos personalizados. Las demás heredan la estructura base.">
                                  Costos por variante · {range.variants_with_override}
                                </Badge>
                              </div>
                            );
                          }
                          if (range && range.has_overrides) {
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <span>{range.max_unit_cost.toFixed(2)} {p.currency}</span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1 border-red-600 text-red-700" title="Algunas variantes tienen costos personalizados. Las demás heredan la estructura base.">
                                  Costos por variante · {range.variants_with_override}
                                </Badge>
                              </div>
                            );
                          }
                          return <>{Number(p.unit_cost).toFixed(2)} {p.currency}</>;
                        })()}
                      </TableCell>

                      <TableCell className="text-xs">
                        {p.woo_product_id ? (
                          <span className="text-muted-foreground">#{p.woo_product_id}{p.woo_product_name ? ` · ${p.woo_product_name}` : ""}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDMY(p.updated_at)}</TableCell>
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
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tallas / variaciones</div>
                              <div className="rounded-md border bg-background overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Talla</TableHead>
                                      <TableHead>Color</TableHead>
                                      <TableHead>SKU</TableHead>
                                      <TableHead>Woo ID</TableHead>
                                      <TableHead>Modo costo</TableHead>
                                      <TableHead className="text-right">Costo resuelto</TableHead>
                                      <TableHead>Fuente</TableHead>
                                      <TableHead className="text-center">Activa</TableHead>
                                      <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {vars.map(v => {
                                      const src = v.cost_source ?? "product_unit_cost";
                                      const srcLabel: Record<string, { label: string; cls: string }> = {
                                        variant_override: { label: "Estructura propia", cls: "border-red-600 text-red-700" },
                                        variant_manual: { label: "Costo manual variante", cls: "border-red-600 text-red-700" },
                                        product_base: { label: "Estructura base", cls: "border-muted-foreground text-muted-foreground" },
                                        product_manual: { label: "Costo manual producto", cls: "border-muted-foreground text-muted-foreground" },
                                        product_unit_cost: { label: "Costo base producto", cls: "border-muted-foreground text-muted-foreground" },
                                        zero_fallback: { label: "Sin costo", cls: "border-amber-600 text-amber-700" },
                                      };

                                      const sInfo = srcLabel[src] ?? srcLabel.product_unit_cost;
                                      return (
                                        <TableRow key={v.id} className={cn(v.status !== "active" && "opacity-60")}>
                                          <TableCell className="font-medium">{v.size || "—"}</TableCell>
                                          <TableCell>{v.color || "—"}</TableCell>
                                          <TableCell className="font-mono text-xs">{v.variant_sku || v.woo_sku || "—"}</TableCell>
                                          <TableCell className="font-mono text-xs">{v.woo_variation_id ?? "—"}</TableCell>
                                          <TableCell>
                                            {v.cost_override_enabled
                                              ? <Badge variant="outline" className="border-red-600 text-red-700">Costo propio</Badge>
                                              : <Badge variant="secondary">Hereda base</Badge>}
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums">
                                            {v.resolved_unit_cost != null ? Number(v.resolved_unit_cost).toFixed(2) : "—"} {p.currency}
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className={cn("text-[10px]", sInfo.cls)}>{sInfo.label}</Badge>
                                          </TableCell>
                                          <TableCell className="text-center">
                                            <Switch checked={v.status === "active"} onCheckedChange={() => toggleVariantStatus(v)} />
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <div className="inline-flex gap-1">
                                              <Button size="sm" variant="outline" onClick={() => navigate(`/core/estructuras-costos/nueva?variant=${v.id}`)} title="Editar costo variante">
                                                <Pencil className="h-3 w-3 mr-1" />Editar costo
                                              </Button>
                                              {v.cost_override_enabled && (
                                                <Button size="sm" variant="ghost" onClick={() => setToResetVariant(v)} title="Volver a heredar base">
                                                  ↺
                                                </Button>
                                              )}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
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

      <AlertDialog open={!!toResetVariant} onOpenChange={(o) => !o && setToResetVariant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Volver a heredar base?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta variante <strong>{toResetVariant?.size}{toResetVariant?.color ? ` · ${toResetVariant.color}` : ""}</strong> dejará de usar costo propio y volverá a heredar la estructura base del producto. No se borrará el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (toResetVariant) await resetVariantToBase(toResetVariant);
              setToResetVariant(null);
            }}>Volver a heredar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      <ProductImportDialog open={importOpen} onOpenChange={setImportOpen} onApplied={load} />
    </div>
  );
}
