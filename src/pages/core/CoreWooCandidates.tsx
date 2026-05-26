import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Search, RefreshCw, Plus, EyeOff, Ban, Download } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";
import CoreWooSalesRanking from "./CoreWooSalesRanking";

type Candidate = {
  id: string;
  woo_product_id: number;
  woo_variation_id: number | null;
  woo_product_name: string | null;
  woo_sku: string | null;
  woo_status: string | null;
  woo_stock_quantity: number | null;
  woo_regular_price: number | null;
  woo_sale_price: number | null;
  woo_variations: any[] | null;
  source_order_id: number | null;
  detected_from: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pendiente: { label: "Pendiente", variant: "outline" },
  mapeado: { label: "Mapeado", variant: "default" },
  creado_como_borrador: { label: "Creado borrador", variant: "secondary" },
  ignorado: { label: "Ignorado", variant: "secondary" },
  conflicto: { label: "Conflicto", variant: "destructive" },
  requiere_sku: { label: "Requiere SKU", variant: "destructive" },
  no_fabricable: { label: "No fabricable", variant: "secondary" },
};

export default function CoreWooCandidates() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "ranking";
  const [items, setItems] = useState<Candidate[]>([]);
  const [products, setProducts] = useState<{ id: string; core_sku: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("core_woo_product_candidates").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("core_products").select("id, core_sku, name").order("core_sku"),
    ]);
    setItems((c as any) ?? []);
    setProducts((p as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function runSync(mode: "catalog" | "sales") {
    setSyncing(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/core-woo-sync?mode=${mode}`;
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${sess.session?.access_token}`, "Content-Type": "application/json" } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error de sincronización");
      const s = json.summary;
      toast.success(`Sincronización ${mode}: ${s.scanned} escaneados, ${s.auto_linked} auto-enlazados, ${s.candidates_added} pendientes${s.conflicts ? `, ${s.conflicts} conflictos` : ""}`);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Error sincronizando");
    } finally {
      setSyncing(false);
    }
  }

  async function createDraftFromCandidate(c: Candidate) {
    if (!c.woo_sku) return toast.error("Sin SKU. Asigna uno en WooCommerce primero.");
    const { data: dup } = await supabase.from("core_products").select("id, core_sku").eq("core_sku", c.woo_sku).maybeSingle();
    if (dup) return toast.error(`Ya existe Core SKU ${c.woo_sku}. Usa Asociar.`);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: newProd, error } = await supabase.from("core_products").insert({
      core_sku: c.woo_sku, name: c.woo_product_name || c.woo_sku,
      commercial_status: "draft", is_restockable: true,
      sku_source: "woocommerce", sync_status: "draft_from_woo",
      woo_product_id: c.woo_product_id || null, woo_product_name: c.woo_product_name, woo_sku: c.woo_sku,
      woo_status: c.woo_status, woo_stock_quantity: c.woo_stock_quantity,
      woo_regular_price: c.woo_regular_price, woo_sale_price: c.woo_sale_price,
      woo_last_sync_at: new Date().toISOString(),
      created_by: user?.id ?? null, updated_by: user?.id ?? null,
    }).select().single();
    if (error || !newProd) return toast.error(error?.message ?? "No se pudo crear");
    if (c.woo_variations && Array.isArray(c.woo_variations) && c.woo_variations.length > 0) {
      const variants = c.woo_variations.map((v: any, i: number) => {
        const sizeAttr = (v.attributes ?? []).find((a: any) => /talla|size/i.test(a.name || ""))?.option
          || (v.attributes ?? [])[0]?.option || `Var ${i + 1}`;
        return {
          core_product_id: newProd.id, size: String(sizeAttr),
          variant_sku: v.sku || null, woo_variation_id: v.id || null, woo_sku: v.sku || null,
          woo_stock_quantity: v.stock_quantity ?? null, woo_regular_price: v.regular_price ?? null,
          woo_sale_price: v.sale_price ?? null, status: "active", sort_order: i,
        };
      });
      await supabase.from("core_product_variants").insert(variants);
    }
    await supabase.from("core_woo_product_candidates").update({ status: "creado_como_borrador", matched_core_product_id: newProd.id }).eq("id", c.id);
    await logCoreAudit({ table: "core_products", recordId: newProd.id, action: "create_from_woo", newValue: c.woo_sku });
    toast.success(`Producto Core creado: ${c.woo_sku}`);
    load();
  }

  async function linkToExisting(c: Candidate, productId: string) {
    const target = products.find(p => p.id === productId);
    if (!target) return;
    await supabase.from("core_products").update({
      woo_product_id: c.woo_product_id || null, woo_product_name: c.woo_product_name, woo_sku: c.woo_sku,
      woo_status: c.woo_status, woo_stock_quantity: c.woo_stock_quantity,
      woo_regular_price: c.woo_regular_price, woo_sale_price: c.woo_sale_price,
      woo_last_sync_at: new Date().toISOString(),
      sync_status: target.core_sku === c.woo_sku ? "synced" : "conflict",
    }).eq("id", productId);
    await supabase.from("core_woo_product_candidates").update({ status: "mapeado", matched_core_product_id: productId }).eq("id", c.id);
    await logCoreAudit({ table: "core_products", recordId: productId, action: "link_woo", newValue: c.woo_sku });
    toast.success(`Asociado a ${target.core_sku}`);
    load();
  }

  async function setCandidateStatus(c: Candidate, status: string, msg: string) {
    await supabase.from("core_woo_product_candidates").update({ status }).eq("id", c.id);
    await logCoreAudit({
      table: "core_woo_product_candidates",
      recordId: c.id,
      action: `candidate_${status}`,
      field: "status",
      oldValue: c.status,
      newValue: status,
    });
    toast.success(msg);
    load();
  }

  function CandidatesTable({ filter }: { filter: (c: Candidate) => boolean }) {
    const filtered = useMemo(() => items.filter(c => {
      if (!filter(c)) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(c.woo_product_name || "").toLowerCase().includes(s) && !(c.woo_sku || "").toLowerCase().includes(s)) return false;
      }
      return true;
    }), [items, search, filter]);
    return (
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Woo SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Fuente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Detectado</TableHead>
              <TableHead className="text-right w-[420px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin elementos.</TableCell></TableRow>
            ) : filtered.map(c => {
              const st = STATUS_BADGES[c.status] ?? { label: c.status, variant: "outline" as const };
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.woo_sku || <span className="text-destructive">— sin SKU —</span>}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{c.woo_product_name || `Woo #${c.woo_product_id}`}</div>
                    {c.woo_variations && c.woo_variations.length > 0 && (
                      <div className="text-xs text-muted-foreground">{c.woo_variations.length} variaciones</div>
                    )}
                    {c.notes && <div className="text-xs text-muted-foreground italic">{c.notes}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{c.detected_from}</Badge></TableCell>
                  <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{c.woo_sale_price ?? c.woo_regular_price ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{c.woo_stock_quantity ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    {["pendiente", "conflicto", "requiere_sku"].includes(c.status) ? (
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button size="sm" variant="default" onClick={() => createDraftFromCandidate(c)} disabled={!c.woo_sku}>
                          <Plus className="h-3 w-3 mr-1" />Crear borrador
                        </Button>
                        <Select onValueChange={(v) => linkToExisting(c, v)}>
                          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Asociar a…" /></SelectTrigger>
                          <SelectContent>
                            {products.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.core_sku} — {p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => setCandidateStatus(c, "ignorado", "Ignorado")} title="Ignorar"><EyeOff className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setCandidateStatus(c, "no_fabricable", "No fabricable")} title="No fabricable"><Ban className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setCandidateStatus(c, "pendiente", "Reabierto")}>Reabrir</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  const countCatalog = items.filter(c => c.detected_from === "catalog" && !["ignorado", "no_fabricable"].includes(c.status)).length;
  const countConflicts = items.filter(c => c.status === "conflicto").length;
  const countRequiresSku = items.filter(c => c.status === "requiere_sku").length;
  const countIgnored = items.filter(c => ["ignorado", "no_fabricable"].includes(c.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/core/productos")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Productos Woo → Core</h1>
            <p className="text-sm text-muted-foreground">Prioriza productos por ventas reales antes de crearlos en Core.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => runSync("catalog")} disabled={syncing}>
            <Download className="h-4 w-4 mr-1" />{syncing ? "Sincronizando…" : "Sincronizar catálogo"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => runSync("sales")} disabled={syncing}>
            <RefreshCw className="h-4 w-4 mr-1" />{syncing ? "Sincronizando…" : "Sincronizar ventas"}
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
          <TabsList>
            <TabsTrigger value="ranking">Vendidos últimos 60 días</TabsTrigger>
            <TabsTrigger value="catalog">Catálogo Woo {countCatalog > 0 && <Badge variant="secondary" className="ml-2">{countCatalog}</Badge>}</TabsTrigger>
            <TabsTrigger value="conflicts">Conflictos {countConflicts > 0 && <Badge variant="destructive" className="ml-2">{countConflicts}</Badge>}</TabsTrigger>
            <TabsTrigger value="requires_sku">Requiere SKU {countRequiresSku > 0 && <Badge variant="destructive" className="ml-2">{countRequiresSku}</Badge>}</TabsTrigger>
            <TabsTrigger value="ignored">No fabricables / Ignorados {countIgnored > 0 && <Badge variant="outline" className="ml-2">{countIgnored}</Badge>}</TabsTrigger>
          </TabsList>

          <TabsContent value="ranking" className="mt-4">
            <CoreWooSalesRanking />
          </TabsContent>

          <TabsContent value="catalog" className="mt-4 space-y-3">
            <div className="relative max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o SKU" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <CandidatesTable filter={(c) => c.detected_from === "catalog" && !["ignorado", "no_fabricable"].includes(c.status)} />
          </TabsContent>

          <TabsContent value="conflicts" className="mt-4 space-y-3">
            <div className="relative max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <CandidatesTable filter={(c) => c.status === "conflicto"} />
          </TabsContent>

          <TabsContent value="requires_sku" className="mt-4 space-y-3">
            <div className="text-xs text-muted-foreground">Productos WooCommerce sin SKU — asigna uno en Woo antes de crear el borrador Core.</div>
            <CandidatesTable filter={(c) => c.status === "requiere_sku"} />
          </TabsContent>

          <TabsContent value="ignored" className="mt-4 space-y-3">
            <div className="relative max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <CandidatesTable filter={(c) => ["ignorado", "no_fabricable"].includes(c.status)} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
