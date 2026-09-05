import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Eye, Search, Power, PowerOff, Copy, Upload, Download,
  FileSpreadsheet, AlertTriangle, ChevronRight, ChevronDown, Layers, Undo2,
} from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";
import { formatDMY } from "@/lib/dateUtils";
import * as XLSX from "xlsx";

type CostStructure = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  product_type: string | null;
  base_currency: string;
  estimated_sale_price: number | null;
  status: string;
  notes: string | null;
  total_unit_cost: number;
  estimated_gross_margin: number | null;
  estimated_gross_margin_percent: number | null;
  updated_at: string;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  woo_product_name: string | null;
  woo_permalink: string | null;
  variant_id: string | null;
};

type CoreProduct = {
  id: string;
  name: string;
  core_sku: string | null;
  product_type: string | null;
  woo_product_id: number | null;
};

type CoreVariant = {
  id: string;
  core_product_id: string;
  size: string | null;
  color: string | null;
  variant_sku: string | null;
  woo_variation_id: number | null;
  cost_structure_id: string | null;
  uses_parent_cost_structure: boolean | null;
  cost_override_enabled: boolean | null;
  variant_unit_cost_usd: number | null;
};

type VariantState = "inherit" | "custom" | "override" | "none";

type VariantRow = {
  variant: CoreVariant;
  label: string;
  state: VariantState;
  unitCost: number | null;
  structureId: string | null;
};

type Group = {
  key: string;
  base: CostStructure | null;
  product: CoreProduct | null;
  name: string;
  productType: string | null;
  wooProductId: number | null;
  variants: VariantRow[];
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Borrador", variant: "outline" },
  active: { label: "Activa", variant: "default" },
  inactive: { label: "Inactiva", variant: "secondary" },
};

const VARIANT_STATE_META: Record<VariantState, { label: string; className: string }> = {
  inherit: { label: "Hereda base", className: "bg-muted text-muted-foreground border-border" },
  custom: { label: "Personalizada", className: "bg-destructive/10 text-destructive border-destructive/30" },
  override: { label: "Override manual", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40" },
  none: { label: "Sin estructura", className: "bg-destructive/15 text-destructive border-destructive/50" },
};

const VARIANT_MODE_LABEL: Record<VariantState, string> = {
  inherit: "Heredado",
  custom: "Estructura propia",
  override: "Manual",
  none: "—",
};

const PRODUCT_TYPES = ["Franela", "Hoodie", "Jogger", "Cargo", "Short", "Gorra", "Accesorio", "Producto terminado", "Otro"];

export default function CoreCostStructures() {
  const navigate = useNavigate();
  const [structures, setStructures] = useState<CostStructure[]>([]);
  const [products, setProducts] = useState<CoreProduct[]>([]);
  const [variants, setVariants] = useState<CoreVariant[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fType, setFType] = useState("all");
  const [fCurrency, setFCurrency] = useState("all");
  const [fWoo, setFWoo] = useState<"all" | "connected" | "missing">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [toDelete, setToDelete] = useState<CostStructure | null>(null);
  const [viewing, setViewing] = useState<CostStructure | null>(null);

  async function load() {
    setLoading(true);
    const [sRes, pRes, vRes] = await Promise.all([
      supabase.from("core_cost_structures").select("*").order("updated_at", { ascending: false }),
      supabase.from("core_products").select("id, name, core_sku, product_type, woo_product_id"),
      supabase.from("core_product_variants")
        .select("id, core_product_id, size, color, variant_sku, woo_variation_id, cost_structure_id, uses_parent_cost_structure, cost_override_enabled, variant_unit_cost_usd"),
    ]);
    if (sRes.error || pRes.error || vRes.error) toast.error("Error cargando estructuras");
    setStructures((sRes.data as any) ?? []);
    setProducts((pRes.data as any) ?? []);
    setVariants((vRes.data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const structureById = useMemo(() => {
    const m = new Map<string, CostStructure>();
    structures.forEach(s => m.set(s.id, s));
    return m;
  }, [structures]);

  const groups = useMemo<Group[]>(() => {
    const productByWoo = new Map<number, CoreProduct>();
    const productById = new Map<string, CoreProduct>();
    products.forEach(p => {
      productById.set(p.id, p);
      if (p.woo_product_id != null) productByWoo.set(Number(p.woo_product_id), p);
    });

    const variantsByProduct = new Map<string, CoreVariant[]>();
    variants.forEach(v => {
      const arr = variantsByProduct.get(v.core_product_id) ?? [];
      arr.push(v);
      variantsByProduct.set(v.core_product_id, arr);
    });

    const keyForProduct = (p: CoreProduct) => p.woo_product_id != null ? `woo:${p.woo_product_id}` : `prod:${p.id}`;
    const map = new Map<string, Group>();

    const ensure = (key: string, base: CostStructure | null, product: CoreProduct | null): Group => {
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          base,
          product,
          name: base?.name ?? product?.name ?? "—",
          productType: base?.product_type ?? product?.product_type ?? null,
          wooProductId: base?.woo_product_id ?? product?.woo_product_id ?? null,
          variants: [],
        };
        map.set(key, g);
      }
      if (!g.base && base) { g.base = base; g.name = base.name; }
      if (!g.product && product) g.product = product;
      return g;
    };

    // 1) Base structures (variant_id null) become parent rows
    structures.filter(s => !s.variant_id).forEach(s => {
      const product = s.woo_product_id != null ? productByWoo.get(Number(s.woo_product_id)) ?? null : null;
      const key = product ? keyForProduct(product) : (s.woo_product_id != null ? `woo:${s.woo_product_id}` : `struct:${s.id}`);
      ensure(key, s, product);
    });

    // 2) Products with variants that have no base structure row yet
    products.forEach(p => {
      const hasVariants = (variantsByProduct.get(p.id) ?? []).length > 0;
      const key = keyForProduct(p);
      if (map.has(key)) { ensure(key, null, p); return; }
      if (!hasVariants) return;
      ensure(key, null, p);
    });

    // 3) Attach variants
    products.forEach(p => {
      const key = keyForProduct(p);
      const g = map.get(key);
      if (!g) return;
      const list = (variantsByProduct.get(p.id) ?? []).slice().sort((a, b) =>
        (a.color ?? "").localeCompare(b.color ?? "") || (a.size ?? "").localeCompare(b.size ?? ""));
      list.forEach(v => {
        const ownStructure = v.cost_structure_id && v.cost_structure_id !== g.base?.id
          ? structureById.get(v.cost_structure_id) ?? null
          : null;
        let state: VariantState;
        let unitCost: number | null = null;
        if (v.cost_override_enabled && v.variant_unit_cost_usd != null) {
          state = "override";
          unitCost = Number(v.variant_unit_cost_usd);
        } else if (ownStructure && !v.uses_parent_cost_structure) {
          state = "custom";
          unitCost = Number(ownStructure.total_unit_cost);
        } else if (g.base) {
          state = "inherit";
          unitCost = Number(g.base.total_unit_cost);
        } else {
          state = "none";
          unitCost = null;
        }
        const parts = [v.color, v.size].filter(Boolean).join(" / ");
        g.variants.push({
          variant: v,
          label: parts ? `${g.name} — ${parts}` : g.name,
          state,
          unitCost,
          structureId: ownStructure?.id ?? g.base?.id ?? null,
        });
      });
    });

    // 4) Orphan variant structures (variant not resolvable) stay as standalone rows
    const attachedStructureIds = new Set<string>();
    map.forEach(g => {
      if (g.base) attachedStructureIds.add(g.base.id);
      g.variants.forEach(vr => { if (vr.structureId) attachedStructureIds.add(vr.structureId); });
    });
    structures.filter(s => s.variant_id && !attachedStructureIds.has(s.id)).forEach(s => {
      ensure(`struct:${s.id}`, s, null);
    });

    return Array.from(map.values()).sort((a, b) => {
      const at = a.base?.updated_at ?? "";
      const bt = b.base?.updated_at ?? "";
      if (at && bt) return bt.localeCompare(at);
      if (at) return -1;
      if (bt) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [structures, products, variants, structureById]);

  const matchedGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(g => {
      const base = g.base;
      if (fStatus !== "all" && (base?.status ?? "") !== fStatus) return false;
      if (fType !== "all" && (g.productType ?? "") !== fType) return false;
      if (fCurrency !== "all" && (base?.base_currency ?? "") !== fCurrency) return false;
      if (fWoo === "connected" && !g.wooProductId) return false;
      if (fWoo === "missing" && g.wooProductId) return false;
      if (!q) return true;
      const parentHit = [
        g.name, base?.sku, g.product?.core_sku, String(g.wooProductId ?? ""),
      ].some(v => (v ?? "").toString().toLowerCase().includes(q));
      const variantHit = g.variants.some(vr => [
        vr.label, vr.variant.variant_sku, vr.variant.color, vr.variant.size,
        String(vr.variant.woo_variation_id ?? ""),
      ].some(v => (v ?? "").toString().toLowerCase().includes(q)));
      return parentHit || variantHit;
    });
  }, [groups, search, fStatus, fType, fCurrency, fWoo]);

  const searchActive = search.trim().length > 0;
  const isExpanded = (g: Group) => {
    if (expanded[g.key] !== undefined) return expanded[g.key];
    if (!searchActive) return false;
    const q = search.trim().toLowerCase();
    return g.variants.some(vr => [
      vr.label, vr.variant.variant_sku, vr.variant.color, vr.variant.size,
      String(vr.variant.woo_variation_id ?? ""),
    ].some(v => (v ?? "").toString().toLowerCase().includes(q)));
  };

  const missingWooCount = useMemo(() => groups.filter(g => !g.wooProductId).length, [groups]);

  async function toggleStatus(s: CostStructure) {
    const newStatus = s.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("core_cost_structures").update({ status: newStatus }).eq("id", s.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_cost_structures", recordId: s.id, action: "update", field: "status", oldValue: s.status, newValue: newStatus });
    toast.success(newStatus === "active" ? "Estructura activada" : "Estructura desactivada");
    load();
  }

  async function duplicate(s: CostStructure) {
    const { data: full, error: e1 } = await supabase.from("core_cost_structures").select("*").eq("id", s.id).maybeSingle();
    if (e1 || !full) return toast.error("No se pudo cargar la estructura");
    const { data: itemsData, error: e2 } = await supabase.from("core_cost_structure_items").select("*").eq("cost_structure_id", s.id);
    if (e2) return toast.error("No se pudieron cargar las líneas");

    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = full as any;
    const { data: newRow, error: e3 } = await supabase
      .from("core_cost_structures")
      .insert({ ...rest, name: `${full.name} (copia)`, status: "draft" })
      .select()
      .single();
    if (e3 || !newRow) return toast.error(e3?.message ?? "No se pudo duplicar");

    if (itemsData && itemsData.length > 0) {
      const newItems = (itemsData as any[]).map(({ id, created_at, updated_at, cost_structure_id, ...r }) => ({
        ...r,
        cost_structure_id: newRow.id,
      }));
      const { error: e4 } = await supabase.from("core_cost_structure_items").insert(newItems);
      if (e4) toast.error("Estructura creada pero hubo error copiando líneas: " + e4.message);
    }
    await logCoreAudit({ table: "core_cost_structures", recordId: newRow.id, action: "duplicate", oldValue: s.id, newValue: newRow.id });
    toast.success("Estructura duplicada");
    load();
  }

  async function handleDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("core_cost_structures").delete().eq("id", toDelete.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_cost_structures", recordId: toDelete.id, action: "delete", field: "record", oldValue: toDelete.name, newValue: null });
    toast.success("Estructura eliminada");
    setToDelete(null);
    load();
  }

  async function revertToBase(vr: VariantRow) {
    const { error } = await supabase.from("core_product_variants").update({
      cost_structure_id: null,
      cost_override_enabled: false,
      uses_parent_cost_structure: true,
    } as any).eq("id", vr.variant.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({
      table: "core_product_variants", recordId: vr.variant.id, action: "variant_cost_reset",
      field: "uses_parent_cost_structure", oldValue: vr.state, newValue: "inherit",
    });
    toast.success("Variante vuelve a heredar la estructura base");
    load();
  }

  const placeholder = () => toast.info("La importación de estructuras de costos se conectará al sistema de Template de Carga materia prima en el siguiente ajuste.");

  const exportStructures = async () => {
    const rows = matchedGroups.map(g => g.base).filter(Boolean) as CostStructure[];
    if (rows.length === 0) return toast.info("No hay estructuras para exportar");
    const variantCountByStructure = new Map<string, number>();
    matchedGroups.forEach(g => { if (g.base) variantCountByStructure.set(g.base.id, g.variants.length); });
    const ids = rows.map(r => r.id);
    const { data: lines, error } = await supabase
      .from("core_cost_structure_items")
      .select("*")
      .in("cost_structure_id", ids);
    if (error) return toast.error("Error cargando líneas: " + error.message);

    const headers = [
      "structure_name","sku","description","product_type","base_currency","status","observations",
      "woo_product_id","woo_variation_id","woo_product_name","variants_count",
      "estimated_sale_price","total_unit_cost","estimated_gross_margin","estimated_gross_margin_percent",
      "raw_material_cost","labor_cost","packaging_cost","logistics_cost","other_cost",
      "items_count","items_detail",
    ];

    const linesByStruct = new Map<string, any[]>();
    (lines ?? []).forEach((l: any) => {
      const arr = linesByStruct.get(l.cost_structure_id) ?? [];
      arr.push(l);
      linesByStruct.set(l.cost_structure_id, arr);
    });

    const round = (n: any, d = 2) => {
      const v = Number(n);
      if (!isFinite(v)) return null;
      const f = Math.pow(10, d);
      return Math.round(v * f) / f;
    };

    const sectionTotal = (arr: any[], sec: string) =>
      arr.filter(l => l.section === sec)
         .reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);
    const otherTotal = (arr: any[]) => {
      const known = new Set(["raw_material","labor","packaging","logistics"]);
      return arr.filter(l => !known.has(l.section))
                .reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);
    };

    const out: any[][] = rows.map(s => {
      const sLines = linesByStruct.get(s.id) ?? [];
      const detail = sLines.map(l => {
        const parts = [
          l.section ?? "",
          l.item_name || l.process_type || l.raw_material_code || "",
          `${round(l.quantity, 4) ?? ""}${l.unit_of_measure ? " " + l.unit_of_measure : ""} × ${round(l.unit_cost, 4) ?? ""}`,
        ].filter(Boolean);
        return parts.join(" | ");
      }).join(" ;; ");
      return [
        s.name, s.sku ?? "", s.description ?? "", s.product_type ?? "", s.base_currency,
        s.status, s.notes ?? "",
        s.woo_product_id ?? "", s.woo_variation_id ?? "", s.woo_product_name ?? "",
        variantCountByStructure.get(s.id) ?? 0,
        round(s.estimated_sale_price), round(s.total_unit_cost),
        round(s.estimated_gross_margin), round(s.estimated_gross_margin_percent, 1),
        round(sectionTotal(sLines, "raw_material")),
        round(sectionTotal(sLines, "labor")),
        round(sectionTotal(sLines, "packaging")),
        round(sectionTotal(sLines, "logistics")),
        round(otherTotal(sLines)),
        sLines.length,
        detail,
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...out]);
    ws["!cols"] = headers.map((h) => {
      if (h === "items_detail") return { wch: 80 };
      if (h === "structure_name" || h === "description" || h === "woo_product_name") return { wch: 32 };
      return { wch: Math.max(12, Math.min(24, h.length + 4)) };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estructuras");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `estructuras-costos-${stamp}.xlsx`);
    toast.success(`Exportadas ${rows.length} estructuras`);
  };

  const downloadBaseFormat = () => {
    const headers = [
      "structure_name","sku","description","product_type","base_currency","estimated_sale_price","status","observations",
      "section","item_name","raw_material_code","process_type","quantity","unit_cost","unit_of_measure","supplier","adds_to_payroll","notes"
    ];
    const example = [
      ["Franela estampada Talla M","FRA-EST-M","Estructura base franela estampada","prenda","USD","18.00","draft","Ejemplo de referencia",
        "raw_material","Tela algodón","MP-TELA-001","","1.5","3.20","metro","Proveedor A","false","Tela principal"],
      ["Franela estampada Talla M","FRA-EST-M","","","","","","",
        "labor","","","Estampado","1","2.50","unidad","","true","Proceso de estampado"],
      ["Franela estampada Talla M","FRA-EST-M","","","","","","",
        "packaging","Bolsa polietileno","","","1","0.15","unidad","Proveedor B","false","Empaque individual"],
      ["Franela estampada Talla M","FRA-EST-M","","","","","","",
        "logistics","Envío al almacén","","","1","0.50","unidad","","false",""],
    ];
    const escape = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v;
    const csv = [headers, ...example].map(r => r.map(c => escape(String(c))).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formato-base-estructuras-costos.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Formato base descargado");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="num text-3xl font-black tracking-tight">Estructuras de Costos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Construcción de costos de fabricación por producto, prenda o template.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadBaseFormat}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Formato base
          </Button>
          <Button variant="outline" size="sm" onClick={placeholder}>
            <Upload className="h-4 w-4 mr-1" />Importar
          </Button>
          <Button variant="outline" size="sm" onClick={exportStructures}>
            <Download className="h-4 w-4 mr-1" />Exportar
          </Button>
          <Button size="sm" onClick={() => navigate("/core/estructuras-costos/nueva")}>
            <Plus className="h-4 w-4 mr-1" />Nueva estructura
          </Button>
        </div>
      </div>

      {missingWooCount > 0 && (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">
                {missingWooCount} {missingWooCount === 1 ? "producto sin conectar" : "productos sin conectar"} a WooCommerce
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Las ventas de productos sin Woo Product ID caerán en "Pendientes" en Partidas de Fabricación y no generarán movimientos hasta resolverse.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setFWoo("missing")}>Ver sin conectar</Button>
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar producto, variante, SKU, talla, color, Woo ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="inactive">Inactivas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fType} onValueChange={setFType}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fCurrency} onValueChange={setFCurrency}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Moneda</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="Bs">Bs</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fWoo} onValueChange={(v) => setFWoo(v as any)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Woo: todas</SelectItem>
              <SelectItem value="connected">Woo: conectadas</SelectItem>
              <SelectItem value="missing">Woo: sin conectar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Woo</TableHead>
                <TableHead className="text-right">Costo total unitario</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Actualización</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
              ) : matchedGroups.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sin estructuras de costos</TableCell></TableRow>
              ) : matchedGroups.map(g => {
                const s = g.base;
                const st = s ? (STATUS_LABELS[s.status] ?? { label: s.status, variant: "outline" as const }) : null;
                const wooConnected = !!g.wooProductId;
                const open = isExpanded(g);
                return (
                  <Fragment key={g.key}>
                    <TableRow className={!wooConnected ? "bg-destructive/5" : ""}>
                      <TableCell className="pr-0">
                        {g.variants.length > 0 ? (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => setExpanded(prev => ({ ...prev, [g.key]: !open }))}
                            title={open ? "Contraer variantes" : "Expandir variantes"}
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{g.name}</span>
                          {g.variants.length > 0 && (
                            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
                              <Layers className="h-3 w-3" />{g.variants.length} variantes
                            </Badge>
                          )}
                          {!s && (
                            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                              Sin estructura base
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{g.productType || "—"}</TableCell>
                      <TableCell>
                        {wooConnected ? (
                          <Badge variant="outline" className="font-mono text-[11px]">#{g.wooProductId}</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />Sin conectar
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {s ? Number(s.total_unit_cost).toFixed(2) : "—"}
                      </TableCell>
                      <TableCell>{s?.base_currency ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {s?.estimated_gross_margin_percent != null
                          ? `${Number(s.estimated_gross_margin_percent).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                      <TableCell>{st ? <Badge variant={st.variant}>{st.label}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s ? formatDMY(s.updated_at) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {s ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => setViewing(s)} title="Ver"><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/core/estructuras-costos/${s.id}`)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => duplicate(s)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => toggleStatus(s)} title={s.status === "active" ? "Desactivar" : "Activar"}>
                                {s.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setToDelete(s)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => navigate("/core/estructuras-costos/nueva")}>
                              <Plus className="h-3.5 w-3.5 mr-1" />Crear base
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {open && g.variants.map(vr => {
                      const meta = VARIANT_STATE_META[vr.state];
                      return (
                        <TableRow key={vr.variant.id} className="bg-muted/30">
                          <TableCell />
                          <TableCell className="pl-8">
                            <div className="text-sm">{vr.label}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {[vr.variant.color, vr.variant.size].filter(Boolean).join(" / ") || "—"}
                              {vr.variant.variant_sku ? ` · ${vr.variant.variant_sku}` : ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{VARIANT_MODE_LABEL[vr.state]}</TableCell>
                          <TableCell>
                            {vr.variant.woo_variation_id ? (
                              <Badge variant="outline" className="font-mono text-[11px]">
                                #{g.wooProductId ?? "?"}·{vr.variant.woo_variation_id}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {vr.unitCost != null ? vr.unitCost.toFixed(2) : (
                              <span className="inline-flex items-center gap-1 text-destructive text-xs">
                                <AlertTriangle className="h-3 w-3" />s/costo
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{g.base?.base_currency ?? "—"}</TableCell>
                          <TableCell />
                          <TableCell>
                            <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost" size="icon"
                                title={vr.state === "custom" ? "Editar costo variante" : "Personalizar costo"}
                                onClick={() => navigate(`/core/estructuras-costos/nueva?variant=${vr.variant.id}`)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {vr.structureId && (
                                <Button
                                  variant="ghost" size="icon" title="Ver estructura asociada"
                                  onClick={() => navigate(`/core/estructuras-costos/${vr.structureId}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              {(vr.state === "custom" || vr.state === "override") && (
                                <Button variant="ghost" size="icon" title="Volver a heredar base" onClick={() => revertToBase(vr)}>
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
            <AlertDialogTitle>¿Eliminar estructura?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{toDelete?.name}</strong> y todas sus líneas de costos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{viewing?.name}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm pt-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span>{viewing?.product_type || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Moneda</span><span>{viewing?.base_currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Costo total unitario</span><span className="tabular-nums">{Number(viewing?.total_unit_cost ?? 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Precio venta estimado</span><span className="tabular-nums">{viewing?.estimated_sale_price != null ? Number(viewing.estimated_sale_price).toFixed(2) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Margen estimado</span><span className="tabular-nums">{viewing?.estimated_gross_margin != null ? Number(viewing.estimated_gross_margin).toFixed(2) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Margen %</span><span className="tabular-nums">{viewing?.estimated_gross_margin_percent != null ? `${Number(viewing.estimated_gross_margin_percent).toFixed(1)}%` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estado</span><span>{viewing && (STATUS_LABELS[viewing.status]?.label ?? viewing.status)}</span></div>
                {viewing?.description && <div className="pt-2 border-t"><span className="text-muted-foreground">Descripción:</span><p className="mt-1">{viewing.description}</p></div>}
                {viewing?.notes && <div className="pt-2 border-t"><span className="text-muted-foreground">Observaciones:</span><p className="mt-1">{viewing.notes}</p></div>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (viewing) navigate(`/core/estructuras-costos/${viewing.id}`); }}>Editar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
