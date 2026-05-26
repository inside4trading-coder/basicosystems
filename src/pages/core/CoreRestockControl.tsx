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

  async function save() {
    if (!form.reference_type) return toast.error("Tipo de referencia obligatorio");
    if (!form.reason) return toast.error("Motivo obligatorio");
    if (!form.status) return toast.error("Estado obligatorio");
    if (!form.start_date) return toast.error("Fecha de inicio obligatoria");
    if (!form.sku && !form.woo_product_id && !form.woo_variation_id && !form.core_product_id && !form.core_variant_id) {
      return toast.error("Debes indicar al menos un SKU o ID de referencia");
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
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Tipo de referencia *</Label>
              <Select value={form.reference_type} onValueChange={v => setForm({ ...form, reference_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REF_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={form.sku ?? ""} onChange={e => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <Label>Nombre del producto</Label>
              <Input value={form.product_name ?? ""} onChange={e => setForm({ ...form, product_name: e.target.value })} />
            </div>
            <div>
              <Label>Talla / Variación</Label>
              <Input value={form.variant_label ?? ""} onChange={e => setForm({ ...form, variant_label: e.target.value })} />
            </div>
            <div>
              <Label>Producto Core asociado</Label>
              <Select value={form.core_product_id ?? "none"} onValueChange={v => setForm({ ...form, core_product_id: v === "none" ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Ninguno —</SelectItem>
                  {coreProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.core_sku} — {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
              <Select value={form.replacement_core_product_id ?? "none"} onValueChange={v => setForm({ ...form, replacement_core_product_id: v === "none" ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Ninguno —</SelectItem>
                  {coreProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.core_sku} — {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SKU reemplazo</Label>
              <Input value={form.replacement_sku ?? ""} onChange={e => setForm({ ...form, replacement_sku: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Observaciones</Label>
              <Textarea value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Guardar cambios" : "Crear regla"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
