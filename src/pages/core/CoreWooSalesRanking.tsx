import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, ChevronDown, ChevronRight, Plus, ExternalLink, Ban, EyeOff, RefreshCw, Link2 } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";
import { cn } from "@/lib/utils";

const VALID_STATUSES = [
  "processing",
  "completed",
  "tu-pedido-ha-sido",
  "tu-pago-fue-confi",
  "pedido-recibido-p",
  "pedido-listo-para",
  "pick-up-listo-par",
  "pedido-pick-up-re",
  "el-pedido-esta-si",
  "recordartorio-de-",
];

type RangeKey = "7" | "30" | "60" | "90" | "this_month" | "last_month" | "custom";
const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "60", label: "Últimos 60 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes anterior" },
  { value: "custom", label: "Personalizado" },
];

function rangeBounds(r: RangeKey, customFrom?: string, customTo?: string): { from: string; to: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const today = fmt(now);
  if (r === "custom") return { from: customFrom || today, to: customTo || today };
  if (r === "this_month") return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (r === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmt(start), to: fmt(end) };
  }
  const days = parseInt(r);
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { from: fmt(start), to: today };
}

type VariantAgg = {
  sku: string | null;
  size: string | null;
  color: string | null;
  units: number;
  orders: Set<number>;
  revenue: number;
  lastAt: string | null;
  matchedVariantId?: string | null;
  matchedProductId?: string | null;
};

type ProductAgg = {
  key: string; // parent_sku or sku
  parentSku: string | null;
  name: string;
  units: number;
  orders: Set<number>;
  revenue: number;
  lastAt: string | null;
  variants: Map<string, VariantAgg>;
  // match
  coreStatus: "ya_en_core" | "no_en_core" | "conflicto" | "ignorado" | "no_fabricable";
  coreProduct?: { id: string; core_sku: string; name: string; commercial_status: string; is_restockable: boolean } | null;
  matchedCount?: number;
};

const STATUS_COLORS: Record<ProductAgg["coreStatus"], string> = {
  ya_en_core: "bg-green-50 dark:bg-green-950/30 hover:bg-green-100/70 dark:hover:bg-green-950/50",
  no_en_core: "bg-red-50 dark:bg-red-950/30 hover:bg-red-100/70 dark:hover:bg-red-950/50",
  conflicto: "bg-yellow-50 dark:bg-yellow-950/30 hover:bg-yellow-100/70 dark:hover:bg-yellow-950/50",
  ignorado: "bg-muted/40 hover:bg-muted/60",
  no_fabricable: "bg-muted/40 hover:bg-muted/60",
};

const STATUS_BADGE: Record<ProductAgg["coreStatus"], { label: string; cls: string }> = {
  ya_en_core: { label: "Ya está en Core", cls: "bg-green-600 text-white" },
  no_en_core: { label: "No está en Core", cls: "bg-red-600 text-white" },
  conflicto: { label: "Conflicto SKU", cls: "bg-yellow-500 text-black" },
  ignorado: { label: "Ignorado", cls: "bg-muted text-muted-foreground" },
  no_fabricable: { label: "No fabricable", cls: "bg-muted text-muted-foreground" },
};

export default function CoreWooSalesRanking() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("60");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [coreFilter, setCoreFilter] = useState<"all" | "ya_en_core" | "no_en_core" | "conflicto">("all");
  const [items, setItems] = useState<ProductAgg[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ignoredMap, setIgnoredMap] = useState<Map<string, string>>(new Map()); // sku -> status

  const bounds = useMemo(() => rangeBounds(range, customFrom, customTo), [range, customFrom, customTo]);

  async function load() {
    setLoading(true);
    try {
      // fetch order_items joined with orders (inner) by date + status
      const all: any[] = [];
      const PAGE = 1000;
      let from = 0;
      // First get order_ids in window
      const { data: ordRows, error: ordErr } = await supabase
        .from("orders")
        .select("order_id, order_datetime, order_date, order_status")
        .gte("order_date", bounds.from)
        .lte("order_date", bounds.to)
        .in("order_status", VALID_STATUSES);
      if (ordErr) throw ordErr;
      const orderMap = new Map<number, { dt: string | null }>();
      (ordRows ?? []).forEach((o: any) => orderMap.set(Number(o.order_id), { dt: o.order_datetime ?? o.order_date }));
      const orderIds = Array.from(orderMap.keys());
      if (orderIds.length === 0) { setItems([]); setLoading(false); return; }

      // fetch items in chunks (in() with too many ids may be slow; chunk by 500)
      for (let i = 0; i < orderIds.length; i += 500) {
        const slice = orderIds.slice(i, i + 500);
        let p = 0;
        while (true) {
          const { data, error } = await supabase
            .from("order_items")
            .select("order_id, sku, parent_sku, product_name, quantity, line_total, size, color")
            .in("order_id", slice)
            .range(p * PAGE, p * PAGE + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < PAGE) break;
          p++;
        }
      }

      // Aggregate
      const groups = new Map<string, ProductAgg>();
      for (const it of all) {
        const sku = (it.sku || "").trim();
        const psku = (it.parent_sku || "").trim();
        const key = psku || sku || `__unknown_${it.order_id}_${it.product_name}`;
        const ord = orderMap.get(Number(it.order_id));
        const lastAt = ord?.dt ?? null;
        if (!groups.has(key)) {
          groups.set(key, {
            key, parentSku: psku || null, name: it.product_name || sku || "(sin nombre)",
            units: 0, orders: new Set(), revenue: 0, lastAt: null, variants: new Map(),
            coreStatus: "no_en_core",
          });
        }
        const g = groups.get(key)!;
        const qty = Number(it.quantity) || 0;
        g.units += qty;
        g.orders.add(Number(it.order_id));
        g.revenue += Number(it.line_total) || 0;
        if (lastAt && (!g.lastAt || lastAt > g.lastAt)) g.lastAt = lastAt;

        const vkey = sku || `${it.size || ""}|${it.color || ""}`;
        if (!g.variants.has(vkey)) {
          g.variants.set(vkey, { sku: sku || null, size: it.size || null, color: it.color || null, units: 0, orders: new Set(), revenue: 0, lastAt: null });
        }
        const v = g.variants.get(vkey)!;
        v.units += qty;
        v.orders.add(Number(it.order_id));
        v.revenue += Number(it.line_total) || 0;
        if (lastAt && (!v.lastAt || lastAt > v.lastAt)) v.lastAt = lastAt;
      }

      // Match against core_products / variants
      const allSkus = new Set<string>();
      groups.forEach(g => {
        if (g.parentSku) allSkus.add(g.parentSku);
        g.variants.forEach(v => { if (v.sku) allSkus.add(v.sku); });
      });
      const skuArr = Array.from(allSkus);
      const products: any[] = [];
      const variants: any[] = [];
      for (let i = 0; i < skuArr.length; i += 300) {
        const slice = skuArr.slice(i, i + 300);
        const [{ data: p }, { data: v }] = await Promise.all([
          supabase.from("core_products").select("id, core_sku, name, commercial_status, is_restockable, woo_sku, woo_product_id").or(`core_sku.in.(${slice.map(s => `"${s}"`).join(",")}),woo_sku.in.(${slice.map(s => `"${s}"`).join(",")})`),
          supabase.from("core_product_variants").select("id, core_product_id, variant_sku, woo_sku").or(`variant_sku.in.(${slice.map(s => `"${s}"`).join(",")}),woo_sku.in.(${slice.map(s => `"${s}"`).join(",")})`),
        ]);
        if (p) products.push(...p);
        if (v) variants.push(...v);
      }
      const prodById = new Map<string, any>();
      const prodBySku = new Map<string, any[]>();
      products.forEach(p => {
        prodById.set(p.id, p);
        [p.core_sku, p.woo_sku].filter(Boolean).forEach((s: string) => {
          const arr = prodBySku.get(s) ?? [];
          arr.push(p);
          prodBySku.set(s, arr);
        });
      });
      const variantBySku = new Map<string, any[]>();
      variants.forEach(v => {
        [v.variant_sku, v.woo_sku].filter(Boolean).forEach((s: string) => {
          const arr = variantBySku.get(s) ?? [];
          arr.push(v);
          variantBySku.set(s, arr);
        });
      });

      groups.forEach(g => {
        // match parent
        let matched: any[] = [];
        if (g.parentSku) {
          matched = prodBySku.get(g.parentSku) ?? [];
        }
        // try via variants
        if (matched.length === 0) {
          const ids = new Set<string>();
          g.variants.forEach(v => {
            if (v.sku) {
              (prodBySku.get(v.sku) ?? []).forEach(p => ids.add(p.id));
              (variantBySku.get(v.sku) ?? []).forEach(vr => ids.add(vr.core_product_id));
            }
          });
          matched = Array.from(ids).map(id => prodById.get(id)).filter(Boolean);
        }
        const unique = Array.from(new Map(matched.map(m => [m.id, m])).values());
        if (unique.length === 1) {
          g.coreStatus = "ya_en_core";
          g.coreProduct = unique[0];
        } else if (unique.length > 1) {
          g.coreStatus = "conflicto";
          g.matchedCount = unique.length;
          g.coreProduct = unique[0];
        }
        // attach variant matches
        g.variants.forEach(v => {
          if (!v.sku) return;
          const vrs = variantBySku.get(v.sku) ?? [];
          if (vrs.length > 0) {
            v.matchedVariantId = vrs[0].id;
            v.matchedProductId = vrs[0].core_product_id;
          }
        });
      });

      // overlay ignored/no_fabricable from candidates
      const { data: cand } = await supabase
        .from("core_woo_product_candidates")
        .select("woo_sku, status")
        .in("status", ["ignorado", "no_fabricable"]);
      const ignored = new Map<string, string>();
      (cand ?? []).forEach((c: any) => { if (c.woo_sku) ignored.set(c.woo_sku, c.status); });
      setIgnoredMap(ignored);
      groups.forEach(g => {
        const key = g.parentSku || "";
        if (key && ignored.has(key)) g.coreStatus = ignored.get(key) as any;
      });

      const arr = Array.from(groups.values()).sort((a, b) => b.units - a.units);
      setItems(arr);
    } catch (err: any) {
      toast.error(err?.message ?? "Error cargando ranking");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [range, customFrom, customTo]);

  const filtered = useMemo(() => items.filter(g => {
    if (search) {
      const s = search.toLowerCase();
      if (!g.name.toLowerCase().includes(s) && !(g.parentSku || "").toLowerCase().includes(s)) return false;
    }
    if (coreFilter !== "all" && g.coreStatus !== coreFilter) return false;
    return true;
  }), [items, search, coreFilter]);

  function toggleExpand(k: string) {
    const n = new Set(expanded);
    n.has(k) ? n.delete(k) : n.add(k);
    setExpanded(n);
  }

  async function createDraftFromGroup(g: ProductAgg) {
    if (!g.parentSku) return toast.error("Este producto no tiene SKU padre en WooCommerce. Asigna un SKU antes de crear el Core.");
    const { data: dup } = await supabase.from("core_products").select("id, core_sku").eq("core_sku", g.parentSku).maybeSingle();
    if (dup) return toast.error(`Ya existe un Producto Core con SKU ${g.parentSku}`);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: newProd, error } = await supabase.from("core_products").insert({
      core_sku: g.parentSku,
      name: g.name,
      commercial_status: "draft",
      is_restockable: true,
      sku_source: "woocommerce",
      sync_status: "draft_from_woo",
      woo_sku: g.parentSku,
      woo_product_name: g.name,
      notes: `Creado desde ranking de ventas. Vendido ${g.units} u. en período ${bounds.from} → ${bounds.to}.`,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    }).select().single();
    if (error || !newProd) return toast.error(error?.message ?? "No se pudo crear");

    // Insert variants from observed sizes
    const variants = Array.from(g.variants.values()).filter(v => v.sku || v.size).map((v, i) => ({
      core_product_id: newProd.id,
      size: v.size || `Var ${i + 1}`,
      variant_sku: v.sku,
      woo_sku: v.sku,
      status: "active",
      sort_order: i,
    }));
    if (variants.length > 0) await supabase.from("core_product_variants").insert(variants);

    await logCoreAudit({ table: "core_products", recordId: newProd.id, action: "create_from_sales_ranking", newValue: g.parentSku });
    toast.success(`Producto Core creado: ${g.parentSku}`);
    load();
  }

  async function markCandidate(g: ProductAgg, status: "ignorado" | "no_fabricable") {
    if (!g.parentSku) return toast.error("Sin SKU para registrar");
    const { data: existing } = await supabase
      .from("core_woo_product_candidates")
      .select("id").eq("woo_sku", g.parentSku).maybeSingle();
    if (existing) {
      await supabase.from("core_woo_product_candidates").update({ status, detected_from: "sales_ranking" }).eq("id", existing.id);
    } else {
      await supabase.from("core_woo_product_candidates").insert({
        woo_product_id: 0, woo_sku: g.parentSku, woo_product_name: g.name,
        detected_from: "sales_ranking", status,
      } as any);
    }
    toast.success(status === "ignorado" ? "Ignorado" : "Marcado no fabricable");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o SKU" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>{RANGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        {range === "custom" && (
          <>
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-[150px]" />
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-[150px]" />
          </>
        )}
        <Select value={coreFilter} onValueChange={(v) => setCoreFilter(v as any)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ya_en_core">Ya en Core</SelectItem>
            <SelectItem value="no_en_core">No en Core</SelectItem>
            <SelectItem value="conflicto">Conflictos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />Recalcular
        </Button>
        <div className="text-xs text-muted-foreground ml-auto">
          Período: <strong>{bounds.from}</strong> → <strong>{bounds.to}</strong> · {filtered.length} productos · {filtered.reduce((s, g) => s + g.units, 0)} u. totales
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Estado Core</TableHead>
              <TableHead>SKU Woo</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Última venta</TableHead>
              <TableHead className="text-right w-[280px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Calculando ranking…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin ventas en el período seleccionado.</TableCell></TableRow>
            ) : filtered.map(g => {
              const isOpen = expanded.has(g.key);
              const badge = STATUS_BADGE[g.coreStatus];
              return (
                <FragmentRow key={g.key}>
                  <TableRow className={STATUS_COLORS[g.coreStatus]}>
                    <TableCell>
                      {g.variants.size > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(g.key)}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("font-semibold", badge.cls)}>{badge.label}</Badge>
                      {g.coreStatus === "conflicto" && <div className="text-xs text-muted-foreground mt-1">{g.matchedCount} coincidencias</div>}
                      {g.coreProduct && (
                        <div className="text-xs text-muted-foreground mt-1 font-mono">{g.coreProduct.core_sku}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{g.parentSku || <span className="text-destructive">— sin SKU —</span>}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{g.name}</div>
                      <div className="text-xs text-muted-foreground">{g.variants.size} variación(es)</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-bold">{g.units}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.orders.size}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{g.lastAt ? new Date(g.lastAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {g.coreStatus === "ya_en_core" && g.coreProduct && (
                          <Button size="sm" variant="outline" onClick={() => navigate(`/core/productos/${g.coreProduct!.id}`)}>
                            <ExternalLink className="h-3 w-3 mr-1" />Ver Core
                          </Button>
                        )}
                        {(g.coreStatus === "no_en_core") && (
                          <>
                            <Button size="sm" variant="default" onClick={() => createDraftFromGroup(g)} disabled={!g.parentSku}>
                              <Plus className="h-3 w-3 mr-1" />Crear borrador Core
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => markCandidate(g, "ignorado")} title="Ignorar"><EyeOff className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => markCandidate(g, "no_fabricable")} title="No fabricable"><Ban className="h-3 w-3" /></Button>
                          </>
                        )}
                        {g.coreStatus === "conflicto" && (
                          <Button size="sm" variant="outline" onClick={() => g.coreProduct && navigate(`/core/productos/${g.coreProduct.id}`)}>
                            <Link2 className="h-3 w-3 mr-1" />Resolver
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isOpen && Array.from(g.variants.values()).sort((a, b) => b.units - a.units).map((v, i) => (
                    <TableRow key={g.key + "_v_" + i} className="bg-muted/20">
                      <TableCell></TableCell>
                      <TableCell colSpan={2} className="pl-8 text-xs">
                        <span className="font-mono">{v.sku || "—"}</span>
                        {v.matchedVariantId && <Badge variant="outline" className="ml-2 text-[10px]">mapeada</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {v.size && <span>Talla <strong>{v.size}</strong></span>}
                        {v.color && <span className="ml-2 text-muted-foreground">{v.color}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{v.units}</TableCell>
                      <TableCell className="text-right tabular-nums">{v.orders.size}</TableCell>
                      <TableCell className="text-right tabular-nums">{v.revenue.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.lastAt ? new Date(v.lastAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
