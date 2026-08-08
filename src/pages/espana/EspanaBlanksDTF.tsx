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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Shirt, Plus, Edit, Archive, Loader2, ArrowDownToLine, ArrowUpFromLine, Settings2, FlaskConical, Layers, Package, AlertTriangle, ChevronRight, ChevronDown, ChevronsUpDown, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { formatDMY } from "@/lib/dateUtils";
import { normalizeSize, MATERIAL_TYPE_LABEL, MATERIAL_UNIT_LABEL, MOVEMENT_TYPE_LABEL } from "@/lib/espMaterials";
import { normalizeColor } from "@/lib/coreNormalize";

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
interface ProductRow { id: string; name: string; sku: string | null; category: string | null; product_type: string | null; color: string | null; fulfillment_mode?: string | null; }

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
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
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
  const [groupDlg, setGroupDlg] = useState<{ open: boolean; items?: MaterialItem[]; title?: string }>({ open: false });
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
      supabase.from("esp_products").select("id,name,sku,category,product_type,color,fulfillment_mode").order("name"),
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

    // Load profiles for users that appear in movements
    const userIds = Array.from(new Set((mvs.data || []).map((m: any) => m.created_by).filter(Boolean)));
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", userIds as string[]);
      setProfiles((profs || []) as any);
    } else {
      setProfiles([]);
    }
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
  const profilesById = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const manualMovements = useMemo(() =>
    movements.filter(m => ["manual_in", "manual_out", "adjustment", "correction"].includes(m.movement_type)).slice(0, 30)
  , [movements]);

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

          {/* Inventario por blank (matriz tipo + nombre + color × tallas) */}
          {(() => {
            const sizeOrder = ["XS","S","M","L","XL","XXL","XXXL"];
            const groups = new Map<string, { type: string; name: string; color: string | null; items: MaterialItem[] }>();
            materials.filter(m => m.status === "active").forEach(m => {
              const k = `${m.material_type}::${m.name}::${m.color || ""}`;
              if (!groups.has(k)) groups.set(k, { type: m.material_type, name: m.name, color: m.color, items: [] });
              groups.get(k)!.items.push(m);
            });
            // Collect all sizes seen
            const allSizes = new Set<string>();
            groups.forEach(g => g.items.forEach(i => { if (i.size) allSizes.add(i.size.toUpperCase()); }));
            const sizeCols = Array.from(allSizes).sort((a, b) => {
              const ia = sizeOrder.indexOf(a); const ib = sizeOrder.indexOf(b);
              return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });
            const groupList = Array.from(groups.values()).sort((a, b) => (a.type + a.name).localeCompare(b.type + b.name));
            if (groupList.length === 0) return null;
            return (
              <Card className="p-0 overflow-hidden">
                <div className="p-4 pb-2">
                  <h3 className="font-bold text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Inventario por blank y talla</h3>
                  <p className="text-xs text-muted-foreground">Stock total sumado de todas las sedes. Click en una fila abre el editor de tallas.</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Material</TableHead>
                      <TableHead className="text-xs">Color</TableHead>
                      {sizeCols.map(s => <TableHead key={s} className="text-xs text-center">{s}</TableHead>)}
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {groupList.map(g => {
                        const total = g.items.reduce((s, i) => s + (stockByMat.get(i.id) || 0), 0);
                        const totalLow = total === 0 || g.items.some(i => (stockByMat.get(i.id) || 0) <= Number(i.low_stock_threshold || 0));
                        return (
                          <TableRow key={g.type + g.name + g.color}
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => setGroupDlg({ open: true, items: g.items, title: `${g.name}${g.color ? ` · ${g.color}` : ""}` })}>
                            <TableCell><Badge variant="outline" className="text-[10px]">{MATERIAL_TYPE_LABEL[g.type]}</Badge></TableCell>
                            <TableCell className="text-xs font-medium">{g.name}</TableCell>
                            <TableCell className="text-xs">{g.color || "—"}</TableCell>
                            {sizeCols.map(s => {
                              const it = g.items.find(i => (i.size || "").toUpperCase() === s);
                              const stk = it ? (stockByMat.get(it.id) || 0) : null;
                              const low = it ? stk! <= Number(it.low_stock_threshold || 0) : false;
                              return (
                                <TableCell key={s} className="text-center text-xs font-mono">
                                  {it == null ? <span className="text-muted-foreground/40">—</span>
                                    : <span className={low ? "text-amber-600 font-bold" : ""}>{stk}</span>}
                                </TableCell>
                              );
                            })}
                            <TableCell className={"text-right text-sm font-bold " + (totalLow ? "text-amber-600" : "")}>{total}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            );
          })()}

          {kpis.low > 0 && (
            <Card className="p-4">
              <h3 className="font-bold mb-2 flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" /> Materiales bajo stock ({kpis.low})</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Material</TableHead>
                    <TableHead className="text-xs">Talla</TableHead>
                    <TableHead className="text-xs text-right">Stock</TableHead>
                    <TableHead className="text-xs text-right">Umbral</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {lowStockMaterials.map(m => (
                      <TableRow key={m.id}>
                        <TableCell><Badge variant="outline" className="text-[10px]">{MATERIAL_TYPE_LABEL[m.material_type]}</Badge></TableCell>
                        <TableCell className="text-xs">{m.name}{m.color ? ` · ${m.color}` : ""}</TableCell>
                        <TableCell className="text-xs font-semibold">{m.size || "—"}</TableCell>
                        <TableCell className="text-right text-xs font-mono text-amber-600 font-bold">{stockByMat.get(m.id) || 0}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{m.low_stock_threshold}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                  let groupIndex = 0;
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
                    // Zebra por grupo de variante: gris tenue vs blanco
                    const zebra = groupIndex % 2 === 0 ? "" : "bg-zinc-50 dark:bg-zinc-900/30";
                    const zebraChild = groupIndex % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-zinc-50 dark:bg-zinc-900/30";
                    groupIndex++;

                    if (!isGroup) {
                      const m = head;
                      const stk = stockByMat.get(m.id) || 0;
                      const low = stk <= Number(m.low_stock_threshold || 0);
                      rendered.push(
                        <TableRow key={m.id} className={`${zebra} border-t-2 border-t-muted`}>
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
                              <Button size="sm" variant="ghost" title="Entrada rápida" onClick={() => setMovDlg({ open: true, type: "manual_in", materialId: m.id })}><ArrowDownToLine className="h-3 w-3 text-green-600" /></Button>
                              <Button size="sm" variant="ghost" title="Salida rápida" onClick={() => setMovDlg({ open: true, type: "manual_out", materialId: m.id })}><ArrowUpFromLine className="h-3 w-3 text-red-600" /></Button>
                              <Button size="sm" variant="ghost" title="Ajuste" onClick={() => setMovDlg({ open: true, type: "adjustment", materialId: m.id })}><Settings2 className="h-3 w-3" /></Button>
                              <Button size="sm" variant="ghost" title="Editar" onClick={() => setMatDlg({ open: true, item: m })}><Edit className="h-3 w-3" /></Button>
                              {m.status !== "archived" && <Button size="sm" variant="ghost" title="Archivar" onClick={async () => { const { error } = await supabase.from("esp_material_items").update({ status: "archived" }).eq("id", m.id); if (error) toast.error(error.message); else { toast.success("Archivado"); load(); } }}><Archive className="h-3 w-3" /></Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                      return;
                    }

                    // Parent group row — click opens the size editor dialog; chevron toggles inline expansion
                    rendered.push(
                      <TableRow key={key} className={`${groupIndex % 2 === 1 ? "bg-zinc-100 dark:bg-zinc-800/50" : "bg-muted/60"} cursor-pointer hover:bg-muted border-t-2 border-t-muted-foreground/20`}
                        onClick={() => setGroupDlg({ open: true, items, title: `${head.name}${head.color ? ` · ${head.color}` : ""}` })}>
                        <TableCell onClick={(e) => { e.stopPropagation(); toggleGroup(key); }} className="cursor-pointer">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell><Badge variant="outline">{MATERIAL_TYPE_LABEL[head.material_type]}</Badge></TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{items.length} tallas</TableCell>
                        <TableCell className="font-bold text-sm">{head.name}</TableCell>
                        <TableCell className="text-xs">{head.color || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{items.map(i => i.size).filter(Boolean).join(" · ")}</TableCell>
                        <TableCell className="text-xs">{MATERIAL_UNIT_LABEL[head.unit]}</TableCell>
                        <TableCell className="text-right text-xs">—</TableCell>
                        <TableCell className="text-right font-bold"><span className={totalLow > 0 ? "text-amber-600" : ""}>{totalStock}</span></TableCell>
                        <TableCell><Badge variant={head.status === "active" ? "default" : "secondary"}>{head.status}</Badge></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={() => setGroupDlg({ open: true, items, title: `${head.name}${head.color ? ` · ${head.color}` : ""}` })}><Edit className="h-3 w-3 mr-1" />Editar tallas</Button>
                        </TableCell>
                      </TableRow>
                    );
                    if (expanded) {
                      items.forEach(m => {
                        const stk = stockByMat.get(m.id) || 0;
                        const low = stk <= Number(m.low_stock_threshold || 0);
                        rendered.push(
                          <TableRow key={m.id} className={zebraChild}>
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
                                <Button size="sm" variant="ghost" title="Entrada rápida" onClick={() => setMovDlg({ open: true, type: "manual_in", materialId: m.id })}><ArrowDownToLine className="h-3 w-3 text-green-600" /></Button>
                                <Button size="sm" variant="ghost" title="Salida rápida" onClick={() => setMovDlg({ open: true, type: "manual_out", materialId: m.id })}><ArrowUpFromLine className="h-3 w-3 text-red-600" /></Button>
                                <Button size="sm" variant="ghost" title="Ajuste" onClick={() => setMovDlg({ open: true, type: "adjustment", materialId: m.id })}><Settings2 className="h-3 w-3" /></Button>
                                <Button size="sm" variant="ghost" title="Editar" onClick={() => setMatDlg({ open: true, item: m })}><Edit className="h-3 w-3" /></Button>
                                {m.status !== "archived" && <Button size="sm" variant="ghost" title="Archivar" onClick={async () => { const { error } = await supabase.from("esp_material_items").update({ status: "archived" }).eq("id", m.id); if (error) toast.error(error.message); else { toast.success("Archivado"); load(); } }}><Archive className="h-3 w-3" /></Button>}
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

          {/* Variaciones manuales recientes — alerta de modificaciones humanas */}
          <Card className="p-4 border-l-4 border-l-amber-500">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="font-bold text-sm">Variaciones manuales recientes ({manualMovements.length})</h3>
              <span className="text-xs text-muted-foreground">— Entradas, salidas, ajustes y correcciones hechas a mano. Revisa si algo no cuadra.</span>
            </div>
            {manualMovements.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin movimientos manuales registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Usuario</TableHead>
                    <TableHead className="text-xs">Material</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Ubicación</TableHead>
                    <TableHead className="text-right text-xs">Cant.</TableHead>
                    <TableHead className="text-right text-xs">Antes → Después</TableHead>
                    <TableHead className="text-xs">Motivo</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {manualMovements.map(m => {
                      const mat = matsById.get(m.material_id);
                      const prof = m.created_by ? profilesById.get(m.created_by) : null;
                      const userLabel = prof?.full_name || prof?.email || (m.created_by ? `${m.created_by.slice(0, 8)}…` : "Sistema");
                      const tone = m.movement_type === "manual_out" ? "text-red-600"
                        : m.movement_type === "manual_in" ? "text-emerald-600"
                        : "text-amber-700";
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">{new Date(m.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-medium">{userLabel}</TableCell>
                          <TableCell className="text-xs">{mat ? `${mat.name}${mat.size ? ` · ${mat.size}` : ""}` : "—"}</TableCell>
                          <TableCell><Badge variant="outline" className={tone}>{MOVEMENT_TYPE_LABEL[m.movement_type]}</Badge></TableCell>
                          <TableCell className="text-xs">{m.location_id ? (locById.get(m.location_id)?.name || "—") : "—"}</TableCell>
                          <TableCell className={`text-right text-xs font-mono ${tone}`}>{Number(m.quantity) > 0 ? "+" : ""}{Number(m.quantity).toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">
                            {m.quantity_before != null ? Number(m.quantity_before).toFixed(2) : "—"} → {m.quantity_after != null ? Number(m.quantity_after).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{m.reason || <span className="text-amber-600 italic">sin motivo</span>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
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
      <RecipeDialog state={recipeDlg} onClose={() => setRecipeDlg({ open: false })} onSaved={load} products={products} materials={materials} recipeItems={recipeItems} stockByMatLoc={stockByMatLoc} locations={locations} />
      <RecipeTestDialog state={testDlg} onClose={() => setTestDlg({ open: false })} recipes={recipes} recipeItems={recipeItems} materials={materials} stockByMatLoc={stockByMatLoc} locations={locations} />
      <GroupSizesDialog state={groupDlg} onClose={() => setGroupDlg({ open: false })} onSaved={load} locations={locations} stockByMatLoc={stockByMatLoc} />
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

function MaterialCombobox({ materials, value, onChange, stockByMatLoc, locations }: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const active = useMemo(() => (materials as MaterialItem[]).filter((m) => m.status === "active"), [materials]);
  const selected = useMemo(() => (materials as MaterialItem[]).find((m) => m.id === value), [materials, value]);

  const stockOf = (id: string) => {
    if (!stockByMatLoc || !locations) return null;
    return (locations as LocationRow[]).reduce((s: number, l: LocationRow) => s + (Number(stockByMatLoc.get(`${id}::${l.id}`)) || 0), 0);
  };

  const contextOf = (m: MaterialItem) => {
    const parts: string[] = [];
    if (m.sku) parts.push(`SKU ${m.sku}`);
    if (m.color) parts.push(m.color);
    if (m.size) parts.push(`Talla ${m.size}`);
    if (m.material_type) parts.push(MATERIAL_TYPE_LABEL[m.material_type] || m.material_type);
    const st = stockOf(m.id);
    if (st !== null) parts.push(`Stock ${st}`);
    return parts.join(" · ");
  };

  const filtered = useMemo(() => {
    const q = normalizeColor(search.trim().replace(/\s+/g, " "));
    if (!q) return active;
    return active.filter((m) => {
      const hay = normalizeColor([m.name, m.sku, m.color, m.size, m.normalized_size, m.material_type, MATERIAL_TYPE_LABEL[m.material_type]].filter(Boolean).join(" "));
      return hay.includes(q);
    });
  }, [active, search]);

  return (
    <Popover modal open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal h-9">
          <span className="truncate text-left">{selected ? selected.name : "Seleccionar material…"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0" align="start" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar material (nombre, SKU, color, talla)…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain">

            <CommandEmpty>Sin coincidencias.</CommandEmpty>
            <CommandGroup>
              {filtered.slice(0, 300).map((m) => (
                <CommandItem key={m.id} value={m.id} onSelect={() => { onChange(m.id); setOpen(false); setSearch(""); }}>
                  <Check className={`mr-2 h-3.5 w-3.5 shrink-0 ${value === m.id ? "opacity-100" : "opacity-0"}`} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{contextOf(m) || "Sin datos adicionales"}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function RecipeDialog({ state, onClose, onSaved, products, materials, recipeItems, stockByMatLoc, locations }: any) {
  const recipe = state.recipe as RecipeRow | null;
  const [form, setForm] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    setForm(recipe ? { ...recipe } : { status: "active", quantity_per_unit: 1 });
    setItems(recipe ? recipeItems.filter((i: any) => i.recipe_id === recipe.id) : []);
    setProductSearch("");
    setProductOpen(false);
  }, [recipe, state.open]);

  const selectedProduct = useMemo(() => products.find((p: ProductRow) => p.id === form.product_id), [products, form.product_id]);

  const productSearchable = useMemo(() => {
    const q = normalizeColor(productSearch.trim());
    return products.filter((p: ProductRow) => {
      if (!q) return true;
      const haystack = normalizeColor([p.name, p.sku, p.category, p.product_type].filter(Boolean).join(" "));
      return haystack.includes(q);
    });
  }, [products, productSearch]);

  const useProductName = () => {
    if (!selectedProduct) return;
    setForm({ ...form, name: selectedProduct.name });
  };

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
            <div>
              <Label>Producto *</Label>
              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productOpen}
                    className="w-full justify-between font-normal"
                    disabled={!!recipe}
                  >
                    <span className="truncate">{selectedProduct ? `${selectedProduct.name} ${selectedProduct.sku ? `· ${selectedProduct.sku}` : ""}` : "Seleccionar producto…"}</span>
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar por nombre, SKU o categoría…"
                      value={productSearch}
                      onValueChange={setProductSearch}
                    />
                    <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
                      <CommandEmpty>Sin coincidencias.</CommandEmpty>
                      <CommandGroup>
                        {productSearchable.slice(0, 200).map((p: ProductRow) => (
                          <CommandItem
                            key={p.id}
                            value={p.id}
                            onSelect={() => { setForm({ ...form, product_id: p.id }); setProductOpen(false); setProductSearch(""); }}
                          >
                            <Check className={`mr-2 h-3.5 w-3.5 ${form.product_id === p.id ? "opacity-100" : "opacity-0"}`} />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate text-sm">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                {p.sku ? `SKU ${p.sku}` : "Sin SKU"}{p.category ? ` · ${p.category}` : ""}{p.product_type ? ` · ${p.product_type}` : ""}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Nombre receta</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={useProductName}
                  disabled={!selectedProduct}
                  title="Usar nombre del producto seleccionado"
                >
                  <ArrowRight className="h-3 w-3" />
                  Usar nombre del producto
                </Button>
              </div>
              <Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1"><Label>Materiales</Label><Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Agregar</Button></div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border p-2 rounded">
                  <div className="col-span-5 min-w-0"><Label className="text-xs">Material</Label><MaterialCombobox materials={materials} value={it.material_id} onChange={(v: string) => { const c = [...items]; c[idx] = { ...c[idx], material_id: v }; setItems(c); }} stockByMatLoc={stockByMatLoc} locations={locations} /></div>
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

/* ===================== GROUP SIZES DIALOG ===================== */
function GroupSizesDialog({ state, onClose, onSaved, locations, stockByMatLoc }: any) {
  const items: MaterialItem[] = state.items || [];
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!state.open) return;
    const initial = items.map((m: MaterialItem) => {
      const stocks: Record<string, number> = {};
      (locations || []).forEach((l: LocationRow) => {
        stocks[l.id] = Number(stockByMatLoc.get(`${m.id}::${l.id}`) || 0);
      });
      return {
        id: m.id,
        sku: m.sku || "",
        size: m.size || "",
        unit_cost_eur: m.unit_cost_eur ?? null,
        low_stock_threshold: Number(m.low_stock_threshold || 0),
        status: m.status,
        stocks,
        _origStocks: { ...stocks },
        _origMeta: { sku: m.sku || "", size: m.size || "", unit_cost_eur: m.unit_cost_eur ?? null, low_stock_threshold: Number(m.low_stock_threshold || 0), status: m.status },
      };
    });
    setRows(initial);
    setReason("");
  }, [state.open]);

  const updateRow = (idx: number, patch: any) => {
    const c = [...rows]; c[idx] = { ...c[idx], ...patch }; setRows(c);
  };
  const updateStock = (idx: number, locId: string, value: string) => {
    const c = [...rows];
    c[idx] = { ...c[idx], stocks: { ...c[idx].stocks, [locId]: value === "" ? 0 : Number(value) } };
    setRows(c);
  };

  const save = async () => {
    setBusy(true);
    let metaUpdates = 0, stockUpdates = 0, errors = 0;
    for (const r of rows) {
      // Meta diff
      const m = r._origMeta;
      const metaDiff: any = {};
      if (r.sku !== m.sku) metaDiff.sku = r.sku || null;
      if (r.size !== m.size) { metaDiff.size = r.size || null; metaDiff.normalized_size = r.size ? normalizeSize(r.size) : null; }
      if (Number(r.unit_cost_eur ?? 0) !== Number(m.unit_cost_eur ?? 0)) metaDiff.unit_cost_eur = r.unit_cost_eur === null || r.unit_cost_eur === "" ? null : Number(r.unit_cost_eur);
      if (Number(r.low_stock_threshold) !== Number(m.low_stock_threshold)) metaDiff.low_stock_threshold = Number(r.low_stock_threshold);
      if (r.status !== m.status) metaDiff.status = r.status;
      if (Object.keys(metaDiff).length > 0) {
        const { error } = await supabase.from("esp_material_items").update(metaDiff).eq("id", r.id);
        if (error) { errors++; toast.error(`${r.size}: ${error.message}`); } else metaUpdates++;
      }
      // Stock diffs → adjustment per location
      for (const locId of Object.keys(r.stocks)) {
        const newVal = Number(r.stocks[locId] || 0);
        const oldVal = Number(r._origStocks[locId] || 0);
        if (newVal === oldVal) continue;
        const { error } = await supabase.rpc("esp_apply_material_movement" as any, {
          p_movement_type: "adjustment",
          p_material_id: r.id,
          p_quantity: newVal,
          p_location_id: locId,
          p_reason: reason || "Ajuste manual por talla",
          p_notes: null,
        });
        if (error) { errors++; toast.error(`Stock ${r.size}: ${error.message}`); } else stockUpdates++;
      }
    }
    setBusy(false);
    if (errors === 0) toast.success(`Guardado: ${metaUpdates} cambios + ${stockUpdates} ajustes de stock`);
    onClose(); onSaved();
  };

  const sizeOrder = ["XS","S","M","L","XL","XXL","XXXL"];
  const sortedRows = [...rows].sort((a, b) => {
    const ia = sizeOrder.indexOf((a.size || "").toUpperCase());
    const ib = sizeOrder.indexOf((b.size || "").toUpperCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Editar tallas · {state.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">Cambia tallas, SKU, costo, umbral y stock por sede. Los ajustes de stock quedan registrados como movimientos.</p>
        </DialogHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Talla</TableHead>
              <TableHead className="text-xs">SKU</TableHead>
              <TableHead className="text-xs text-right">Costo €</TableHead>
              <TableHead className="text-xs text-right">Umbral</TableHead>
              {(locations || []).map((l: LocationRow) => (
                <TableHead key={l.id} className="text-xs text-right">{l.name}</TableHead>
              ))}
              <TableHead className="text-xs">Estado</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sortedRows.map((r) => {
                const idx = rows.findIndex(x => x.id === r.id);
                return (
                  <TableRow key={r.id}>
                    <TableCell><Input className="h-8 w-20" value={r.size} onChange={e => updateRow(idx, { size: e.target.value })} /></TableCell>
                    <TableCell><Input className="h-8 w-36 font-mono text-xs" value={r.sku} onChange={e => updateRow(idx, { sku: e.target.value })} /></TableCell>
                    <TableCell className="text-right"><Input className="h-8 w-24 text-right" type="number" step="0.01" value={r.unit_cost_eur ?? ""} onChange={e => updateRow(idx, { unit_cost_eur: e.target.value === "" ? null : Number(e.target.value) })} /></TableCell>
                    <TableCell className="text-right"><Input className="h-8 w-20 text-right" type="number" step="1" value={r.low_stock_threshold} onChange={e => updateRow(idx, { low_stock_threshold: Number(e.target.value) })} /></TableCell>
                    {(locations || []).map((l: LocationRow) => {
                      const changed = Number(r.stocks[l.id] || 0) !== Number(r._origStocks[l.id] || 0);
                      return (
                        <TableCell key={l.id} className="text-right">
                          <Input className={`h-8 w-20 text-right ${changed ? "border-amber-500 ring-1 ring-amber-500/40" : ""}`} type="number" step="1" value={r.stocks[l.id]} onChange={e => updateStock(idx, l.id, e.target.value)} />
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Select value={r.status} onValueChange={v => updateRow(idx, { status: v })}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Activo</SelectItem>
                          <SelectItem value="inactive">Inactivo</SelectItem>
                          <SelectItem value="archived">Archivado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3">
          <Label className="text-xs">Motivo del ajuste (queda en el historial)</Label>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: Conteo físico semanal, llegada de mercancía..." />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
