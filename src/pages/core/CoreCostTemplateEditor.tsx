import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Loader2, Search } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";

const PRODUCT_TYPES = ["Franela", "Hoodie", "Jogger", "Cargo", "Short", "Gorra", "Accesorio", "Producto terminado", "Otro"];
const CURRENCIES = ["USD", "Bs", "EUR"];
const STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
];
const LABOR_TYPES = ["Corte", "Costura", "Estampado", "Bordado", "Empaque", "Otro"];

type Section = "raw_material" | "labor" | "technical_process" | "variable_cost" | "logistics" | "packaging" | "other";

type Item = {
  id?: string;
  _local_id: string;
  section: Section;
  item_type?: string | null;
  raw_material_id?: string | null;
  name: string;
  unit_of_measure?: string | null;
  unit_cost: number;
  quantity: number;
  subtotal: number;
  currency: string;
  process_name?: string | null;
  process_order?: number | null;
  adds_to_payroll?: boolean;
  suggested_role?: string | null;
  supplier?: string | null;
  notes?: string | null;
  sort_order: number;
};

type RawMaterial = {
  id: string;
  code: string;
  name: string;
  unit_of_measure_id: string | null;
  unit_cost: number;
  currency: string;
  category_id: string | null;
};

type Unit = { id: string; abbreviation: string; name: string };

function uid() { return Math.random().toString(36).slice(2, 11); }

function makeItem(section: Section, sortOrder: number, currency: string): Item {
  return {
    _local_id: uid(),
    section,
    name: "",
    unit_cost: 0,
    quantity: 1,
    subtotal: 0,
    currency,
    adds_to_payroll: section === "labor",
    sort_order: sortOrder,
  };
}

export default function CoreCostTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "nuevo";
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState("");
  const [productTypeOther, setProductTypeOther] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [units, setUnits] = useState<Record<string, Unit>>({});
  const [packagingCategoryId, setPackagingCategoryId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [rmRes, uomRes, catRes] = await Promise.all([
        supabase.from("core_raw_materials").select("id, code, name, unit_of_measure_id, unit_cost, currency, category_id").eq("status", "active").order("name"),
        supabase.from("core_units_of_measure").select("id, abbreviation, name"),
        supabase.from("core_raw_material_categories").select("id, name"),
      ]);
      setRawMaterials((rmRes.data as any) ?? []);
      const uMap: Record<string, Unit> = {};
      (uomRes.data as any[] ?? []).forEach(u => { uMap[u.id] = u; });
      setUnits(uMap);
      const empaque = (catRes.data as any[] ?? []).find(c => (c.name ?? "").trim().toLowerCase() === "empaque");
      setPackagingCategoryId(empaque?.id ?? null);

      if (!isNew) {
        const { data: head, error } = await supabase.from("core_cost_templates").select("*").eq("id", id!).maybeSingle();
        if (error || !head) {
          toast.error("No se encontró el template");
          navigate("/core/templates-costos");
          return;
        }
        setName(head.name);
        setDescription(head.description ?? "");
        if (head.product_type && !PRODUCT_TYPES.includes(head.product_type)) {
          setProductType("Otro");
          setProductTypeOther(head.product_type);
        } else {
          setProductType(head.product_type ?? "");
        }
        setBaseCurrency(head.base_currency);
        setStatus(head.status);
        setNotes(head.notes ?? "");

        const { data: rows } = await supabase
          .from("core_cost_template_items")
          .select("*")
          .eq("cost_template_id", id!)
          .order("section")
          .order("sort_order");
        setItems((rows as any[] ?? []).map(r => ({ ...r, _local_id: r.id })));
      }
      setLoading(false);
    })();
  }, [id, isNew, navigate]);

  const totals = useMemo(() => {
    const by: Record<Section, number> = {
      raw_material: 0, labor: 0, technical_process: 0, variable_cost: 0, logistics: 0, packaging: 0, other: 0,
    };
    items.forEach(it => { by[it.section] += Number(it.subtotal) || 0; });
    const total = Object.values(by).reduce((a, b) => a + b, 0);
    return { by, total };
  }, [items]);

  function updateItem(localId: string, patch: Partial<Item>) {
    setItems(prev => prev.map(it => {
      if (it._local_id !== localId) return it;
      const merged = { ...it, ...patch };
      merged.subtotal = Number(((Number(merged.unit_cost) || 0) * (Number(merged.quantity) || 0)).toFixed(4));
      return merged;
    }));
  }

  function addItem(section: Section) {
    const sortOrder = items.filter(i => i.section === section).length;
    setItems(prev => [...prev, makeItem(section, sortOrder, baseCurrency)]);
  }

  function removeItem(localId: string) {
    setItems(prev => prev.filter(it => it._local_id !== localId));
  }

  function pickRawMaterial(localId: string, rmId: string) {
    const rm = rawMaterials.find(r => r.id === rmId);
    if (!rm) return;
    const unitAbbr = rm.unit_of_measure_id ? units[rm.unit_of_measure_id]?.abbreviation : "";
    updateItem(localId, {
      raw_material_id: rm.id,
      name: `${rm.code} — ${rm.name}`,
      unit_of_measure: unitAbbr ?? null,
      unit_cost: Number(rm.unit_cost),
      currency: rm.currency,
    });
  }

  function validate(): string | null {
    if (!name.trim()) return "El nombre es obligatorio";
    const ptValue = productType === "Otro" ? productTypeOther.trim() : productType;
    if (!ptValue) return "El tipo de producto es obligatorio";
    if (!baseCurrency) return "La moneda base es obligatoria";
    if (!status) return "El estado es obligatorio";
    for (const it of items) {
      if ((Number(it.unit_cost) || 0) < 0) return `Costo negativo en línea "${it.name || it.section}"`;
      if ((Number(it.quantity) || 0) < 0) return `Cantidad negativa en línea "${it.name || it.section}"`;
      if (it.section === "labor") {
        if (!it.item_type) return "Selecciona un tipo de proceso en cada línea de mano de obra";
      } else if (!it.name?.trim()) {
        return `Falta nombre en una línea de ${sectionLabel(it.section)}`;
      }
    }
    if (status === "active" && items.length === 0) {
      return "Para activar el template debe tener al menos una línea de costo";
    }
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ptValue = productType === "Otro" ? (productTypeOther.trim() || "Otro") : productType;
      const head: any = {
        name: name.trim(),
        description: description.trim() || null,
        product_type: ptValue,
        base_currency: baseCurrency,
        status,
        notes: notes.trim() || null,
        total_raw_materials: totals.by.raw_material,
        total_labor: totals.by.labor,
        total_technical_processes: totals.by.technical_process,
        total_variable_costs: totals.by.variable_cost,
        total_logistics: totals.by.logistics,
        total_packaging: totals.by.packaging,
        total_other_costs: totals.by.other,
        total_estimated_cost: totals.total,
        updated_by: user?.id ?? null,
      };

      let tplId = id!;
      if (isNew) {
        const { data, error } = await supabase
          .from("core_cost_templates")
          .insert({ ...head, created_by: user?.id ?? null })
          .select()
          .single();
        if (error || !data) throw error ?? new Error("No se pudo crear");
        tplId = data.id;
        await logCoreAudit({ table: "core_cost_templates", recordId: tplId, action: "create", field: "record", newValue: name });
      } else {
        const { error } = await supabase.from("core_cost_templates").update(head).eq("id", tplId);
        if (error) throw error;
        await logCoreAudit({ table: "core_cost_templates", recordId: tplId, action: "update", field: "record", newValue: name });
      }

      const { error: delErr } = await supabase.from("core_cost_template_items").delete().eq("cost_template_id", tplId);
      if (delErr) throw delErr;

      if (items.length > 0) {
        const payload = items.map((it, idx) => ({
          cost_template_id: tplId,
          section: it.section,
          item_type: it.item_type ?? null,
          raw_material_id: it.raw_material_id ?? null,
          name: it.name,
          unit_of_measure: it.unit_of_measure ?? null,
          unit_cost: Number(it.unit_cost) || 0,
          quantity: Number(it.quantity) || 0,
          subtotal: Number(it.subtotal) || 0,
          currency: it.currency || baseCurrency,
          process_name: it.process_name ?? null,
          process_order: it.process_order ?? null,
          adds_to_payroll: !!it.adds_to_payroll,
          suggested_role: it.suggested_role ?? null,
          supplier: it.supplier ?? null,
          notes: it.notes ?? null,
          sort_order: idx,
        }));
        const { error: insErr } = await supabase.from("core_cost_template_items").insert(payload);
        if (insErr) throw insErr;
      }
      await logCoreAudit({ table: "core_cost_template_items", recordId: tplId, action: "replace_items", newValue: String(items.length) });
      toast.success(isNew ? "Template creado" : "Template actualizado");
      navigate(`/core/templates-costos/${tplId}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Cargando…</div>;
  }

  const fmt = (n: number | null | undefined) => n == null ? "—" : Number(n).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/core/templates-costos")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{isNew ? "Nuevo template" : name || "Editar template"}</h1>
            <p className="text-xs text-muted-foreground">Constructor de template reutilizable de costos / producción.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Guardar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Información general</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Franela estampada base" />
              </div>
              <div>
                <Label>Tipo de producto *</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {productType === "Otro" && (
                  <Input className="mt-2" placeholder="Especificar tipo" value={productTypeOther} onChange={(e) => setProductTypeOther(e.target.value)} />
                )}
              </div>
              <div>
                <Label>Moneda base *</Label>
                <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado *</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="md:col-span-2">
                <Label>Observaciones</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <Tabs defaultValue="raw_material">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="raw_material">Materia prima</TabsTrigger>
                <TabsTrigger value="labor">Mano de obra</TabsTrigger>
                <TabsTrigger value="technical_process">Procesos técnicos</TabsTrigger>
                <TabsTrigger value="variable_cost">Variables</TabsTrigger>
                <TabsTrigger value="logistics">Logística</TabsTrigger>
                <TabsTrigger value="packaging">Empaque</TabsTrigger>
                <TabsTrigger value="other">Otros</TabsTrigger>
              </TabsList>

              <TabsContent value="raw_material" className="mt-4">
                <RawMaterialBlock
                  items={items.filter(i => i.section === "raw_material")}
                  rawMaterials={rawMaterials}
                  onAdd={() => addItem("raw_material")}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  onPickRM={pickRawMaterial}
                />
              </TabsContent>
              <TabsContent value="labor" className="mt-4">
                <LaborBlock
                  items={items.filter(i => i.section === "labor")}
                  onAdd={() => addItem("labor")}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                />
              </TabsContent>
              <TabsContent value="technical_process" className="mt-4">
                <GenericBlock items={items.filter(i => i.section === "technical_process")} onAdd={() => addItem("technical_process")} onUpdate={updateItem} onRemove={removeItem} extraField="supplier" extraLabel="Proveedor" />
              </TabsContent>
              <TabsContent value="variable_cost" className="mt-4">
                <GenericBlock items={items.filter(i => i.section === "variable_cost")} onAdd={() => addItem("variable_cost")} onUpdate={updateItem} onRemove={removeItem} />
              </TabsContent>
              <TabsContent value="logistics" className="mt-4">
                <GenericBlock items={items.filter(i => i.section === "logistics")} onAdd={() => addItem("logistics")} onUpdate={updateItem} onRemove={removeItem} />
              </TabsContent>
              <TabsContent value="packaging" className="mt-4">
                <RawMaterialBlock
                  items={items.filter(i => i.section === "packaging")}
                  rawMaterials={packagingCategoryId ? rawMaterials.filter(r => r.category_id === packagingCategoryId) : rawMaterials}
                  onAdd={() => addItem("packaging")}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  onPickRM={pickRawMaterial}
                  emptyLabel="Sin líneas de empaque"
                  pickerPlaceholder="Seleccionar item de empaque"
                />
              </TabsContent>
              <TabsContent value="other" className="mt-4">
                <GenericBlock items={items.filter(i => i.section === "other")} onAdd={() => addItem("other")} onUpdate={updateItem} onRemove={removeItem} extraField="item_type" extraLabel="Categoría" />
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Resumen estimado</h2>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Materia prima" value={fmt(totals.by.raw_material)} currency={baseCurrency} />
              <SummaryRow label="Mano de obra" value={fmt(totals.by.labor)} currency={baseCurrency} />
              <SummaryRow label="Procesos técnicos" value={fmt(totals.by.technical_process)} currency={baseCurrency} />
              <SummaryRow label="Variables" value={fmt(totals.by.variable_cost)} currency={baseCurrency} />
              <SummaryRow label="Logística" value={fmt(totals.by.logistics)} currency={baseCurrency} />
              <SummaryRow label="Otros" value={fmt(totals.by.other)} currency={baseCurrency} />
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between items-baseline">
                <span className="font-bold">Costo total estimado</span>
                <span className="text-lg font-black tabular-nums">{fmt(totals.total)} {baseCurrency}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Este costo es orientativo. Al crear una estructura desde este template se tomarán los costos actuales de materia prima y se guardará snapshot.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, currency }: { label: string; value: string; currency: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value} <span className="text-xs text-muted-foreground">{currency}</span></span>
    </div>
  );
}

function sectionLabel(s: Section): string {
  return ({
    raw_material: "Materia prima",
    labor: "Mano de obra",
    technical_process: "Procesos técnicos",
    variable_cost: "Variables",
    logistics: "Logística",
    other: "Otros",
  } as Record<Section, string>)[s];
}

function RawMaterialBlock({ items, rawMaterials, onAdd, onUpdate, onRemove, onPickRM }: {
  items: Item[]; rawMaterials: RawMaterial[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onRemove: (id: string) => void;
  onPickRM: (id: string, rmId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 && <EmptyState label="Sin líneas de materia prima" />}
      {items.map(it => (
        <div key={it._local_id} className="rounded-lg border p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Materia prima</Label>
              <RawMaterialPicker
                rawMaterials={rawMaterials}
                value={it.raw_material_id ?? ""}
                onChange={(v) => onPickRM(it._local_id, v)}
              />
            </div>
            <div>
              <Label className="text-xs">Unidad</Label>
              <Input value={it.unit_of_measure ?? ""} readOnly className="bg-muted/30" />
            </div>
            <div>
              <Label className="text-xs">Costo unitario actual</Label>
              <Input type="number" step="0.0001" min="0" value={it.unit_cost} onChange={(e) => onUpdate(it._local_id, { unit_cost: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs">Cantidad sugerida</Label>
              <Input type="number" step="0.0001" min="0" value={it.quantity} onChange={(e) => onUpdate(it._local_id, { quantity: parseFloat(e.target.value) || 0 })} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => onRemove(it._local_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center text-sm">
            <Input placeholder="Notas (opcional)" value={it.notes ?? ""} onChange={(e) => onUpdate(it._local_id, { notes: e.target.value })} />
            <div className="text-right tabular-nums font-medium px-3">
              Subtotal: {it.subtotal.toFixed(2)} {it.currency}
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Agregar materia prima</Button>
    </div>
  );
}

function LaborBlock({ items, onAdd, onUpdate, onRemove }: {
  items: Item[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 && <EmptyState label="Sin procesos de mano de obra" />}
      {items.map(it => (
        <div key={it._local_id} className="rounded-lg border p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Tipo de proceso</Label>
              <Select value={it.item_type ?? ""} onValueChange={(v) => onUpdate(it._local_id, { item_type: v, name: v, process_name: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {LABOR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tarifa sugerida</Label>
              <Input type="number" step="0.0001" min="0" value={it.unit_cost} onChange={(e) => onUpdate(it._local_id, { unit_cost: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs">Cantidad</Label>
              <Input type="number" step="0.0001" min="0" value={it.quantity} onChange={(e) => onUpdate(it._local_id, { quantity: parseFloat(e.target.value) || 0 })} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => onRemove(it._local_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm whitespace-nowrap">
              <Switch checked={!!it.adds_to_payroll} onCheckedChange={(v) => onUpdate(it._local_id, { adds_to_payroll: v })} />
              Suma a nómina
            </label>
            <div className="text-right tabular-nums font-medium px-3">
              {it.subtotal.toFixed(2)} {it.currency}
            </div>
          </div>
          <Input placeholder="Notas (opcional)" value={it.notes ?? ""} onChange={(e) => onUpdate(it._local_id, { notes: e.target.value })} />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Agregar proceso</Button>
    </div>
  );
}

function GenericBlock({ items, onAdd, onUpdate, onRemove, extraField, extraLabel }: {
  items: Item[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onRemove: (id: string) => void;
  extraField?: "supplier" | "item_type";
  extraLabel?: string;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 && <EmptyState label="Sin líneas" />}
      {items.map(it => (
        <div key={it._local_id} className="rounded-lg border p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input value={it.name} onChange={(e) => onUpdate(it._local_id, { name: e.target.value })} />
            </div>
            {extraField ? (
              <div>
                <Label className="text-xs">{extraLabel}</Label>
                <Input value={(it[extraField] as string) ?? ""} onChange={(e) => onUpdate(it._local_id, { [extraField]: e.target.value } as any)} />
              </div>
            ) : <div />}
            <div>
              <Label className="text-xs">Costo unitario</Label>
              <Input type="number" step="0.0001" min="0" value={it.unit_cost} onChange={(e) => onUpdate(it._local_id, { unit_cost: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs">Cantidad</Label>
              <Input type="number" step="0.0001" min="0" value={it.quantity} onChange={(e) => onUpdate(it._local_id, { quantity: parseFloat(e.target.value) || 0 })} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => onRemove(it._local_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <Input placeholder="Notas (opcional)" value={it.notes ?? ""} onChange={(e) => onUpdate(it._local_id, { notes: e.target.value })} />
            <div className="text-right tabular-nums font-medium px-3">
              Subtotal: {it.subtotal.toFixed(2)} {it.currency}
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Agregar línea</Button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-lg">{label}</div>;
}

function RawMaterialPicker({
  rawMaterials, value, onChange,
}: {
  rawMaterials: RawMaterial[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = rawMaterials.find(rm => rm.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
        >
          <span className="truncate">
            {selected ? `${selected.code} — ${selected.name}` : "Seleccionar materia prima"}
          </span>
          <Search className="h-4 w-4 ml-2 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
        <Command
          filter={(val, search) => {
            const q = search.toLowerCase().trim();
            if (!q) return 1;
            return val.toLowerCase().includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por código o nombre…" />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {rawMaterials.map(rm => (
                <CommandItem
                  key={rm.id}
                  value={`${rm.code} ${rm.name}`}
                  onSelect={() => { onChange(rm.id); setOpen(false); }}
                >
                  <span className="font-mono text-xs text-muted-foreground mr-2">{rm.code}</span>
                  <span className="truncate">{rm.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
