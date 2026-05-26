import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Plus, Pencil, Power, PowerOff, Trash2, Search, Ban } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";

type Rule = {
  id: string;
  reference_type: string;
  sku: string | null;
  product_name: string | null;
  variant_label: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  core_product_id: string | null;
  core_variant_id: string | null;
  reason: string;
  custom_reason: string | null;
  status: string;
  start_date: string;
  end_date: string | null;
  replacement_core_product_id: string | null;
  replacement_sku: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const REF_TYPES = [
  { value: "woocommerce_product", label: "Producto WooCommerce" },
  { value: "woocommerce_variation", label: "Variación WooCommerce" },
  { value: "core_product", label: "Producto Core" },
  { value: "core_variant", label: "Variante/Talla Core" },
  { value: "manual_sku", label: "SKU manual" },
];

const REASONS = [
  "Producto descontinuado",
  "Se quiere sacar de circulación",
  "No hay materia prima",
  "Baja rentabilidad",
  "Baja rotación",
  "Problema de calidad",
  "Cambio de colección",
  "Reemplazado por nuevo producto",
  "No fabricable",
  "Otro",
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Activo", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  temporary: { label: "Temporal", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  replaced: { label: "Reemplazado", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  review: { label: "Revisar", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  inactive: { label: "Inactivo", cls: "bg-muted text-muted-foreground border-border" },
};

const TABS = [
  { id: "non_restockable", label: "Productos no restockeables", statuses: ["active", "temporary"] },
  { id: "not_fabricable", label: "No fabricables", statuses: ["active", "temporary"], reasonFilter: "No fabricable" },
  { id: "replaced", label: "Reemplazados", statuses: ["replaced"] },
  { id: "review", label: "En revisión", statuses: ["review"] },
  { id: "all", label: "Todos", statuses: ["active", "temporary", "replaced", "review", "inactive"] },
];

type FormState = Partial<Rule> & { reason: string; status: string; reference_type: string };

const emptyForm = (): FormState => ({
  reference_type: "manual_sku",
  sku: "",
  product_name: "",
  variant_label: "",
  reason: "Producto descontinuado",
  custom_reason: "",
  status: "active",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: null,
  replacement_sku: "",
  notes: "",
});

type WooCand = { id: string; woo_product_id: number; woo_variation_id: number | null; woo_product_name: string | null; woo_sku: string | null; woo_variations: any };
type CoreVariant = { id: string; core_product_id: string; size: string; variant_label: string | null; variant_sku: string | null; woo_variation_id: number | null };

function isFormValid(f: FormState): boolean {
  if (!f.reference_type || !f.reason || !f.status || !f.start_date) return false;
  switch (f.reference_type) {
    case "woocommerce_product": return !!f.woo_product_id && !!f.sku;
    case "woocommerce_variation": return !!f.woo_product_id && !!f.woo_variation_id && !!f.sku;
    case "core_product": return !!f.core_product_id && !!f.sku;
    case "core_variant": return !!f.core_product_id && !!f.core_variant_id && !!f.variant_label;
    case "manual_sku": return !!f.sku;
    default: return false;
  }
}

export default function CoreRestockControl() {
  const [items, setItems] = useState<Rule[]>([]);
  const [coreProducts, setCoreProducts] = useState<{ id: string; core_sku: string; name: string }[]>([]);
  const [coreVariants, setCoreVariants] = useState<CoreVariant[]>([]);
  const [wooCandidates, setWooCandidates] = useState<WooCand[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("non_restockable");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [wooSearch, setWooSearch] = useState("");
  const [coreSearch, setCoreSearch] = useState("");

  async function load() {
    setLoading(true);
    const [{ data: rules }, { data: prods }, { data: variants }, { data: cands }] = await Promise.all([
      supabase.from("core_restock_control").select("*").order("updated_at", { ascending: false }).limit(2000),
      supabase.from("core_products").select("id, core_sku, name").order("core_sku"),
      supabase.from("core_product_variants").select("id, core_product_id, size, variant_label, variant_sku, woo_variation_id").order("sort_order"),
      supabase.from("core_woo_product_candidates").select("id, woo_product_id, woo_variation_id, woo_product_name, woo_sku, woo_variations").limit(3000),
    ]);
    setItems((rules as any) ?? []);
    setCoreProducts((prods as any) ?? []);
    setCoreVariants((variants as any) ?? []);
    setWooCandidates((cands as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const cfg = TABS.find(t => t.id === tab)!;
    return items.filter(r => {
      if (!cfg.statuses.includes(r.status)) return false;
      if (cfg.reasonFilter && r.reason !== cfg.reasonFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(r.sku ?? "").toLowerCase().includes(s) && !(r.product_name ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [items, tab, search]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(r: Rule) {
    setEditing(r);
    setForm({
      reference_type: r.reference_type,
      sku: r.sku ?? "",
      product_name: r.product_name ?? "",
      variant_label: r.variant_label ?? "",
      woo_product_id: r.woo_product_id ?? undefined,
      woo_variation_id: r.woo_variation_id ?? undefined,
      core_product_id: r.core_product_id ?? undefined,
      core_variant_id: r.core_variant_id ?? undefined,
      reason: r.reason,
      custom_reason: r.custom_reason ?? "",
      status: r.status,
      start_date: r.start_date,
      end_date: r.end_date,
      replacement_core_product_id: r.replacement_core_product_id ?? undefined,
      replacement_sku: r.replacement_sku ?? "",
      notes: r.notes ?? "",
    });
    setOpen(true);
  }

  function changeRefType(v: string) {
    setForm(f => ({
      ...f,
      reference_type: v,
      sku: "",
      product_name: "",
      variant_label: "",
      woo_product_id: undefined,
      woo_variation_id: undefined,
      core_product_id: undefined,
      core_variant_id: undefined,
    }));
    setWooSearch("");
    setCoreSearch("");
  }

  function pickWooParent(c: WooCand) {
    setForm(f => ({ ...f, woo_product_id: c.woo_product_id, woo_variation_id: undefined, sku: c.woo_sku ?? "", product_name: c.woo_product_name ?? "", variant_label: "" }));
  }
  function pickWooVariation(parentCand: WooCand, v: any) {
    const attrs = Array.isArray(v?.attributes) ? v.attributes : [];
    const variantLabel = attrs.map((a: any) => a?.option ?? a?.value ?? "").filter(Boolean).join(" / ")
      || v?.name || v?.title || "";
    setForm(f => ({
      ...f,
      woo_product_id: parentCand.woo_product_id,
      woo_variation_id: v?.id ?? v?.variation_id ?? undefined,
      sku: v?.sku ?? parentCand.woo_sku ?? "",
      product_name: parentCand.woo_product_name ?? "",
      variant_label: variantLabel,
    }));
  }
  function pickCoreProduct(p: { id: string; core_sku: string; name: string }) {
    setForm(f => ({ ...f, core_product_id: p.id, core_variant_id: undefined, sku: p.core_sku, product_name: p.name, variant_label: "" }));
  }
  function pickCoreVariant(v: CoreVariant) {
    const parent = coreProducts.find(p => p.id === v.core_product_id);
    setForm(f => ({ ...f, core_product_id: v.core_product_id, core_variant_id: v.id, sku: parent?.core_sku ?? "", product_name: parent?.name ?? "", variant_label: v.variant_label || v.size, woo_variation_id: v.woo_variation_id ?? undefined }));
  }

  async function save() {
    if (!form.reference_type) return toast.error("Tipo de referencia obligatorio");
    if (!form.reason) return toast.error("Motivo obligatorio");
    if (!form.status) return toast.error("Estado obligatorio");
    if (!form.start_date) return toast.error("Fecha de inicio obligatoria");
    switch (form.reference_type) {
      case "woocommerce_product":
        if (!form.woo_product_id) return toast.error("Selecciona el producto WooCommerce");
        if (!form.sku) return toast.error("SKU WooCommerce obligatorio");
        break;
      case "woocommerce_variation":
        if (!form.woo_product_id || !form.woo_variation_id) return toast.error("Selecciona la variación WooCommerce");
        if (!form.sku) return toast.error("SKU de variación obligatorio");
        break;
      case "core_product":
        if (!form.core_product_id) return toast.error("Selecciona el Producto Core");
        if (!form.sku) return toast.error("SKU Core obligatorio");
        break;
      case "core_variant":
        if (!form.core_product_id || !form.core_variant_id) return toast.error("Selecciona la variante Core");
        if (!form.variant_label) return toast.error("Talla / variante obligatoria");
        break;
      case "manual_sku":
        if (!form.sku) return toast.error("SKU obligatorio");
        break;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      reference_type: form.reference_type,
      sku: form.sku || null,
      product_name: form.product_name || null,
      variant_label: form.variant_label || null,
      woo_product_id: form.woo_product_id || null,
      woo_variation_id: form.woo_variation_id || null,
      core_product_id: form.core_product_id || null,
      core_variant_id: form.core_variant_id || null,
      reason: form.reason,
      custom_reason: form.reason === "Otro" ? (form.custom_reason || null) : null,
      status: form.status,
      start_date: form.start_date,
      end_date: form.end_date || null,
      replacement_core_product_id: form.replacement_core_product_id || null,
      replacement_sku: form.replacement_sku || null,
      notes: form.notes || null,
      updated_by: user?.id ?? null,
    };

    if (editing) {
      const { error } = await supabase.from("core_restock_control").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logCoreAudit({
        table: "core_restock_control", recordId: editing.id,
        action: editing.status !== form.status ? "update_restock_control_status" : "update_restock_control_reason",
        oldValue: { status: editing.status, reason: editing.reason },
        newValue: { status: form.status, reason: form.reason },
      });
      toast.success("Regla actualizada");
    } else {
      payload.created_by = user?.id ?? null;
      const { data, error } = await supabase.from("core_restock_control").insert(payload).select().single();
      if (error) return toast.error(error.message);
      await logCoreAudit({
        table: "core_restock_control", recordId: data?.id,
        action: "mark_non_restockable",
        newValue: { sku: form.sku, reason: form.reason, status: form.status },
      });
      // Reflejar en Productos Core si aplica
      if (form.reference_type === "core_product" && form.core_product_id && form.status === "active") {
        await supabase.from("core_products").update({ is_restockable: false }).eq("id", form.core_product_id);
      }
      if (form.reference_type === "core_variant" && form.core_variant_id && form.status === "active") {
        await supabase.from("core_product_variants").update({ status: "inactive" }).eq("id", form.core_variant_id);
      }
      toast.success("Regla creada");
    }
    setOpen(false);
    load();
  }

  async function toggleStatus(r: Rule) {
    const next = r.status === "active" ? "inactive" : "active";
    await supabase.from("core_restock_control").update({ status: next }).eq("id", r.id);
    await logCoreAudit({
      table: "core_restock_control", recordId: r.id,
      action: next === "active" ? "mark_non_restockable" : "reactivate_restockable",
      field: "status", oldValue: r.status, newValue: next,
    });
    if (r.reference_type === "core_product" && r.core_product_id) {
      await supabase.from("core_products").update({ is_restockable: next !== "active" }).eq("id", r.core_product_id);
    }
    toast.success(next === "active" ? "Regla activada" : "Regla desactivada");
    load();
  }

  async function remove(r: Rule) {
    if (!confirm(`¿Eliminar regla para ${r.sku || r.product_name}?`)) return;
    const { error } = await supabase.from("core_restock_control").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({
      table: "core_restock_control", recordId: r.id,
      action: "remove_restock_control_rule", oldValue: { sku: r.sku, status: r.status },
    });
    toast.success("Eliminada");
    load();
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    TABS.forEach(t => {
      c[t.id] = items.filter(r => t.statuses.includes(r.status) && (!t.reasonFilter || r.reason === t.reasonFilter)).length;
    });
    return c;
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Ban className="h-5 w-5 text-destructive" />
            <h1 className="text-2xl font-black tracking-tight">Control de Reposición</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Reglas globales para definir qué productos, SKUs o variaciones no deben restockearse ni producirse automáticamente.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nueva regla</Button>
      </div>

      <Card className="p-4 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            {TABS.map(t => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
                {counts[t.id] > 0 && <Badge variant="secondary" className="ml-2">{counts[t.id]}</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por SKU o nombre" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Talla/Variación</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin reglas en esta vista.</TableCell></TableRow>
              ) : filtered.map(r => {
                const st = STATUS_META[r.status] ?? STATUS_META.inactive;
                const refLabel = REF_TYPES.find(t => t.value === r.reference_type)?.label ?? r.reference_type;
                return (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="outline" className={st.cls}>{st.label}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.sku || "—"}</TableCell>
                    <TableCell className="text-sm">{r.product_name || "—"}</TableCell>
                    <TableCell className="text-xs">{r.variant_label || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{refLabel}</TableCell>
                    <TableCell className="text-xs">{r.reason === "Otro" ? (r.custom_reason || "Otro") : r.reason}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.start_date}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleStatus(r)} title={r.status === "active" ? "Desactivar" : "Activar"}>
                          {r.status === "active" ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar regla" : "Nueva regla de no reposición"}</DialogTitle>
          </DialogHeader>
          {(() => {
            const t = form.reference_type;
            const isWooP = t === "woocommerce_product";
            const isWooV = t === "woocommerce_variation";
            const isCoreP = t === "core_product";
            const isCoreV = t === "core_variant";
            const isManual = t === "manual_sku";
            const wooParents = wooCandidates.filter(c => !c.woo_variation_id);
            const selectedWooParent = wooParents.find(c => c.woo_product_id === form.woo_product_id);
            const parentVariations: any[] = Array.isArray(selectedWooParent?.woo_variations) ? (selectedWooParent!.woo_variations as any[]) : [];
            const variantsForProd = coreVariants.filter(v => !form.core_product_id || v.core_product_id === form.core_product_id);
            const selectedWooVar = parentVariations.find((v: any) => (v?.id ?? v?.variation_id) === form.woo_variation_id);
            const selectedCoreP = coreProducts.find(p => p.id === form.core_product_id);
            const selectedCoreV = coreVariants.find(v => v.id === form.core_variant_id);

            return (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Tipo de referencia *</Label>
                  <Select value={form.reference_type} onValueChange={changeRefType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REF_TYPES.map(rt => <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {(isWooP || isWooV) && (
                  <div className="col-span-2">
                    <Label>Producto WooCommerce *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          {selectedWooParent ? `${selectedWooParent.woo_sku ?? "—"} · ${selectedWooParent.woo_product_name ?? ""}` : "Selecciona un producto…"}
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[480px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar por SKU o nombre…" value={wooSearch} onValueChange={setWooSearch} />
                          <CommandList>
                            <CommandEmpty>Sin resultados.</CommandEmpty>
                            <CommandGroup>
                              {wooParents.slice(0, 200).map(c => (
                                <CommandItem key={c.id} value={`${c.woo_sku ?? ""} ${c.woo_product_name ?? ""}`} onSelect={() => pickWooParent(c)}>
                                  <Check className={`mr-2 h-3.5 w-3.5 ${form.woo_product_id === c.woo_product_id ? "opacity-100" : "opacity-0"}`} />
                                  <span className="font-mono text-xs mr-2">{c.woo_sku ?? "—"}</span>
                                  <span className="truncate">{c.woo_product_name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {isWooV && form.woo_product_id && wooVariations.length === 0 && (
                  <div className="col-span-2">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between gap-3">
                        <span>Este producto no tiene variaciones. Usa "Producto WooCommerce" en lugar de "Variación WooCommerce".</span>
                        <Button size="sm" variant="outline" onClick={() => changeRefType("woocommerce_product")}>
                          Cambiar a producto simple
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
                {isWooV && wooVariations.length > 0 && (
                  <div className="col-span-2">
                    <Label>Variación WooCommerce *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal" disabled={!form.woo_product_id}>
                          {selectedWooVar ? `${selectedWooVar.woo_sku ?? "—"} · ${form.variant_label ?? ""}` : "Selecciona una variación…"}
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[480px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar variación…" />
                          <CommandList>
                            <CommandEmpty>Sin coincidencias.</CommandEmpty>
                            <CommandGroup>
                              {wooVariations.slice(0, 300).map(c => {
                                const label = Array.isArray(c.woo_variations) ? c.woo_variations.map((a: any) => a?.option ?? a?.value ?? "").filter(Boolean).join(" / ") : "";
                                return (
                                  <CommandItem key={c.id} value={`${c.woo_sku ?? ""} ${label}`} onSelect={() => pickWooVariation(c)}>
                                    <Check className={`mr-2 h-3.5 w-3.5 ${form.woo_variation_id === c.woo_variation_id ? "opacity-100" : "opacity-0"}`} />
                                    <span className="font-mono text-xs mr-2">{c.woo_sku ?? "—"}</span>
                                    <span>{label || `#${c.woo_variation_id}`}</span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {(isCoreP || isCoreV) && (
                  <div className="col-span-2">
                    <Label>Producto Core *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          {selectedCoreP ? `${selectedCoreP.core_sku} · ${selectedCoreP.name}` : "Selecciona un producto Core…"}
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[480px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar SKU o nombre…" value={coreSearch} onValueChange={setCoreSearch} />
                          <CommandList>
                            <CommandEmpty>Sin resultados.</CommandEmpty>
                            <CommandGroup>
                              {coreProducts.slice(0, 300).map(p => (
                                <CommandItem key={p.id} value={`${p.core_sku} ${p.name}`} onSelect={() => pickCoreProduct(p)}>
                                  <Check className={`mr-2 h-3.5 w-3.5 ${form.core_product_id === p.id ? "opacity-100" : "opacity-0"}`} />
                                  <span className="font-mono text-xs mr-2">{p.core_sku}</span>
                                  <span className="truncate">{p.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {isCoreV && (
                  <div className="col-span-2">
                    <Label>Variante / Talla Core *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal" disabled={!form.core_product_id}>
                          {selectedCoreV ? `${selectedCoreV.variant_label || selectedCoreV.size}${selectedCoreV.variant_sku ? ` · ${selectedCoreV.variant_sku}` : ""}` : (form.core_product_id ? "Selecciona variante…" : "Selecciona primero el producto Core")}
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[480px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar talla…" />
                          <CommandList>
                            <CommandEmpty>Sin variantes.</CommandEmpty>
                            <CommandGroup>
                              {variantsForProd.map(v => (
                                <CommandItem key={v.id} value={`${v.size} ${v.variant_label ?? ""} ${v.variant_sku ?? ""}`} onSelect={() => pickCoreVariant(v)}>
                                  <Check className={`mr-2 h-3.5 w-3.5 ${form.core_variant_id === v.id ? "opacity-100" : "opacity-0"}`} />
                                  <span className="mr-2">{v.variant_label || v.size}</span>
                                  {v.variant_sku && <span className="font-mono text-xs text-muted-foreground">{v.variant_sku}</span>}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* SKU field — editable in manual, read-only display elsewhere */}
                <div>
                  <Label>SKU{(isWooP || isWooV || isCoreP || isManual) ? " *" : ""}</Label>
                  <Input value={form.sku ?? ""} readOnly={!isManual} onChange={e => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div>
                  <Label>Nombre del producto{isManual ? "" : ""}</Label>
                  <Input value={form.product_name ?? ""} readOnly={!isManual} onChange={e => setForm({ ...form, product_name: e.target.value })} />
                </div>

                {(isWooV || isCoreV || isManual) && (
                  <div className="col-span-2">
                    <Label>Talla / Variación{isCoreV ? " *" : ""}</Label>
                    <Input value={form.variant_label ?? ""} readOnly={!isManual && !isCoreV ? true : false} onChange={e => setForm({ ...form, variant_label: e.target.value })} />
                  </div>
                )}

                {/* Datos técnicos (solo lectura, discretos) */}
                {(form.woo_product_id || form.woo_variation_id || form.core_product_id || form.core_variant_id) && (
                  <div className="col-span-2 text-xs text-muted-foreground border rounded-md p-2 bg-muted/30">
                    <span className="font-semibold mr-2">Datos técnicos:</span>
                    {form.woo_product_id ? <span className="mr-3">Woo product_id: <span className="font-mono">{form.woo_product_id}</span></span> : null}
                    {form.woo_variation_id ? <span className="mr-3">Woo variation_id: <span className="font-mono">{form.woo_variation_id}</span></span> : null}
                    {form.core_product_id ? <span className="mr-3">Core product_id: <span className="font-mono">{String(form.core_product_id).slice(0, 8)}…</span></span> : null}
                    {form.core_variant_id ? <span className="mr-3">Core variant_id: <span className="font-mono">{String(form.core_variant_id).slice(0, 8)}…</span></span> : null}
                  </div>
                )}

                <div>
                  <Label>Motivo *</Label>
                  <Select value={form.reason} onValueChange={v => setForm({ ...form, reason: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado *</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="temporary">Temporal</SelectItem>
                      <SelectItem value="replaced">Reemplazado</SelectItem>
                      <SelectItem value="review">Revisar</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.reason === "Otro" && (
                  <div className="col-span-2">
                    <Label>Motivo personalizado</Label>
                    <Input value={form.custom_reason ?? ""} onChange={e => setForm({ ...form, custom_reason: e.target.value })} />
                  </div>
                )}

                <div>
                  <Label>Fecha de inicio *</Label>
                  <Input type="date" value={form.start_date ?? ""} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>Fecha de fin</Label>
                  <Input type="date" value={form.end_date ?? ""} onChange={e => setForm({ ...form, end_date: e.target.value || null })} />
                </div>

                <div>
                  <Label>Producto reemplazo (Core)</Label>
                  <Select
                    value={form.replacement_core_product_id ?? "none"}
                    onValueChange={v => {
                      if (v === "none") {
                        setForm(f => ({ ...f, replacement_core_product_id: undefined, replacement_sku: "" }));
                      } else {
                        const rp = coreProducts.find(p => p.id === v);
                        setForm(f => ({ ...f, replacement_core_product_id: v, replacement_sku: rp?.core_sku ?? "" }));
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Ninguno —</SelectItem>
                      {coreProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.core_sku} — {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>SKU reemplazo</Label>
                  <Input
                    value={form.replacement_sku ?? ""}
                    readOnly={!!form.replacement_core_product_id}
                    onChange={e => setForm({ ...form, replacement_sku: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Observaciones</Label>
                  <Textarea value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!isFormValid(form)}>{editing ? "Guardar cambios" : "Crear regla"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
