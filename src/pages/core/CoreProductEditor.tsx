import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, RefreshCw, Wand2, Link2 } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";

type Variant = {
  id?: string;
  _local?: string;
  size: string;
  variant_label?: string | null;
  status: string;
  woo_variation_id?: number | null;
  woo_sku?: string | null;
  woo_stock_quantity?: number | null;
  woo_regular_price?: number | null;
  woo_sale_price?: number | null;
  notes?: string | null;
  sort_order?: number;
};

type CostStructure = {
  id: string;
  name: string;
  base_currency: string;
  status: string;
  total_unit_cost: number;
  total_raw_materials: number;
  total_labor: number;
  total_technical_processes: number;
  total_variable_costs: number;
  total_logistics: number;
  total_other_costs: number;
  total_packaging: number;
  suggested_fabrication_fund: number;
};

const PRODUCT_TYPES = ["Franela", "Hoodie", "Jogger", "Cargo", "Short", "Gorra", "Accesorio", "Producto terminado", "Otro"];
const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "discontinued", label: "Descontinuado" },
  { value: "stock_only", label: "Solo venta de stock existente" },
];
const PRIORITY_OPTIONS = [
  { value: "core_essential", label: "Core / Esencial" },
  { value: "regular", label: "Regular" },
  { value: "seasonal", label: "Temporada" },
  { value: "limited_drop", label: "Drop limitado" },
  { value: "test", label: "Prueba" },
  { value: "low", label: "Baja prioridad" },
];
const REPLENISHMENT_OPTIONS = [
  { value: "automatic", label: "Automático" },
  { value: "manual_review", label: "Revisión manual" },
  { value: "do_not_replenish", label: "No reponer" },
];
const SIZE_PRESETS = {
  prendas: ["S", "M", "L", "XL", "XXL"],
  pantalones: ["28", "30", "32", "34", "36", "38"],
};

export default function CoreProductEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [productId, setProductId] = useState<string | null>(id ?? null);
  const [coreSku, setCoreSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState("Franela");
  const [color, setColor] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [commercialStatus, setCommercialStatus] = useState("draft");
  const [isRestockable, setIsRestockable] = useState(true);
  const [productPriority, setProductPriority] = useState("regular");
  const [replenishmentMode, setReplenishmentMode] = useState("manual_review");
  const [costStructureId, setCostStructureId] = useState<string>("");
  const [costSnapshot, setCostSnapshot] = useState<any>(null);
  const [unitCost, setUnitCost] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [estimatedSalePrice, setEstimatedSalePrice] = useState<number | "">("");
  const [suggestedFund, setSuggestedFund] = useState(0);
  const [wooProductId, setWooProductId] = useState<number | "">("");
  const [wooProductName, setWooProductName] = useState("");
  const [wooSku, setWooSku] = useState("");
  const [wooPermalink, setWooPermalink] = useState("");
  const [wooStatus, setWooStatus] = useState("");
  const [wooStockQuantity, setWooStockQuantity] = useState<number | "">("");
  const [wooRegularPrice, setWooRegularPrice] = useState<number | "">("");
  const [wooSalePrice, setWooSalePrice] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const [variants, setVariants] = useState<Variant[]>([]);
  const [structures, setStructures] = useState<CostStructure[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: sts } = await supabase
        .from("core_cost_structures")
        .select("id, name, base_currency, status, total_unit_cost, total_raw_materials, total_labor, total_technical_processes, total_variable_costs, total_logistics, total_other_costs, total_packaging, suggested_fabrication_fund")
        .in("status", ["draft", "active"])
        .order("name");
      setStructures((sts as any) ?? []);

      if (!isNew && id) {
        const [{ data: p }, { data: vs }, { data: snaps }, { data: logs }] = await Promise.all([
          supabase.from("core_products").select("*").eq("id", id).maybeSingle(),
          supabase.from("core_product_variants").select("*").eq("core_product_id", id).order("sort_order"),
          supabase.from("core_product_cost_snapshots").select("*").eq("core_product_id", id).order("created_at", { ascending: false }),
          supabase.from("core_audit_logs").select("*").eq("table_name", "core_products").eq("record_id", id).order("created_at", { ascending: false }).limit(30),
        ]);
        if (!p) { toast.error("Producto no encontrado"); navigate("/core/productos"); return; }
        setProductId(p.id);
        setCoreSku(p.core_sku);
        setName(p.name);
        setDescription(p.description ?? "");
        setProductType(p.product_type ?? "Franela");
        setColor(p.color ?? "");
        setImageUrl(p.image_url ?? "");
        setCommercialStatus(p.commercial_status);
        setIsRestockable(!!p.is_restockable);
        setProductPriority((p as any).product_priority ?? "regular");
        setReplenishmentMode((p as any).replenishment_mode ?? "manual_review");
        setCostStructureId(p.cost_structure_id ?? "");
        setCostSnapshot(p.cost_snapshot);
        setUnitCost(Number(p.unit_cost) || 0);
        setCurrency(p.currency);
        setEstimatedSalePrice(p.estimated_sale_price != null ? Number(p.estimated_sale_price) : "");
        setSuggestedFund(Number(p.suggested_fabrication_fund) || 0);
        setWooProductId(p.woo_product_id ?? "");
        setWooProductName(p.woo_product_name ?? "");
        setWooSku(p.woo_sku ?? "");
        setWooPermalink(p.woo_permalink ?? "");
        setWooStatus(p.woo_status ?? "");
        setWooStockQuantity(p.woo_stock_quantity ?? "");
        setWooRegularPrice(p.woo_regular_price ?? "");
        setWooSalePrice(p.woo_sale_price ?? "");
        setNotes(p.notes ?? "");
        setVariants((vs as any) ?? []);
        setSnapshots((snaps as any) ?? []);
        setAuditLogs((logs as any) ?? []);
        setLoading(false);
      } else {
        await suggestNextSku();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function suggestNextSku() {
    const { data } = await supabase.from("core_settings").select("sku_prefix, sku_digits, sku_last_number").maybeSingle();
    const prefix = data?.sku_prefix ?? "CORE";
    const digits = data?.sku_digits ?? 6;
    const last = data?.sku_last_number ?? 0;
    setCoreSku(`${prefix}${String(last + 1).padStart(digits, "0")}`);
  }

  // Effective price for margin: prefer Woo if connected, else manual
  const effectivePrice = useMemo(() => {
    const woo = typeof wooSalePrice === "number" && wooSalePrice > 0 ? Number(wooSalePrice)
      : typeof wooRegularPrice === "number" && wooRegularPrice > 0 ? Number(wooRegularPrice) : null;
    if (wooProductId && woo != null) return woo;
    return typeof estimatedSalePrice === "number" ? estimatedSalePrice : null;
  }, [wooProductId, wooSalePrice, wooRegularPrice, estimatedSalePrice]);

  const margin = effectivePrice != null ? effectivePrice - unitCost : null;
  const marginPct = effectivePrice != null && effectivePrice > 0 ? ((effectivePrice - unitCost) / effectivePrice) * 100 : null;

  function applyCostStructure(structureId: string) {
    const s = structures.find(x => x.id === structureId);
    if (!s) return;
    if (s.status === "inactive") { toast.error("La estructura está inactiva"); return; }
    setCostStructureId(s.id);
    setCurrency(s.base_currency);
    setUnitCost(Number(s.total_unit_cost) || 0);
    setSuggestedFund(Number(s.suggested_fabrication_fund) || Number(s.total_unit_cost) || 0);
    const snap = {
      cost_structure_id: s.id,
      cost_structure_name: s.name,
      unit_cost: Number(s.total_unit_cost) || 0,
      currency: s.base_currency,
      breakdown: {
        raw_materials: Number(s.total_raw_materials) || 0,
        labor: Number(s.total_labor) || 0,
        technical_processes: Number(s.total_technical_processes) || 0,
        variable_costs: Number(s.total_variable_costs) || 0,
        logistics: Number(s.total_logistics) || 0,
        other_costs: Number(s.total_other_costs) || 0,
        packaging: Number(s.total_packaging) || 0,
      },
      taken_at: new Date().toISOString(),
    };
    setCostSnapshot(snap);
    toast.success(`Costo cargado desde ${s.name}`);
  }

  function addVariant(size = "") {
    setVariants(v => [...v, { _local: crypto.randomUUID(), size, status: "active", sort_order: v.length }]);
  }
  function addPreset(preset: keyof typeof SIZE_PRESETS) {
    SIZE_PRESETS[preset].forEach(s => {
      if (!variants.some(v => v.size === s)) addVariant(s);
    });
  }
  function updateVariant(idx: number, patch: Partial<Variant>) {
    setVariants(v => v.map((x, i) => i === idx ? { ...x, ...patch } : x));
  }
  function removeVariant(idx: number) {
    setVariants(v => v.filter((_, i) => i !== idx));
  }

  const [importingVariants, setImportingVariants] = useState(false);
  async function importVariantsFromWoo() {
    if (!wooProductId) {
      toast.error("Falta woo_product_id en la pestaña Woo / Tracking");
      return;
    }
    setImportingVariants(true);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-import-variants", {
        body: { woo_product_id: Number(wooProductId), apply: false },
      });
      if (error) throw error;
      const incoming: any[] = data?.variants ?? [];
      if (incoming.length === 0) {
        toast.warning("Woo no devolvió variantes utilizables (¿producto simple o sin atributo de talla?)");
        return;
      }
      // Merge: por woo_variation_id, luego por size. No duplicar.
      setVariants(prev => {
        const byVarId = new Map<number, number>();
        const bySize = new Map<string, number>();
        prev.forEach((v, i) => {
          if (v.woo_variation_id) byVarId.set(Number(v.woo_variation_id), i);
          if (v.size) bySize.set(v.size.toUpperCase(), i);
        });
        const next = [...prev];
        for (const v of incoming) {
          const idx = (v.woo_variation_id && byVarId.get(v.woo_variation_id)) ?? bySize.get(String(v.size).toUpperCase()) ?? -1;
          const payload = {
            size: v.size,
            variant_label: v.variant_label,
            status: "active" as const,
            woo_variation_id: v.woo_variation_id,
            woo_sku: v.woo_sku,
            woo_stock_quantity: v.woo_stock_quantity,
            woo_regular_price: v.woo_regular_price,
            woo_sale_price: v.woo_sale_price,
          };
          if (idx >= 0) {
            next[idx] = { ...next[idx], ...payload };
          } else {
            next.push({ _local: crypto.randomUUID(), sort_order: next.length, ...payload });
          }
        }
        return next;
      });
      toast.success(`Importadas ${incoming.length} variantes desde Woo. Guarda para persistir.`);
      if (data?.skipped_missing_size > 0) {
        toast.warning(`${data.skipped_missing_size} variante(s) de Woo omitidas por no tener atributo de talla.`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Error importando variantes");
    } finally {
      setImportingVariants(false);
    }
  }



  async function handleSave() {
    if (!name.trim()) return toast.error("Nombre obligatorio");
    if (!productType) return toast.error("Tipo de producto obligatorio");
    if (!commercialStatus) return toast.error("Estado obligatorio");
    if (unitCost < 0) return toast.error("Costo no puede ser negativo");
    if (typeof estimatedSalePrice === "number" && estimatedSalePrice < 0) return toast.error("Precio no puede ser negativo");

    // duplicate sizes
    const sizes = variants.map(v => v.size.trim()).filter(Boolean);
    if (new Set(sizes).size !== sizes.length) return toast.error("Hay tallas duplicadas");

    // duplicate woo_product_id check
    if (wooProductId && (!productId || true)) {
      const { data: dup } = await supabase.from("core_products").select("id, core_sku, name").eq("woo_product_id", Number(wooProductId)).neq("id", productId ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
      if (dup) {
        const ok = window.confirm(`El producto WooCommerce #${wooProductId} ya está asignado a ${dup.core_sku} — ${dup.name}. ¿Asignarlo igualmente?`);
        if (!ok) return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const computedMargin = effectivePrice != null ? effectivePrice - unitCost : null;
      const computedMarginPct = effectivePrice != null && effectivePrice > 0 ? ((effectivePrice - unitCost) / effectivePrice) * 100 : null;

      const payload: any = {
        name: name.trim(),
        description: description || null,
        product_type: productType,
        color: color || null,
        image_url: imageUrl || null,
        commercial_status: commercialStatus,
        is_restockable: isRestockable,
        product_priority: productPriority,
        replenishment_mode: replenishmentMode,
        cost_structure_id: costStructureId || null,
        cost_snapshot: costSnapshot,
        unit_cost: unitCost,
        currency,
        estimated_sale_price: typeof estimatedSalePrice === "number" ? estimatedSalePrice : null,
        gross_margin: computedMargin,
        gross_margin_percent: computedMarginPct,
        suggested_fabrication_fund: suggestedFund,
        woo_product_id: wooProductId ? Number(wooProductId) : null,
        woo_product_name: wooProductName || null,
        woo_sku: wooSku || null,
        woo_permalink: wooPermalink || null,
        woo_status: wooStatus || null,
        woo_stock_quantity: typeof wooStockQuantity === "number" ? wooStockQuantity : null,
        woo_regular_price: typeof wooRegularPrice === "number" ? wooRegularPrice : null,
        woo_sale_price: typeof wooSalePrice === "number" ? wooSalePrice : null,
        woo_last_sync_at: wooProductId ? new Date().toISOString() : null,
        notes: notes || null,
        updated_by: user?.id ?? null,
      };

      let savedId = productId;
      let assignedSku = coreSku;

      if (isNew) {
        // Allocate next SKU atomically by reading + bumping settings
        const { data: settings } = await supabase.from("core_settings").select("id, sku_prefix, sku_digits, sku_last_number").maybeSingle();
        const prefix = settings?.sku_prefix ?? "CORE";
        const digits = settings?.sku_digits ?? 6;
        const nextNum = (settings?.sku_last_number ?? 0) + 1;
        assignedSku = `${prefix}${String(nextNum).padStart(digits, "0")}`;

        const { data: created, error } = await supabase
          .from("core_products")
          .insert({ ...payload, core_sku: assignedSku, created_by: user?.id ?? null })
          .select()
          .single();
        if (error) throw error;
        savedId = created.id;

        if (settings?.id) {
          await supabase.from("core_settings").update({ sku_last_number: nextNum }).eq("id", settings.id);
        }

        if (costSnapshot && costStructureId) {
          await supabase.from("core_product_cost_snapshots").insert({
            core_product_id: savedId,
            cost_structure_id: costStructureId,
            snapshot_data: costSnapshot,
            unit_cost: unitCost,
            currency,
            created_by: user?.id ?? null,
            notes: "Snapshot inicial al crear el producto",
          });
        }

        await logCoreAudit({ table: "core_products", recordId: savedId, action: "create", newValue: assignedSku });
      } else if (savedId) {
        const { error } = await supabase.from("core_products").update(payload).eq("id", savedId);
        if (error) throw error;
        await logCoreAudit({ table: "core_products", recordId: savedId, action: "update", field: "record", newValue: assignedSku });
      }

      if (!savedId) throw new Error("No id");

      // Save variants: delete-all + insert (simple, atomic-ish)
      await supabase.from("core_product_variants").delete().eq("core_product_id", savedId);
      const cleanVars = variants
        .filter(v => v.size.trim())
        .map((v, i) => ({
          core_product_id: savedId,
          size: v.size.trim(),
          variant_label: v.variant_label || null,
          status: v.status || "active",
          woo_variation_id: v.woo_variation_id || null,
          woo_sku: v.woo_sku || null,
          woo_stock_quantity: v.woo_stock_quantity ?? null,
          woo_regular_price: v.woo_regular_price ?? null,
          woo_sale_price: v.woo_sale_price ?? null,
          notes: v.notes || null,
          sort_order: i,
        }));
      if (cleanVars.length > 0) {
        const { error: ev } = await supabase.from("core_product_variants").insert(cleanVars);
        if (ev) throw ev;
      }

      toast.success(isNew ? `Producto creado: ${assignedSku}` : "Producto guardado");
      navigate(`/core/productos/${savedId}`, { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function refreshSnapshotFromStructure() {
    if (!costStructureId) return toast.error("No hay estructura asociada");
    applyCostStructure(costStructureId);
    if (productId) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("core_product_cost_snapshots").insert({
        core_product_id: productId,
        cost_structure_id: costStructureId,
        snapshot_data: costSnapshot,
        unit_cost: unitCost,
        currency,
        created_by: user?.id ?? null,
        notes: "Actualización manual desde estructura",
      });
      await logCoreAudit({ table: "core_products", recordId: productId, action: "update_cost_snapshot", newValue: costStructureId });
      toast.success("Snapshot de costo actualizado");
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/core/productos")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{isNew ? "Nuevo producto de fabricación" : `${coreSku} — ${name || "Producto"}`}</h1>
            <p className="text-xs text-muted-foreground">{isNew ? `SKU asignado al guardar: ${coreSku}` : `SKU: ${coreSku}`}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Guardando…" : "Guardar"}</Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Resumen</TabsTrigger>
          <TabsTrigger value="variants">Tallas / Variaciones</TabsTrigger>
          <TabsTrigger value="costs">Costos</TabsTrigger>
          <TabsTrigger value="woo">WooCommerce</TabsTrigger>
          {!isNew && <TabsTrigger value="audit">Historial</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>SKU Core</Label>
                <div className="flex gap-2">
                  <Input value={coreSku} readOnly className="font-mono font-semibold bg-muted" />
                  {isNew && <Button variant="outline" size="icon" onClick={suggestNextSku} title="Refrescar"><RefreshCw className="h-4 w-4" /></Button>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Generado automáticamente desde Configuración Core.</p>
              </div>
              <div>
                <Label>Nombre *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Franela Message Never Dies" />
              </div>
              <div>
                <Label>Tipo de producto *</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Color</Label>
                <Input value={color} onChange={e => setColor(e.target.value)} placeholder="Negro" />
              </div>
              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Imagen / referencia (URL)</Label>
                <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <Label>Estado comercial *</Label>
                <Select value={commercialStatus} onValueChange={setCommercialStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad del producto</Label>
                <Select value={productPriority} onValueChange={setProductPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Importancia estratégica. Independiente de si es restockeable.</p>
              </div>
              <div>
                <Label>Modo de reposición</Label>
                <Select value={replenishmentMode} onValueChange={setReplenishmentMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REPLENISHMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Cómo se genera la reposición cuando el producto es restockeable.</p>
              </div>
              <div className="flex items-center gap-3 pt-6 md:col-span-2 border-t pt-4">
                <Switch checked={isRestockable} onCheckedChange={setIsRestockable} id="restock" />
                <div>
                  <Label htmlFor="restock" className="cursor-pointer">Restockeable</Label>
                  <p className="text-xs text-muted-foreground">{isRestockable ? "Puede generar órdenes de producción y restock." : "No genera producción automática. Su venta alimenta partida de no-restockeables."}</p>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Observaciones</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">Resumen económico</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><div className="text-muted-foreground text-xs">Costo unitario</div><div className="text-lg font-bold tabular-nums">{unitCost.toFixed(2)} {currency}</div></div>
              <div><div className="text-muted-foreground text-xs">Precio de venta</div><div className="text-lg font-bold tabular-nums">{effectivePrice != null ? `${effectivePrice.toFixed(2)} ${currency}` : "—"}</div></div>
              <div><div className="text-muted-foreground text-xs">Margen bruto</div><div className="text-lg font-bold tabular-nums">{margin != null ? margin.toFixed(2) : "—"}</div></div>
              <div><div className="text-muted-foreground text-xs">Margen %</div><div className="text-lg font-bold tabular-nums">{marginPct != null ? `${marginPct.toFixed(1)}%` : "—"}</div></div>
              <div className="col-span-2 md:col-span-4 pt-2 border-t"><div className="text-muted-foreground text-xs">Partida de fabricación sugerida</div><div className="text-lg font-bold tabular-nums">{suggestedFund.toFixed(2)} {currency}</div></div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="variants" className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold">Tallas / Variaciones</h3>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => addPreset("prendas")}>Preset prendas</Button>
                <Button variant="outline" size="sm" onClick={() => addPreset("pantalones")}>Preset pantalones</Button>
                <Button size="sm" onClick={() => addVariant()}><Plus className="h-4 w-4 mr-1" />Agregar talla</Button>
              </div>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Talla</TableHead>
                    <TableHead>Etiqueta</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Woo variation_id</TableHead>
                    <TableHead>Woo SKU</TableHead>
                    <TableHead className="text-right">Woo stock</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin tallas — usa un preset o agrega una.</TableCell></TableRow>
                  ) : variants.map((v, i) => (
                    <TableRow key={v.id ?? v._local}>
                      <TableCell><Input value={v.size} onChange={e => updateVariant(i, { size: e.target.value })} className="w-20" /></TableCell>
                      <TableCell><Input value={v.variant_label ?? ""} onChange={e => updateVariant(i, { variant_label: e.target.value })} className="w-32" /></TableCell>
                      <TableCell>
                        <Select value={v.status} onValueChange={val => updateVariant(i, { status: val })}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Activa</SelectItem>
                            <SelectItem value="inactive">Inactiva</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input type="number" value={v.woo_variation_id ?? ""} onChange={e => updateVariant(i, { woo_variation_id: e.target.value ? Number(e.target.value) : null })} className="w-28" /></TableCell>
                      <TableCell><Input value={v.woo_sku ?? ""} onChange={e => updateVariant(i, { woo_sku: e.target.value })} className="w-32" /></TableCell>
                      <TableCell className="text-right"><Input type="number" value={v.woo_stock_quantity ?? ""} onChange={e => updateVariant(i, { woo_stock_quantity: e.target.value ? Number(e.target.value) : null })} className="w-20 text-right" /></TableCell>
                      <TableCell><Input value={v.notes ?? ""} onChange={e => updateVariant(i, { notes: e.target.value })} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => removeVariant(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">Cada producto de fabricación puede tener varias tallas. No se permiten tallas duplicadas dentro del mismo producto.</p>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold">Estructura de costos asociada</h3>
                <p className="text-xs text-muted-foreground">Solo se listan estructuras activas o en borrador.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast.info("Crear producto desde template se conectará en un siguiente ajuste.")}>
                <Wand2 className="h-4 w-4 mr-1" />Desde template
              </Button>
            </div>
            <div className="grid md:grid-cols-[1fr_auto] gap-2">
              <Select value={costStructureId} onValueChange={applyCostStructure}>
                <SelectTrigger><SelectValue placeholder="Selecciona una estructura" /></SelectTrigger>
                <SelectContent>
                  {structures.map(s => <SelectItem key={s.id} value={s.id}>{s.name} · {s.base_currency} {Number(s.total_unit_cost).toFixed(2)}</SelectItem>)}
                </SelectContent>
              </Select>
              {costStructureId && !isNew && (
                <Button variant="outline" onClick={refreshSnapshotFromStructure}><RefreshCw className="h-4 w-4 mr-1" />Actualizar snapshot</Button>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-3 border-t">
              <div>
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="Bs">Bs</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Costo unitario actual</Label>
                <Input type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div>
                <Label>Precio de venta estimado (manual)</Label>
                <Input type="number" min="0" step="0.01" value={estimatedSalePrice} onChange={e => setEstimatedSalePrice(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} />
                <p className="text-xs text-muted-foreground mt-1">Si hay producto WooCommerce conectado, se usa su precio para el margen.</p>
              </div>
              <div>
                <Label>Partida de fabricación sugerida</Label>
                <Input type="number" min="0" step="0.01" value={suggestedFund} onChange={e => setSuggestedFund(Math.max(0, Number(e.target.value) || 0))} />
              </div>
            </div>

            {costSnapshot && (
              <div className="pt-3 border-t">
                <h4 className="text-sm font-semibold mb-2">Desglose del snapshot actual</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {costSnapshot.breakdown && Object.entries(costSnapshot.breakdown).map(([k, v]: any) => (
                    <div key={k} className="bg-muted/40 rounded p-2">
                      <div className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
                      <div className="font-semibold tabular-nums">{Number(v).toFixed(2)} {costSnapshot.currency}</div>
                    </div>
                  ))}
                </div>
                {costSnapshot.taken_at && <p className="text-xs text-muted-foreground mt-2">Snapshot tomado: {new Date(costSnapshot.taken_at).toLocaleString()}</p>}
              </div>
            )}
          </Card>

          {snapshots.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold mb-3">Historial de snapshots</h3>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Fecha</TableHead><TableHead>Estructura</TableHead><TableHead className="text-right">Costo</TableHead><TableHead>Notas</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {snapshots.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">{new Date(s.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-mono">{s.snapshot_data?.cost_structure_name ?? s.cost_structure_id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(s.unit_cost).toFixed(2)} {s.currency}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="woo" className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4" />
              Relación con WooCommerce (solo lectura/asignación — no actualiza Woo).
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>WooCommerce product_id</Label>
                <Input type="number" value={wooProductId} onChange={e => setWooProductId(e.target.value === "" ? "" : Number(e.target.value))} placeholder="1234" />
              </div>
              <div>
                <Label>Nombre WooCommerce</Label>
                <Input value={wooProductName} onChange={e => setWooProductName(e.target.value)} />
              </div>
              <div>
                <Label>SKU WooCommerce</Label>
                <Input value={wooSku} onChange={e => setWooSku(e.target.value)} />
              </div>
              <div>
                <Label>Estado WooCommerce</Label>
                <Input value={wooStatus} onChange={e => setWooStatus(e.target.value)} placeholder="publish, draft, …" />
              </div>
              <div className="md:col-span-2">
                <Label>Permalink</Label>
                <Input value={wooPermalink} onChange={e => setWooPermalink(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <Label>Precio regular</Label>
                <Input type="number" min="0" step="0.01" value={wooRegularPrice} onChange={e => setWooRegularPrice(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} />
              </div>
              <div>
                <Label>Precio oferta</Label>
                <Input type="number" min="0" step="0.01" value={wooSalePrice} onChange={e => setWooSalePrice(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} />
              </div>
              <div>
                <Label>Stock general</Label>
                <Input type="number" value={wooStockQuantity} onChange={e => setWooStockQuantity(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">El mapeo de variaciones (por talla) se gestiona en la pestaña <strong>Tallas / Variaciones</strong>.</p>
          </Card>
        </TabsContent>

        {!isNew && (
          <TabsContent value="audit">
            <Card className="p-5">
              <h3 className="font-semibold mb-3">Historial de cambios</h3>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Fecha</TableHead><TableHead>Acción</TableHead><TableHead>Campo</TableHead><TableHead>Anterior</TableHead><TableHead>Nuevo</TableHead><TableHead>Usuario</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {auditLogs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                        <TableCell className="text-xs">{l.field_changed || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{l.old_value || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate">{l.new_value || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.performed_by || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
