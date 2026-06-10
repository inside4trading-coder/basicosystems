import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shirt, Plus, Edit, Archive, Loader2, ArrowDownToLine, ArrowUpFromLine, Settings2, FlaskConical, Layers, Package, AlertTriangle, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { formatDMY } from "@/lib/dateUtils";
import { normalizeSize, MATERIAL_TYPE_LABEL, MATERIAL_UNIT_LABEL, MOVEMENT_TYPE_LABEL } from "@/lib/espMaterials";

interface MaterialItem {
  id: string;
  material_type: string;
  sku: string | null;
  name: string;
  color: string | null;
  size: string | null;
  normalized_size: string | null;
  unit: string;
  unit_cost_eur: number | null;
  status: string;
  low_stock_threshold: number;
  notes: string | null;
}
interface StockRow {
  material_id: string;
  location_id: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
}
interface MovementRow {
  id: string; material_id: string; location_id: string | null;
  movement_type: string; quantity: number; quantity_before: number | null;
  quantity_after: number | null; reason: string | null; notes: string | null;
  reference_type: string | null; created_at: string; created_by: string | null;
}
interface ProfileRow { id: string; full_name: string | null; email: string | null; }
interface LocationRow { id: string; name: string; }
interface RecipeRow { id: string; product_id: string; variant_id: string | null; name: string | null; status: string; }
interface RecipeItemRow { id: string; recipe_id: string; material_id: string; quantity_per_unit: number; size_strategy: string; required: boolean; }
interface ProductRow { id: string; name: string; fulfillment_mode?: string | null; }

const MOVEMENT_TYPES_UI = [
  { value: "manual_in", label: "Entrada", icon: ArrowDownToLine },
  { value: "manual_out", label: "Salida", icon: ArrowUpFromLine },
  { value: "adjustment", label: "Ajuste", icon: Settings2 },
];

export default function EspanaBlanksDTF() {
  const [tab, setTab] = useState("resumen");

  // data
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeItemRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [testRequests, setTestRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [matSearch, setMatSearch] = useState("");
  const [matTypeFilter, setMatTypeFilter] = useState<string>("all");
  const [matStatusFilter, setMatStatusFilter] = useState<string>("active");
  const [movMatFilter, setMovMatFilter] = useState<string>("all");
  const [movTypeFilter, setMovTypeFilter] = useState<string>("all");

  // dialogs
  const [matDlg, setMatDlg] = useState<{ open: boolean; item?: MaterialItem | null }>({ open: false });
  const [movDlg, setMovDlg] = useState<{ open: boolean; type?: string; materialId?: string; locationId?: string }>({ open: false });
  const [recipeDlg, setRecipeDlg] = useState<{ open: boolean; recipe?: RecipeRow | null }>({ open: false });
  const [testDlg, setTestDlg] = useState<{ open: boolean; recipeId?: string }>({ open: false });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (k: string) => setExpandedGroups(p => ({ ...p, [k]: !p[k] }));

  const load = async () => {
    setLoading(true);
    const [mats, stk, mvs, locs, recs, recItems, prods, testReqs] = await Promise.all([
      supabase.from("esp_material_items").select("*").order("material_type").order("name"),
      supabase.from("esp_material_stock").select("*"),
      supabase.from("esp_material_movements").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("esp_locations").select("id,name").eq("is_active", true).order("name"),
      supabase.from("esp_product_material_recipes").select("*").order("created_at", { ascending: false }),
      supabase.from("esp_product_material_recipe_items").select("*"),
      supabase.from("esp_products").select("id,name,fulfillment_mode").order("name"),
      supabase.from("esp_fabrication_requests").select("id,product_name,variant_label,quantity,woo_order_id,status")
        .eq("is_test", true).eq("is_legacy", false).in("status", ["pending", "in_progress"]),
    ]);
    setMaterials((mats.data || []) as any);
    setStock((stk.data || []) as any);
    setMovements((mvs.data || []) as any);
    setLocations((locs.data || []) as any);
    setRecipes((recs.data || []) as any);
    setRecipeItems((recItems.data || []) as any);
    setProducts((prods.data || []) as any);
    setTestRequests((testReqs.data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // helpers
  const stockByMat = useMemo(() => {
    const map = new Map<string, number>();
    stock.forEach(s => map.set(s.material_id, (map.get(s.material_id) || 0) + Number(s.quantity_on_hand || 0)));
    return map;
  }, [stock]);

  const stockByMatLoc = useMemo(() => {
    const map = new Map<string, number>();
    stock.forEach(s => map.set(`${s.material_id}::${s.location_id}`, Number(s.quantity_on_hand || 0)));
    return map;
  }, [stock]);

  const lowStockMaterials = useMemo(() =>
    materials.filter(m => m.status === "active" && (stockByMat.get(m.id) || 0) <= Number(m.low_stock_threshold || 0))
  , [materials, stockByMat]);

  const matsById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);
  const locById = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);
  const prodById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const filteredMaterials = useMemo(() => {
    const q = matSearch.trim().toLowerCase();
    return materials.filter(m =>
      (matTypeFilter === "all" || m.material_type === matTypeFilter) &&
      (matStatusFilter === "all" || m.status === matStatusFilter) &&
      (!q || (m.name + " " + (m.sku || "") + " " + (m.color || "")).toLowerCase().includes(q))
    );
  }, [materials, matSearch, matTypeFilter, matStatusFilter]);

  const filteredMovements = useMemo(() =>
    movements.filter(m =>
      (movMatFilter === "all" || m.material_id === movMatFilter) &&
      (movTypeFilter === "all" || m.movement_type === movTypeFilter)
    )
  , [movements, movMatFilter, movTypeFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const act = materials.filter(m => m.status === "active");
    return {
      blanks: act.filter(m => m.material_type === "blank").length,
      dtf: act.filter(m => m.material_type === "dtf").length,
      others: act.filter(m => !["blank", "dtf"].includes(m.material_type)).length,
      stockBlanks: act.filter(m => m.material_type === "blank").reduce((s, m) => s + (stockByMat.get(m.id) || 0), 0),
      stockDtf: act.filter(m => m.material_type === "dtf").reduce((s, m) => s + (stockByMat.get(m.id) || 0), 0),
      low: lowStockMaterials.length,
      mov7d: movements.filter(m => (Date.now() - new Date(m.created_at).getTime()) <= 7 * 86400000).length,
      testReady: testRequests.length,
    };
  }, [materials, stockByMat, lowStockMaterials, movements, testRequests]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Shirt className="h-6 w-6 text-primary" /> Blanks / DTF
          </h2>
          <p className="text-sm text-muted-foreground">
            Materiales e insumos para fabricación ligera ES. Las recetas se consumirán automáticamente en el BLOQUE 5B.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="materiales">Materiales ({materials.length})</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos ({movements.length})</TabsTrigger>
          <TabsTrigger value="recetas">Recetas ({recipes.length})</TabsTrigger>
        </TabsList>

        {/* ============== RESUMEN ============== */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Blanks activos</p><p className="text-3xl font-black">{kpis.blanks}</p><p className="text-[10px] text-muted-foreground">stock total: {kpis.stockBlanks}</p></Card>
            <Card className="p-4"><p className="text-[10px] uppercase text-muted-foreground">DTF activos</p><p className="text-3xl font-black">{kpis.dtf}</p><p className="text-[10px] text-muted-foreground">stock total: {kpis.stockDtf}</p></Card>
            <Card className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Otros insumos</p><p className="text-3xl font-black">{kpis.others}</p></Card>
            <Card className="p-4 border-l-4 border-l-amber-500"><p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Bajo stock</p><p className="text-3xl font-black">{kpis.low}</p></Card>
            <Card className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Movimientos 7 días</p><p className="text-3xl font-black">{kpis.mov7d}</p></Card>
            <Card className="p-4 border-l-4 border-l-blue-500"><p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><FlaskConical className="h-3 w-3" />Solicitudes test listas</p><p className="text-3xl font-black">{kpis.testReady}</p><p className="text-[10px] text-muted-foreground">para BLOQUE 5B</p></Card>
          </div>

          {kpis.low > 0 && (
            <Card className="p-4">
              <h3 className="font-bold mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Materiales bajo stock</h3>
              <ul className="text-sm space-y-1">
                {lowStockMaterials.map(m => (
                  <li key={m.id} className="flex justify-between"><span>{MATERIAL_TYPE_LABEL[m.material_type]} · {m.name}</span><span className="font-mono">{stockByMat.get(m.id) || 0} / umbral {m.low_stock_threshold}</span></li>
                ))}
              </ul>
            </Card>
          )}

          {testRequests.length > 0 && (
            <Card className="p-4">
              <h3 className="font-bold mb-2 flex items-center gap-2"><FlaskConical className="h-4 w-4 text-blue-500" /> Solicitudes de prueba disponibles ({testRequests.length})</h3>
              <p className="text-xs text-muted-foreground mb-2">Estas 5 solicitudes están listas para validar consumo de materiales en el BLOQUE 5B. No se consumen todavía.</p>
              <ul className="text-sm space-y-1">
                {testRequests.map((r: any) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{r.product_name} <span className="text-muted-foreground">· {r.variant_label} → {normalizeSize(r.variant_label)}</span></span>
                    <span className="font-mono text-xs">#{r.woo_order_id} · qty {r.quantity}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>

        {/* ============== MATERIALES ============== */}
        <TabsContent value="materiales" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder="Buscar por nombre, SKU, color..." value={matSearch} onChange={e => setMatSearch(e.target.value)} className="max-w-xs" />
            <Select value={matTypeFilter} onValueChange={setMatTypeFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {Object.entries(MATERIAL_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent></Select>
            <Select value={matStatusFilter} onValueChange={setMatStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
              <SelectItem value="archived">Archivados</SelectItem>
            </SelectContent></Select>
            <div className="flex-1" />
            <Button onClick={() => setMatDlg({ open: true, item: null })}><Plus className="h-4 w-4 mr-1" /> Nuevo material</Button>
          </div>

          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Tipo</TableHead><TableHead>SKU</TableHead><TableHead>Nombre</TableHead>
                <TableHead>Color</TableHead><TableHead>Talla</TableHead><TableHead>Unidad</TableHead>
                <TableHead className="text-right">Costo €</TableHead><TableHead className="text-right">Stock</TableHead>
                <TableHead>Estado</TableHead><TableHead>Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={11} className="text-center py-6 text-sm text-muted-foreground">Cargando…</TableCell></TableRow>}
                {!loading && filteredMaterials.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-6 text-sm text-muted-foreground">Sin materiales.</TableCell></TableRow>}
                {(() => {
                  // Group by material_type + name + color (a "main blank")
                  const groups = new Map<string, { key: string; items: MaterialItem[] }>();
                  filteredMaterials.forEach(m => {
                    const k = `${m.material_type}::${m.name}::${m.color || ""}`;
                    if (!groups.has(k)) groups.set(k, { key: k, items: [] });
                    groups.get(k)!.items.push(m);
                  });
                  const rendered: JSX.Element[] = [];
                  groups.forEach(({ key, items }) => {
                    // Sort sizes
                    const sizeOrder = ["XS","S","M","L","XL","XXL","XXXL"];
                    items.sort((a, b) => {
                      const ia = sizeOrder.indexOf((a.normalized_size || a.size || "").toUpperCase());
                      const ib = sizeOrder.indexOf((b.normalized_size || b.size || "").toUpperCase());
                      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                    });
                    const head = items[0];
                    const totalStock = items.reduce((s, m) => s + (stockByMat.get(m.id) || 0), 0);
                    const totalLow = items.filter(m => (stockByMat.get(m.id) || 0) <= Number(m.low_stock_threshold || 0)).length;
                    const isGroup = items.length > 1;
                    const expanded = !!expandedGroups[key];

                    if (!isGroup) {
                      const m = head;
                      const stk = stockByMat.get(m.id) || 0;
                      const low = stk <= Number(m.low_stock_threshold || 0);
                      rendered.push(
                        <TableRow key={m.id}>
                          <TableCell></TableCell>
                          <TableCell><Badge variant="outline">{MATERIAL_TYPE_LABEL[m.material_type]}</Badge></TableCell>
                          <TableCell className="text-xs font-mono">{m.sku || "—"}</TableCell>
                          <TableCell className="font-medium text-sm">{m.name}</TableCell>
                          <TableCell className="text-xs">{m.color || "—"}</TableCell>
                          <TableCell className="text-xs">{m.size || "—"}</TableCell>
                          <TableCell className="text-xs">{MATERIAL_UNIT_LABEL[m.unit]}</TableCell>
                          <TableCell className="text-right text-xs">{m.unit_cost_eur != null ? Number(m.unit_cost_eur).toFixed(2) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold"><span className={low ? "text-amber-600" : ""}>{stk}</span></TableCell>
                          <TableCell><Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setMatDlg({ open: true, item: m })}><Edit className="h-3 w-3" /></Button>
                              {m.status !== "archived" && <Button size="sm" variant="ghost" onClick={async () => { const { error } = await supabase.from("esp_material_items").update({ status: "archived" }).eq("id", m.id); if (error) toast.error(error.message); else { toast.success("Archivado"); load(); } }}><Archive className="h-3 w-3" /></Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                      return;
                    }

                    // Parent group row
                    rendered.push(
                      <TableRow key={key} className="bg-muted/40 cursor-pointer hover:bg-muted/60" onClick={() => toggleGroup(key)}>
                        <TableCell>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell><Badge variant="outline">{MATERIAL_TYPE_LABEL[head.material_type]}</Badge></TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{items.length} tallas</TableCell>
                        <TableCell className="font-bold text-sm">{head.name}</TableCell>
                        <TableCell className="text-xs">{head.color || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{items.map(i => i.size).filter(Boolean).join(" · ")}</TableCell>
                        <TableCell className="text-xs">{MATERIAL_UNIT_LABEL[head.unit]}</TableCell>
                        <TableCell className="text-right text-xs">—</TableCell>
                        <TableCell className="text-right font-bold"><span className={totalLow > 0 ? "text-amber-600" : ""}>{totalStock}</span></TableCell>
                        <TableCell><Badge variant={head.status === "active" ? "default" : "secondary"}>{head.status}</Badge></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    );
                    if (expanded) {
                      items.forEach(m => {
                        const stk = stockByMat.get(m.id) || 0;
                        const low = stk <= Number(m.low_stock_threshold || 0);
                        rendered.push(
                          <TableRow key={m.id}>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-xs font-mono pl-6">{m.sku || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground pl-4">↳ {m.name}</TableCell>
                            <TableCell className="text-xs">{m.color || "—"}</TableCell>
                            <TableCell className="text-xs font-semibold">{m.size || "—"}</TableCell>
                            <TableCell className="text-xs">{MATERIAL_UNIT_LABEL[m.unit]}</TableCell>
                            <TableCell className="text-right text-xs">{m.unit_cost_eur != null ? Number(m.unit_cost_eur).toFixed(2) : "—"}</TableCell>
                            <TableCell className="text-right font-semibold"><span className={low ? "text-amber-600" : ""}>{stk}</span></TableCell>
                            <TableCell><Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge></TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setMatDlg({ open: true, item: m })}><Edit className="h-3 w-3" /></Button>
                                {m.status !== "archived" && <Button size="sm" variant="ghost" onClick={async () => { const { error } = await supabase.from("esp_material_items").update({ status: "archived" }).eq("id", m.id); if (error) toast.error(error.message); else { toast.success("Archivado"); load(); } }}><Archive className="h-3 w-3" /></Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      });
                    }
                  });
                  return rendered;
                })()}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ============== STOCK MATRIX ============== */}
        <TabsContent value="stock" className="space-y-3">
          <Card className="p-0 overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Material</TableHead><TableHead>Tipo</TableHead><TableHead>Talla</TableHead>
                {locations.map(l => <TableHead key={l.id} className="text-right">{l.name}</TableHead>)}
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {materials.filter(m => m.status === "active").map(m => {
                  const total = stockByMat.get(m.id) || 0;
                  const low = total <= Number(m.low_stock_threshold || 0);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm font-medium">{m.name}<div className="text-[10px] text-muted-foreground font-mono">{m.sku}</div></TableCell>
                      <TableCell><Badge variant="outline">{MATERIAL_TYPE_LABEL[m.material_type]}</Badge></TableCell>
                      <TableCell className="text-xs">{m.normalized_size || "—"}</TableCell>
                      {locations.map(l => {
                        const v = stockByMatLoc.get(`${m.id}::${l.id}`) || 0;
                        return <TableCell key={l.id} className="text-right text-xs font-mono">{v}</TableCell>;
                      })}
                      <TableCell className={"text-right font-bold " + (low ? "text-amber-600" : "")}>{total}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {MOVEMENT_TYPES_UI.map(t => (
                            <Button key={t.value} size="sm" variant="outline" title={t.label}
                              onClick={() => setMovDlg({ open: true, type: t.value, materialId: m.id, locationId: locations[0]?.id })}>
                              <t.icon className="h-3 w-3" />
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ============== MOVIMIENTOS ============== */}
        <TabsContent value="movimientos" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={movMatFilter} onValueChange={setMovMatFilter}><SelectTrigger className="w-60"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">Todos los materiales</SelectItem>
              {materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent></Select>
            <Select value={movTypeFilter} onValueChange={setMovTypeFilter}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {Object.entries(MOVEMENT_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent></Select>
          </div>
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Fecha</TableHead><TableHead>Material</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Ubicación</TableHead><TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Antes</TableHead><TableHead className="text-right">Después</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredMovements.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Sin movimientos.</TableCell></TableRow>}
                {filteredMovements.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{formatDMY(m.created_at)}</TableCell>
                    <TableCell className="text-xs">{matsById.get(m.material_id)?.name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{MOVEMENT_TYPE_LABEL[m.movement_type]}</Badge></TableCell>
                    <TableCell className="text-xs">{m.location_id ? (locById.get(m.location_id)?.name || "—") : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{Number(m.quantity).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{m.quantity_before != null ? Number(m.quantity_before).toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{m.quantity_after != null ? Number(m.quantity_after).toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-xs">{m.reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ============== RECETAS ============== */}
        <TabsContent value="recetas" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setRecipeDlg({ open: true, recipe: null })}><Plus className="h-4 w-4 mr-1" /> Nueva receta</Button>
          </div>
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Producto</TableHead><TableHead>Nombre</TableHead>
                <TableHead>Materiales</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {recipes.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Sin recetas.</TableCell></TableRow>}
                {recipes.map(r => {
                  const items = recipeItems.filter(i => i.recipe_id === r.id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm font-medium">{prodById.get(r.product_id)?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{r.name || "—"}</TableCell>
                      <TableCell className="text-xs">
                        <ul className="space-y-0.5">
                          {items.map(it => {
                            const mat = matsById.get(it.material_id);
                            return <li key={it.id}>{Number(it.quantity_per_unit)}× <span className="font-medium">{mat?.name || "?"}</span> <span className="text-muted-foreground">({it.size_strategy})</span></li>;
                          })}
                        </ul>
                      </TableCell>
                      <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setTestDlg({ open: true, recipeId: r.id })}><FlaskConical className="h-3 w-3 mr-1" />Probar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setRecipeDlg({ open: true, recipe: r })}><Edit className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <MaterialDialog state={matDlg} onClose={() => setMatDlg({ open: false })} onSaved={load} />
      <MovementDialog state={movDlg} onClose={() => setMovDlg({ open: false })} onSaved={load} materials={materials} locations={locations} />
      <RecipeDialog state={recipeDlg} onClose={() => setRecipeDlg({ open: false })} onSaved={load} products={products} materials={materials} recipeItems={recipeItems} />
      <RecipeTestDialog state={testDlg} onClose={() => setTestDlg({ open: false })} recipes={recipes} recipeItems={recipeItems} materials={materials} stockByMatLoc={stockByMatLoc} locations={locations} />
    </div>
  );
}

/* ===================== DIALOGS ===================== */

function MaterialDialog({ state, onClose, onSaved }: any) {
  const item = state.item as MaterialItem | null;
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm(item ? { ...item } : { material_type: "blank", unit: "unit", status: "active", low_stock_threshold: 0 });
  }, [item, state.open]);

  const save = async () => {
    if (!form.name) { toast.error("Nombre requerido"); return; }
    setBusy(true);
    const payload: any = { ...form };
    if (payload.size) payload.normalized_size = normalizeSize(payload.size);
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const { error } = item
      ? await supabase.from("esp_material_items").update(payload).eq("id", item.id)
      : await supabase.from("esp_material_items").insert(payload);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(item ? "Actualizado" : "Material creado"); onClose(); onSaved(); }
  };

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Editar material" : "Nuevo material"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Tipo *</Label><Select value={form.material_type} onValueChange={v => setForm({ ...form, material_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MATERIAL_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>SKU</Label><Input value={form.sku || ""} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
          <div className="col-span-2"><Label>Nombre *</Label><Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Color</Label><Input value={form.color || ""} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
          <div><Label>Talla</Label><Input value={form.size || ""} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="S, M, L, XL, 32..." /></div>
          <div><Label>Unidad</Label><Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MATERIAL_UNIT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Costo €</Label><Input type="number" step="0.01" value={form.unit_cost_eur || ""} onChange={e => setForm({ ...form, unit_cost_eur: e.target.value === "" ? null : Number(e.target.value) })} /></div>
          <div><Label>Umbral bajo stock</Label><Input type="number" step="0.01" value={form.low_stock_threshold || 0} onChange={e => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} /></div>
          <div><Label>Estado</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activo</SelectItem><SelectItem value="inactive">Inactivo</SelectItem><SelectItem value="archived">Archivado</SelectItem></SelectContent></Select></div>
          <div className="col-span-2"><Label>Notas</Label><Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({ state, onClose, onSaved, materials, locations }: any) {
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm({
      movement_type: state.type || "manual_in",
      material_id: state.materialId,
      location_id: state.locationId || locations[0]?.id,
      quantity: 1,
      reason: "",
      notes: "",
    });
  }, [state.open]);

  const isOut = ["manual_out", "adjustment"].includes(form.movement_type);

  const save = async () => {
    if (!form.material_id) { toast.error("Material requerido"); return; }
    if (!form.location_id) { toast.error("Ubicación requerida"); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { toast.error("Cantidad > 0"); return; }
    if (isOut && !form.reason) { toast.error("Motivo requerido"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("esp_apply_material_movement" as any, {
      p_movement_type: form.movement_type,
      p_material_id: form.material_id,
      p_quantity: Number(form.quantity),
      p_location_id: form.location_id,
      p_reason: form.reason || null,
      p_notes: form.notes || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Movimiento aplicado");
    onClose(); onSaved();
  };

  const labelMap: Record<string, string> = { manual_in: "Entrada", manual_out: "Salida", adjustment: "Ajuste (cantidad absoluta)" };

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{labelMap[form.movement_type] || "Movimiento"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Material</Label><Select value={form.material_id} onValueChange={v => setForm({ ...form, material_id: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{materials.filter((m: any) => m.status === "active").map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Ubicación</Label><Select value={form.location_id} onValueChange={v => setForm({ ...form, location_id: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>{form.movement_type === "adjustment" ? "Nueva cantidad total" : "Cantidad"}</Label><Input type="number" step="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
          <div><Label>Motivo {isOut && <span className="text-destructive">*</span>}</Label><Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
          <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecipeDialog({ state, onClose, onSaved, products, materials, recipeItems }: any) {
  const recipe = state.recipe as RecipeRow | null;
  const [form, setForm] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(recipe ? { ...recipe } : { status: "active", quantity_per_unit: 1 });
    setItems(recipe ? recipeItems.filter((i: any) => i.recipe_id === recipe.id) : []);
  }, [recipe, state.open]);

  const addItem = () => setItems([...items, { _new: true, material_id: materials[0]?.id, quantity_per_unit: 1, size_strategy: "fixed", required: true }]);
  const removeItem = async (idx: number) => {
    const it = items[idx];
    if (it.id) await supabase.from("esp_product_material_recipe_items").delete().eq("id", it.id);
    setItems(items.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!form.product_id) { toast.error("Producto requerido"); return; }
    setBusy(true);
    let recipeId = recipe?.id;
    if (recipe) {
      const { error } = await supabase.from("esp_product_material_recipes").update({ name: form.name, status: form.status, notes: form.notes }).eq("id", recipe.id);
      if (error) { toast.error(error.message); setBusy(false); return; }
    } else {
      const { data, error } = await supabase.from("esp_product_material_recipes").insert({ product_id: form.product_id, name: form.name, status: form.status, notes: form.notes }).select("id").single();
      if (error) { toast.error(error.message); setBusy(false); return; }
      recipeId = data.id;
    }
    for (const it of items) {
      if (it.id && !it._delete) {
        await supabase.from("esp_product_material_recipe_items").update({ material_id: it.material_id, quantity_per_unit: it.quantity_per_unit, size_strategy: it.size_strategy, required: it.required }).eq("id", it.id);
      } else if (!it.id) {
        await supabase.from("esp_product_material_recipe_items").insert({ recipe_id: recipeId, material_id: it.material_id, quantity_per_unit: it.quantity_per_unit, size_strategy: it.size_strategy, required: it.required });
      }
    }
    setBusy(false);
    toast.success("Receta guardada");
    onClose(); onSaved();
  };

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{recipe ? "Editar receta" : "Nueva receta"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Producto *</Label><Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })} disabled={!!recipe}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Nombre receta</Label><Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1"><Label>Materiales</Label><Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Agregar</Button></div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border p-2 rounded">
                  <div className="col-span-5"><Label className="text-xs">Material</Label><Select value={it.material_id} onValueChange={v => { const c = [...items]; c[idx] = { ...it, material_id: v }; setItems(c); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{materials.filter((m: any) => m.status === "active").map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="col-span-2"><Label className="text-xs">Cant.</Label><Input type="number" step="0.01" value={it.quantity_per_unit} onChange={e => { const c = [...items]; c[idx] = { ...it, quantity_per_unit: Number(e.target.value) }; setItems(c); }} /></div>
                  <div className="col-span-4"><Label className="text-xs">Estrategia talla</Label><Select value={it.size_strategy} onValueChange={v => { const c = [...items]; c[idx] = { ...it, size_strategy: v }; setItems(c); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fijo</SelectItem><SelectItem value="match_variant_size">Match talla variante</SelectItem><SelectItem value="manual_select">Manual</SelectItem></SelectContent></Select></div>
                  <div className="col-span-1"><Button size="sm" variant="ghost" onClick={() => removeItem(idx)}>×</Button></div>
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-muted-foreground">Sin materiales aún.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecipeTestDialog({ state, onClose, recipes, recipeItems, materials, stockByMatLoc, locations }: any) {
  const recipe = recipes.find((r: any) => r.id === state.recipeId);
  const [size, setSize] = useState("M");
  const items = recipeItems.filter((i: any) => i.recipe_id === state.recipeId);
  const matsById = useMemo(() => new Map<string, MaterialItem>(materials.map((m: MaterialItem) => [m.id, m])), [materials]);

  const resolved = items.map((it: any) => {
    const baseMat = matsById.get(it.material_id) as MaterialItem | undefined;
    let target = baseMat;
    let matchNote = "";
    if (it.size_strategy === "match_variant_size") {
      const normSize = normalizeSize(size);
      const candidate = materials.find((m: MaterialItem) =>
        m.status === "active" &&
        m.material_type === baseMat?.material_type &&
        m.color === baseMat?.color &&
        normalizeSize(m.normalized_size || m.size || "") === normSize
      );
      if (candidate) { target = candidate; matchNote = `Match por talla ${normSize}`; }
      else matchNote = `Sin blank para talla ${normSize}`;
    }
    const totalStock: number = target ? (locations as LocationRow[]).reduce((s: number, l: LocationRow) => s + (Number(stockByMatLoc.get(`${target!.id}::${l.id}`)) || 0), 0) : 0;
    const required = Number(it.quantity_per_unit) || 1;
    return { itemId: it.id, baseMat, target, required, totalStock, matchNote, ok: !!target && totalStock >= required };
  });

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Probar receta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Talla de prueba</Label><Select value={size} onValueChange={setSize}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["S","M","L","XL","XXL"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <p className="text-xs text-muted-foreground">Esta prueba solo simula. No consume materiales.</p>
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="p-2 text-left">Material requerido</th><th className="p-2 text-right">Req.</th><th className="p-2 text-right">Stock</th><th className="p-2">Estado</th></tr></thead>
              <tbody>
                {resolved.map((r: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{r.target?.name || r.baseMat?.name || "—"}</div>
                      {r.matchNote && <div className="text-[10px] text-muted-foreground">{r.matchNote}</div>}
                    </td>
                    <td className="p-2 text-right font-mono">{r.required}</td>
                    <td className="p-2 text-right font-mono">{r.totalStock}</td>
                    <td className="p-2">{r.ok ? <Badge className="bg-emerald-600">OK</Badge> : <Badge variant="destructive">Faltante</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <DialogFooter><Button onClick={onClose}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
