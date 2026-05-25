import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, Search, Download, Upload, Power, PowerOff } from "lucide-react";

type Category = { id: string; name: string; status: string };
type Unit = { id: string; name: string; abbreviation: string; status: string };
type RawMaterial = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  unit_of_measure_id: string | null;
  unit_cost: number;
  currency: string;
  supplier: string | null;
  status: string;
  notes: string | null;
  updated_at: string;
};

const CURRENCIES = ["USD", "Bs", "EUR"];

async function logAudit(action: string, recordId: string | null, field?: string, oldVal?: any, newVal?: any) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("core_audit_logs").insert({
    table_name: "core_raw_materials",
    record_id: recordId,
    action,
    field_changed: field ?? null,
    old_value: oldVal != null ? String(oldVal) : null,
    new_value: newVal != null ? String(newVal) : null,
    performed_by: user?.email ?? user?.id ?? "system",
  });
}

export default function CoreRawMaterials() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("materias");
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fCurrency, setFCurrency] = useState("all");
  const [sortBy, setSortBy] = useState("updated_at");

  // dialogs
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [viewing, setViewing] = useState<RawMaterial | null>(null);
  const [toDelete, setToDelete] = useState<RawMaterial | null>(null);

  async function load() {
    setLoading(true);
    const [m, c, u] = await Promise.all([
      supabase.from("core_raw_materials").select("*").order("updated_at", { ascending: false }),
      supabase.from("core_raw_material_categories").select("*").order("name"),
      supabase.from("core_units_of_measure").select("*").order("name"),
    ]);
    if (m.error) toast.error("Error cargando materias primas");
    setMaterials((m.data as any) ?? []);
    setCategories((c.data as any) ?? []);
    setUnits((u.data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories]);
  const unitMap = useMemo(() => Object.fromEntries(units.map(u => [u.id, u])), [units]);

  const filtered = useMemo(() => {
    let list = materials.filter(m => {
      if (search) {
        const s = search.toLowerCase();
        if (!m.code.toLowerCase().includes(s) && !m.name.toLowerCase().includes(s)) return false;
      }
      if (fCategory !== "all" && m.category_id !== fCategory) return false;
      if (fStatus !== "all" && m.status !== fStatus) return false;
      if (fCurrency !== "all" && m.currency !== fCurrency) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "unit_cost") return Number(b.unit_cost) - Number(a.unit_cost);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return list;
  }, [materials, search, fCategory, fStatus, fCurrency, sortBy]);

  async function toggleStatus(m: RawMaterial) {
    const newStatus = m.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("core_raw_materials").update({ status: newStatus }).eq("id", m.id);
    if (error) return toast.error(error.message);
    await logAudit("update", m.id, "status", m.status, newStatus);
    toast.success(newStatus === "active" ? "Activada" : "Desactivada");
    load();
  }

  async function handleDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("core_raw_materials").delete().eq("id", toDelete.id);
    if (error) return toast.error(error.message);
    await logAudit("delete", toDelete.id, "record", toDelete.code, null);
    toast.success("Materia prima eliminada");
    setToDelete(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Materia Prima</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo de insumos y costos base para producción.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="materias">Materias primas</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="unidades">Unidades de medida</TabsTrigger>
        </TabsList>

        <TabsContent value="materias" className="space-y-4 mt-4">
          <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative min-w-[220px] flex-1 max-w-sm">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por código o nombre"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={fCategory} onValueChange={setFCategory}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={fCurrency} onValueChange={setFCurrency}>
                  <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Moneda</SelectItem>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated_at">Última actualización</SelectItem>
                    <SelectItem value="name">Nombre</SelectItem>
                    <SelectItem value="unit_cost">Costo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toast.info("La carga masiva configurable se activará en el bloque Templates de Carga.")}>
                  <Upload className="h-4 w-4 mr-1" />Importar
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast.info("La carga masiva configurable se activará en el bloque Templates de Carga.")}>
                  <Download className="h-4 w-4 mr-1" />Exportar
                </Button>
                <Button size="sm" onClick={() => { setEditing(null); setOpenForm(true); }}>
                  <Plus className="h-4 w-4 mr-1" />Nueva materia prima
                </Button>
              </div>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actualización</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
                  ) : filtered.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.code}</TableCell>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.category_id ? catMap[m.category_id]?.name : "—"}</TableCell>
                      <TableCell>{m.unit_of_measure_id ? unitMap[m.unit_of_measure_id]?.abbreviation : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(m.unit_cost).toFixed(2)}</TableCell>
                      <TableCell>{m.currency}</TableCell>
                      <TableCell className="text-muted-foreground">{m.supplier || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === "active" ? "default" : "secondary"}>
                          {m.status === "active" ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(m.updated_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setViewing(m)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setOpenForm(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleStatus(m)}>
                            {m.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="categorias" className="mt-4">
          <CategoriesPanel categories={categories} reload={load} usedIds={new Set(materials.map(m => m.category_id).filter(Boolean) as string[])} />
        </TabsContent>

        <TabsContent value="unidades" className="mt-4">
          <UnitsPanel units={units} reload={load} usedIds={new Set(materials.map(m => m.unit_of_measure_id).filter(Boolean) as string[])} />
        </TabsContent>
      </Tabs>

      {openForm && (
        <RawMaterialForm
          open={openForm}
          onOpenChange={setOpenForm}
          editing={editing}
          categories={categories.filter(c => c.status === "active" || c.id === editing?.category_id)}
          units={units.filter(u => u.status === "active" || u.id === editing?.unit_of_measure_id)}
          existingCodes={new Set(materials.filter(m => m.id !== editing?.id).map(m => m.code))}
          onSaved={load}
        />
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de materia prima</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <Row label="Código" value={viewing.code} />
              <Row label="Nombre" value={viewing.name} />
              <Row label="Categoría" value={viewing.category_id ? catMap[viewing.category_id]?.name : "—"} />
              <Row label="Unidad" value={viewing.unit_of_measure_id ? `${unitMap[viewing.unit_of_measure_id]?.name} (${unitMap[viewing.unit_of_measure_id]?.abbreviation})` : "—"} />
              <Row label="Costo unitario" value={`${Number(viewing.unit_cost).toFixed(2)} ${viewing.currency}`} />
              <Row label="Proveedor" value={viewing.supplier || "—"} />
              <Row label="Estado" value={viewing.status === "active" ? "Activo" : "Inactivo"} />
              <Row label="Observaciones" value={viewing.notes || "—"} />
              <Row label="Actualizado" value={new Date(viewing.updated_at).toLocaleString()} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar materia prima?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{toDelete?.code} — {toDelete?.name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function RawMaterialForm({
  open, onOpenChange, editing, categories, units, existingCodes, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: RawMaterial | null;
  categories: Category[];
  units: Unit[];
  existingCodes: Set<string>;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(editing?.code ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [unitId, setUnitId] = useState(editing?.unit_of_measure_id ?? "");
  const [unitCost, setUnitCost] = useState(editing ? String(editing.unit_cost) : "");
  const [currency, setCurrency] = useState(editing?.currency ?? "USD");
  const [supplier, setSupplier] = useState(editing?.supplier ?? "");
  const [status, setStatus] = useState(editing?.status ?? "active");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const codeTrim = code.trim();
    if (!codeTrim) return toast.error("El código es obligatorio");
    if (existingCodes.has(codeTrim)) return toast.error("Este código ya existe en Materia Prima.");
    if (!name.trim()) return toast.error("El nombre es obligatorio");
    if (!categoryId) return toast.error("La categoría es obligatoria");
    if (!unitId) return toast.error("La unidad de medida es obligatoria");
    const cost = parseFloat(unitCost);
    if (Number.isNaN(cost)) return toast.error("Costo unitario inválido");
    if (cost < 0) return toast.error("El costo no puede ser negativo");
    if (!currency) return toast.error("La moneda es obligatoria");
    if (!status) return toast.error("El estado es obligatorio");

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      code: codeTrim,
      name: name.trim(),
      category_id: categoryId,
      unit_of_measure_id: unitId,
      unit_cost: cost,
      currency,
      supplier: supplier.trim() || null,
      status,
      notes: notes.trim() || null,
      updated_by: user?.id ?? null,
    };

    if (editing) {
      const { error } = await supabase.from("core_raw_materials").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      // audit per changed field
      const fields: (keyof typeof payload)[] = ["code", "name", "category_id", "unit_of_measure_id", "unit_cost", "currency", "status"];
      for (const f of fields) {
        const oldVal = (editing as any)[f];
        const newVal = (payload as any)[f];
        if (String(oldVal ?? "") !== String(newVal ?? "")) {
          await logAudit("update", editing.id, f as string, oldVal, newVal);
        }
      }
      toast.success("Materia prima actualizada");
    } else {
      const { data, error } = await supabase.from("core_raw_materials")
        .insert({ ...payload, created_by: user?.id ?? null })
        .select().single();
      setSaving(false);
      if (error) return toast.error(error.message);
      await logAudit("create", data.id, "record", null, codeTrim);
      toast.success("Materia prima creada");
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar materia prima" : "Nueva materia prima"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Código *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: 1, 100, 10001" />
            <p className="text-[11px] text-muted-foreground">Manual. Sin prefijos automáticos.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Algodón negro 20/1" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoría *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Unidad de medida *</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Costo unitario *</Label>
            <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Moneda *</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Proveedor</Label>
            <Input value={supplier ?? ""} onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Estado *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Observaciones</Label>
            <Textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesPanel({ categories, reload, usedIds }: { categories: Category[]; reload: () => void; usedIds: Set<string> }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");

  function openNew() { setEditing(null); setName(""); setStatus("active"); setOpen(true); }
  function openEdit(c: Category) { setEditing(c); setName(c.name); setStatus(c.status); setOpen(true); }

  async function save() {
    if (!name.trim()) return toast.error("Nombre obligatorio");
    const { data: { user } } = await supabase.auth.getUser();
    if (editing) {
      const { error } = await supabase.from("core_raw_material_categories")
        .update({ name: name.trim(), status, updated_by: user?.id ?? null }).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await supabase.from("core_audit_logs").insert({
        table_name: "core_raw_material_categories", record_id: editing.id, action: "update",
        field_changed: "category", old_value: editing.name, new_value: name.trim(),
        performed_by: user?.email ?? user?.id ?? "system",
      });
      toast.success("Categoría actualizada");
    } else {
      const { data, error } = await supabase.from("core_raw_material_categories")
        .insert({ name: name.trim(), status, created_by: user?.id ?? null }).select().single();
      if (error) return toast.error(error.message);
      await supabase.from("core_audit_logs").insert({
        table_name: "core_raw_material_categories", record_id: data.id, action: "create",
        field_changed: "category", new_value: name.trim(),
        performed_by: user?.email ?? user?.id ?? "system",
      });
      toast.success("Categoría creada");
    }
    setOpen(false);
    reload();
  }

  async function toggle(c: Category) {
    const newStatus = c.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("core_raw_material_categories").update({ status: newStatus }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(newStatus === "active" ? "Activada" : "Desactivada");
    reload();
  }

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-bold">Categorías de materia prima</h2>
          <p className="text-xs text-muted-foreground">No se pueden eliminar categorías en uso.</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nueva categoría</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Estado</TableHead><TableHead>En uso</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
        <TableBody>
          {categories.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status === "active" ? "Activa" : "Inactiva"}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">{usedIds.has(c.id) ? "Sí" : "No"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => toggle(c)}>
                  {c.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar categoría" : "Nueva categoría"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div>
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activa</SelectItem>
                  <SelectItem value="inactive">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UnitsPanel({ units, reload, usedIds }: { units: Unit[]; reload: () => void; usedIds: Set<string> }) {
  const [editing, setEditing] = useState<Unit | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [abbr, setAbbr] = useState("");
  const [status, setStatus] = useState("active");

  function openNew() { setEditing(null); setName(""); setAbbr(""); setStatus("active"); setOpen(true); }
  function openEdit(u: Unit) { setEditing(u); setName(u.name); setAbbr(u.abbreviation); setStatus(u.status); setOpen(true); }

  async function save() {
    if (!name.trim() || !abbr.trim()) return toast.error("Nombre y abreviatura obligatorios");
    const { data: { user } } = await supabase.auth.getUser();
    if (editing) {
      const { error } = await supabase.from("core_units_of_measure")
        .update({ name: name.trim(), abbreviation: abbr.trim(), status, updated_by: user?.id ?? null }).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await supabase.from("core_audit_logs").insert({
        table_name: "core_units_of_measure", record_id: editing.id, action: "update",
        field_changed: "unit", old_value: `${editing.name} (${editing.abbreviation})`, new_value: `${name.trim()} (${abbr.trim()})`,
        performed_by: user?.email ?? user?.id ?? "system",
      });
      toast.success("Unidad actualizada");
    } else {
      const { data, error } = await supabase.from("core_units_of_measure")
        .insert({ name: name.trim(), abbreviation: abbr.trim(), status, created_by: user?.id ?? null }).select().single();
      if (error) return toast.error(error.message);
      await supabase.from("core_audit_logs").insert({
        table_name: "core_units_of_measure", record_id: data.id, action: "create",
        field_changed: "unit", new_value: `${name.trim()} (${abbr.trim()})`,
        performed_by: user?.email ?? user?.id ?? "system",
      });
      toast.success("Unidad creada");
    }
    setOpen(false);
    reload();
  }

  async function toggle(u: Unit) {
    const newStatus = u.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("core_units_of_measure").update({ status: newStatus }).eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success(newStatus === "active" ? "Activada" : "Desactivada");
    reload();
  }

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-bold">Unidades de medida</h2>
          <p className="text-xs text-muted-foreground">No se pueden eliminar unidades en uso.</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nueva unidad</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Abreviatura</TableHead><TableHead>Estado</TableHead><TableHead>En uso</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
        <TableBody>
          {units.map(u => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell className="font-mono text-xs">{u.abbreviation}</TableCell>
              <TableCell><Badge variant={u.status === "active" ? "default" : "secondary"}>{u.status === "active" ? "Activa" : "Inactiva"}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">{usedIds.has(u.id) ? "Sí" : "No"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => toggle(u)}>
                  {u.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar unidad" : "Nueva unidad"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kilogramo" /></div>
            <div><Label>Abreviatura *</Label><Input value={abbr} onChange={(e) => setAbbr(e.target.value)} placeholder="kg" /></div>
            <div>
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activa</SelectItem>
                  <SelectItem value="inactive">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
