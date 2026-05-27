import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Copy, Power, PowerOff, Download, Upload, Settings2, FileDown, FileUp, History as HistoryIcon, X,
} from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";
import { formatDMY } from "@/lib/dateUtils";

type Template = {
  id: string;
  name: string;
  description: string | null;
  data_type: string;
  direction: string;
  status: string;
  settings: any;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
type Field = {
  id: string;
  template_id: string;
  display_name: string;
  column_name: string;
  internal_field: string;
  data_type: string;
  is_required: boolean;
  default_value: string | null;
  sort_order: number;
  is_active: boolean;
  notes: string | null;
};
type Batch = {
  id: string;
  template_id: string | null;
  data_type: string;
  file_name: string | null;
  status: string;
  total_rows: number;
  created_rows: number;
  updated_rows: number;
  error_rows: number;
  summary: any;
  created_at: string;
};

const DATA_TYPES = [
  { value: "raw_material", label: "Materia Prima", available: true },
  { value: "cost_structure", label: "Estructuras de Costos", available: false },
  { value: "core_product", label: "Productos Core", available: false },
  { value: "labor_rate", label: "Tarifas de Mano de Obra", available: false },
  { value: "cost_production_template", label: "Templates de Costos / Producción", available: false },
  { value: "other", label: "Otro", available: false },
];
const DIRECTIONS = [
  { value: "import", label: "Solo importación" },
  { value: "export", label: "Solo exportación" },
  { value: "both", label: "Importación y exportación" },
];
const FIELD_TYPES = ["text", "number", "decimal", "currency", "date", "boolean", "select", "lookup"];
const CURRENCIES = ["USD", "Bs", "EUR"];

function dataTypeLabel(v: string) {
  return DATA_TYPES.find((d) => d.value === v)?.label ?? v;
}
function directionLabel(v: string) {
  return DIRECTIONS.find((d) => d.value === v)?.label ?? v;
}
function directionBadge(v: string) {
  if (v === "import") return <Badge variant="secondary">Importación</Badge>;
  if (v === "export") return <Badge variant="secondary">Exportación</Badge>;
  return <Badge variant="secondary">Ambas</Badge>;
}
function statusBadge(s: string) {
  if (s === "completed") return <Badge>Completada</Badge>;
  if (s === "completed_with_errors") return <Badge variant="secondary">Con errores</Badge>;
  if (s === "failed") return <Badge variant="destructive">Fallida</Badge>;
  if (s === "cancelled") return <Badge variant="outline">Cancelada</Badge>;
  if (s === "preview") return <Badge variant="outline">Preview</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

export default function CoreImportTemplates() {
  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [fieldCounts, setFieldCounts] = useState<Record<string, number>>({});
  const [usedTemplateIds, setUsedTemplateIds] = useState<Set<string>>(new Set());
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [fieldsFor, setFieldsFor] = useState<Template | null>(null);
  const [importFor, setImportFor] = useState<Template | null>(null);
  const [toDelete, setToDelete] = useState<Template | null>(null);

  async function load() {
    setLoading(true);
    const [t, f, b] = await Promise.all([
      supabase.from("core_import_templates").select("*").order("updated_at", { ascending: false }),
      supabase.from("core_import_template_fields").select("template_id"),
      supabase.from("core_import_batches").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setTemplates((t.data as any) ?? []);
    const counts: Record<string, number> = {};
    ((f.data as any) ?? []).forEach((x: any) => { counts[x.template_id] = (counts[x.template_id] ?? 0) + 1; });
    setFieldCounts(counts);
    const used = new Set<string>();
    ((b.data as any) ?? []).forEach((x: Batch) => x.template_id && used.add(x.template_id));
    setUsedTemplateIds(used);
    setBatches((b.data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggleStatus(t: Template) {
    const next = t.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("core_import_templates").update({ status: next }).eq("id", t.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_import_templates", recordId: t.id, action: next === "active" ? "activate" : "deactivate", field: "status", oldValue: t.status, newValue: next });
    toast.success(next === "active" ? "Template activado" : "Template desactivado");
    load();
  }

  async function duplicate(t: Template) {
    const { data: fields } = await supabase.from("core_import_template_fields").select("*").eq("template_id", t.id);
    const newName = `${t.name} (copia)`;
    const { data, error } = await supabase.from("core_import_templates").insert({
      name: newName, description: t.description, data_type: t.data_type, direction: t.direction,
      status: "inactive", settings: t.settings, notes: t.notes,
    }).select().single();
    if (error) return toast.error(error.message);
    if (fields && fields.length) {
      const rows = (fields as any[]).map(({ id, template_id, created_at, updated_at, ...rest }) => ({
        ...rest, template_id: (data as any).id,
      }));
      await supabase.from("core_import_template_fields").insert(rows);
    }
    await logCoreAudit({ table: "core_import_templates", recordId: (data as any).id, action: "duplicate", newValue: newName });
    toast.success("Template duplicado");
    load();
  }

  async function handleDelete() {
    if (!toDelete) return;
    if (usedTemplateIds.has(toDelete.id)) return toast.error("Este template ya fue usado. Solo se puede desactivar.");
    const { error } = await supabase.from("core_import_templates").delete().eq("id", toDelete.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_import_templates", recordId: toDelete.id, action: "delete", oldValue: toDelete.name });
    toast.success("Template eliminado");
    setToDelete(null);
    load();
  }

  async function downloadBase(t: Template) {
    const { data: fields } = await supabase.from("core_import_template_fields")
      .select("*").eq("template_id", t.id).eq("is_active", true).order("sort_order");
    if (!fields || !fields.length) return toast.error("El template no tiene campos definidos");
    const headers = (fields as any[]).map((f) => f.column_name);
    const csv = headers.join(",") + "\n";
    downloadCsv(csv, `${slug(t.name)}-formato.csv`);
    await logCoreAudit({ table: "core_import_templates", recordId: t.id, action: "download_base" });
  }

  async function exportCurrent(t: Template) {
    if (t.data_type !== "raw_material") return toast.info("La exportación para este tipo se activará en próximos bloques.");
    const { data: fields } = await supabase.from("core_import_template_fields")
      .select("*").eq("template_id", t.id).eq("is_active", true).order("sort_order");
    if (!fields || !fields.length) return toast.error("El template no tiene campos");
    const [mats, cats, units] = await Promise.all([
      supabase.from("core_raw_materials").select("*").order("code"),
      supabase.from("core_raw_material_categories").select("id,name"),
      supabase.from("core_units_of_measure").select("id,name"),
    ]);
    const catMap = Object.fromEntries((cats.data ?? []).map((c: any) => [c.id, c.name]));
    const unitMap = Object.fromEntries((units.data ?? []).map((u: any) => [u.id, u.name]));
    const rows = ((mats.data as any[]) ?? []).map((m) =>
      (fields as any[]).map((f) => {
        let v: any = "";
        switch (f.internal_field) {
          case "code": v = m.code; break;
          case "name": v = m.name; break;
          case "category_id": v = catMap[m.category_id] ?? ""; break;
          case "unit_of_measure_id": v = unitMap[m.unit_of_measure_id] ?? ""; break;
          case "unit_cost": v = m.unit_cost; break;
          case "currency": v = m.currency; break;
          case "supplier": v = m.supplier ?? ""; break;
          case "status": v = m.status; break;
          case "notes": v = m.notes ?? ""; break;
        }
        return v;
      })
    );
    const csv = Papa.unparse({ fields: (fields as any[]).map((f) => f.column_name), data: rows });
    downloadCsv(csv, `${slug(t.name)}-export-${new Date().toISOString().slice(0, 10)}.csv`);
    await logCoreAudit({ table: "core_import_templates", recordId: t.id, action: "export_data", newValue: String(rows.length) });
    toast.success(`${rows.length} filas exportadas`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Template de Carga materia prima</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Plantillas configurables para importar y exportar datos de BASICO CORE.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="h-4 w-4 mr-1" />Nuevo template
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="historial"><HistoryIcon className="h-3.5 w-3.5 mr-1.5" />Historial de importaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <Card className="p-4">
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo de datos</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead className="text-center">Campos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actualizado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
                  ) : templates.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin templates</TableCell></TableRow>
                  ) : templates.map((t) => {
                    const isUsed = usedTemplateIds.has(t.id);
                    const dt = DATA_TYPES.find((d) => d.value === t.data_type);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{dataTypeLabel(t.data_type)}</span>
                            {!dt?.available && <Badge variant="outline" className="text-[10px]">Próximamente</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{directionBadge(t.direction)}</TableCell>
                        <TableCell className="text-center tabular-nums">{fieldCounts[t.id] ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === "active" ? "default" : "secondary"}>
                            {t.status === "active" ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new formatDMY(Date(t.updated_at))}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <Button variant="ghost" size="icon" title="Editar campos" onClick={() => setFieldsFor(t)}><Settings2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Editar" onClick={() => { setEditing(t); setOpenForm(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Duplicar" onClick={() => duplicate(t)}><Copy className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Descargar formato base" onClick={() => downloadBase(t)}><FileDown className="h-4 w-4" /></Button>
                            {(t.direction === "export" || t.direction === "both") && (
                              <Button variant="ghost" size="icon" title="Exportar datos" onClick={() => exportCurrent(t)}><Download className="h-4 w-4" /></Button>
                            )}
                            {(t.direction === "import" || t.direction === "both") && (
                              <Button variant="ghost" size="icon" title="Importar" onClick={() => setImportFor(t)} disabled={t.status !== "active" || !dt?.available}><FileUp className="h-4 w-4" /></Button>
                            )}
                            <Button variant="ghost" size="icon" title={t.status === "active" ? "Desactivar" : "Activar"} onClick={() => toggleStatus(t)}>
                              {t.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" title={isUsed ? "Ya fue usado — solo desactivar" : "Eliminar"} onClick={() => setToDelete(t)} disabled={isUsed}>
                              <Trash2 className={`h-4 w-4 ${isUsed ? "text-muted-foreground" : "text-destructive"}`} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <Card className="p-4">
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Archivo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Creadas</TableHead>
                    <TableHead className="text-right">Actualizadas</TableHead>
                    <TableHead className="text-right">Errores</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin importaciones</TableCell></TableRow>
                  ) : batches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</TableCell>
                      <TableCell>{dataTypeLabel(b.data_type)}</TableCell>
                      <TableCell className="font-mono text-xs">{b.file_name || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.total_rows}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">{b.created_rows}</TableCell>
                      <TableCell className="text-right tabular-nums text-blue-600">{b.updated_rows}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{b.error_rows}</TableCell>
                      <TableCell>{statusBadge(b.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {openForm && (
        <TemplateForm
          open={openForm}
          onOpenChange={setOpenForm}
          editing={editing}
          existingNames={new Set(templates.filter(t => t.id !== editing?.id && t.status === "active").map(t => t.name.toLowerCase()))}
          onSaved={load}
        />
      )}

      {fieldsFor && (
        <FieldsEditor template={fieldsFor} onClose={() => { setFieldsFor(null); load(); }} />
      )}

      {importFor && (
        <ImporterDialog template={importFor} onClose={() => { setImportFor(null); load(); }} />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar template?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{toDelete?.name}</strong> y sus campos. No se puede deshacer.
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

// =============== Template form ===============
function TemplateForm({ open, onOpenChange, editing, existingNames, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Template | null;
  existingNames: Set<string>; onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [dataType, setDataType] = useState(editing?.data_type ?? "raw_material");
  const [direction, setDirection] = useState(editing?.direction ?? "both");
  const [status, setStatus] = useState(editing?.status ?? "active");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [onExisting, setOnExisting] = useState<string>(editing?.settings?.on_existing_code ?? "update");
  const [autoCats, setAutoCats] = useState<boolean>(!!editing?.settings?.auto_create_categories);
  const [autoUnits, setAutoUnits] = useState<boolean>(!!editing?.settings?.auto_create_units);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const n = name.trim();
    if (!n) return toast.error("Nombre obligatorio");
    if (!dataType) return toast.error("Tipo de datos obligatorio");
    if (!direction) return toast.error("Dirección obligatoria");
    if (!status) return toast.error("Estado obligatorio");
    if (status === "active" && existingNames.has(n.toLowerCase())) return toast.error("Ya existe un template activo con ese nombre");
    setSaving(true);
    const payload = {
      name: n, description: description.trim() || null, data_type: dataType, direction, status,
      notes: notes.trim() || null,
      settings: { on_existing_code: onExisting, auto_create_categories: autoCats, auto_create_units: autoUnits },
    };
    if (editing) {
      const { error } = await supabase.from("core_import_templates").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      await logCoreAudit({ table: "core_import_templates", recordId: editing.id, action: "update", newValue: n });
      toast.success("Template actualizado");
    } else {
      const { data, error } = await supabase.from("core_import_templates").insert(payload).select().single();
      setSaving(false);
      if (error) return toast.error(error.message);
      await logCoreAudit({ table: "core_import_templates", recordId: (data as any).id, action: "create", newValue: n });
      toast.success("Template creado");
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Editar template" : "Nuevo template"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Descripción</Label>
            <Textarea rows={2} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de datos *</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}{!d.available && " (próximamente)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Dirección *</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIRECTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
          <div className="space-y-1.5">
            <Label>Si el código ya existe</Label>
            <Select value={onExisting} onValueChange={setOnExisting}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="update">Actualizar registro existente</SelectItem>
                <SelectItem value="skip">Saltar fila</SelectItem>
                <SelectItem value="error">Marcar como error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={autoCats} onCheckedChange={setAutoCats} />
              Crear automáticamente categorías no existentes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={autoUnits} onCheckedChange={setAutoUnits} />
              Crear automáticamente unidades no existentes
            </label>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Observaciones</Label>
            <Textarea rows={2} value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
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

// =============== Fields editor ===============
function FieldsEditor({ template, onClose }: { template: Template; onClose: () => void }) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("core_import_template_fields")
      .select("*").eq("template_id", template.id).order("sort_order");
    setFields((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [template.id]);

  async function addField() {
    const nextOrder = (fields[fields.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("core_import_template_fields").insert({
      template_id: template.id, display_name: "Nuevo campo", column_name: "nuevo_campo",
      internal_field: "", data_type: "text", is_required: false, sort_order: nextOrder, is_active: true,
    });
    if (error) return toast.error(error.message);
    load();
  }
  async function saveField(f: Field) {
    const { id, template_id, ...rest } = f;
    const { error } = await supabase.from("core_import_template_fields").update(rest).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Campo guardado");
  }
  async function delField(f: Field) {
    const { error } = await supabase.from("core_import_template_fields").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campos del template — {template.name}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Orden</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead>Columna esperada</TableHead>
                <TableHead>Campo interno</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Obligatorio</TableHead>
                <TableHead>Valor por defecto</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : fields.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin campos</TableCell></TableRow>
              ) : fields.map((f, i) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <Input type="number" className="w-16" value={f.sort_order}
                      onChange={(e) => setFields(arr => arr.map((x, j) => j === i ? { ...x, sort_order: parseInt(e.target.value || "0") } : x))} />
                  </TableCell>
                  <TableCell><Input value={f.display_name} onChange={(e) => setFields(arr => arr.map((x, j) => j === i ? { ...x, display_name: e.target.value } : x))} /></TableCell>
                  <TableCell><Input value={f.column_name} onChange={(e) => setFields(arr => arr.map((x, j) => j === i ? { ...x, column_name: e.target.value } : x))} /></TableCell>
                  <TableCell><Input value={f.internal_field} onChange={(e) => setFields(arr => arr.map((x, j) => j === i ? { ...x, internal_field: e.target.value } : x))} /></TableCell>
                  <TableCell>
                    <Select value={f.data_type} onValueChange={(v) => setFields(arr => arr.map((x, j) => j === i ? { ...x, data_type: v } : x))}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={f.is_required} onCheckedChange={(v) => setFields(arr => arr.map((x, j) => j === i ? { ...x, is_required: v } : x))} />
                  </TableCell>
                  <TableCell><Input value={f.default_value ?? ""} onChange={(e) => setFields(arr => arr.map((x, j) => j === i ? { ...x, default_value: e.target.value } : x))} /></TableCell>
                  <TableCell className="text-center">
                    <Switch checked={f.is_active} onCheckedChange={(v) => setFields(arr => arr.map((x, j) => j === i ? { ...x, is_active: v } : x))} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => saveField(f)}>Guardar</Button>
                      <Button variant="ghost" size="icon" onClick={() => delField(f)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={addField}><Plus className="h-4 w-4 mr-1" />Añadir campo</Button>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============== Importer ===============
type PreviewRow = {
  rowNumber: number;
  raw: Record<string, string>;
  parsed: Record<string, any>;
  action: "create" | "update" | "skip" | "error";
  errors: string[];
};

function ImporterDialog({ template, onClose }: { template: Template; onClose: () => void }) {
  const [fields, setFields] = useState<Field[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("core_import_template_fields").select("*")
      .eq("template_id", template.id).eq("is_active", true).order("sort_order")
      .then(({ data }) => setFields((data as any) ?? []));
  }, [template.id]);

  if (template.data_type !== "raw_material") {
    return (
      <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Importación no disponible</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">La importación de {dataTypeLabel(template.data_type)} se activará en próximos bloques.</p>
          <DialogFooter><Button onClick={onClose}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  async function parseFile(f: File) {
    setParsing(true);
    setFile(f);
    // Load reference data for raw_material
    const [mats, cats, units] = await Promise.all([
      supabase.from("core_raw_materials").select("id,code"),
      supabase.from("core_raw_material_categories").select("id,name,status"),
      supabase.from("core_units_of_measure").select("id,name,abbreviation,status"),
    ]);
    const existingCodes = new Map<string, string>(((mats.data as any[]) ?? []).map((m) => [String(m.code), m.id]));
    const catByName = new Map<string, string>(((cats.data as any[]) ?? []).map((c) => [c.name.toLowerCase(), c.id]));
    const unitByName = new Map<string, string>();
    ((units.data as any[]) ?? []).forEach((u) => {
      unitByName.set(u.name.toLowerCase(), u.id);
      if (u.abbreviation) unitByName.set(u.abbreviation.toLowerCase(), u.id);
    });

    Papa.parse(f, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const onExisting = (template.settings?.on_existing_code as string) ?? "update";
        const seenCodes = new Set<string>();
        const rows: PreviewRow[] = [];
        const data = res.data as Record<string, string>[];

        data.forEach((raw, idx) => {
          const errors: string[] = [];
          const parsed: Record<string, any> = {};

          fields.forEach((f) => {
            let val: any = raw[f.column_name];
            if (val === undefined || val === null || String(val).trim() === "") {
              if (f.default_value) val = f.default_value;
            }
            const s = val == null ? "" : String(val).trim();

            switch (f.internal_field) {
              case "code":
                if (!s) errors.push("Código vacío");
                parsed.code = s;
                break;
              case "name":
                if (!s && f.is_required) errors.push("Nombre vacío");
                parsed.name = s;
                break;
              case "category_id": {
                if (!s) { if (f.is_required) errors.push("Categoría vacía"); break; }
                const id = catByName.get(s.toLowerCase());
                if (id) parsed.category_id = id;
                else errors.push(`Categoría no encontrada: ${s}`);
                parsed._category_name = s;
                break;
              }
              case "unit_of_measure_id": {
                if (!s) { if (f.is_required) errors.push("Unidad vacía"); break; }
                const id = unitByName.get(s.toLowerCase());
                if (id) parsed.unit_of_measure_id = id;
                else errors.push(`Unidad no encontrada: ${s}`);
                parsed._unit_name = s;
                break;
              }
              case "unit_cost": {
                if (!s) { if (f.is_required) errors.push("Costo vacío"); break; }
                const n = parseFloat(s.replace(",", "."));
                if (Number.isNaN(n)) errors.push("Costo inválido");
                else if (n < 0) errors.push("Costo negativo");
                else parsed.unit_cost = n;
                break;
              }
              case "currency": {
                const up = s.toUpperCase();
                if (!up) { if (f.is_required) errors.push("Moneda vacía"); break; }
                if (!CURRENCIES.includes(up)) errors.push(`Moneda inválida: ${s}`);
                else parsed.currency = up;
                break;
              }
              case "supplier": parsed.supplier = s || null; break;
              case "status": {
                const ls = s.toLowerCase();
                const map: Record<string, string> = { activo: "active", active: "active", inactivo: "inactive", inactive: "inactive" };
                const v = map[ls];
                if (!v) { if (f.is_required) errors.push(`Estado inválido: ${s}`); }
                else parsed.status = v;
                break;
              }
              case "notes": parsed.notes = s || null; break;
              default: break;
            }
          });

          if (parsed.code) {
            if (seenCodes.has(parsed.code)) errors.push("Código duplicado en archivo");
            seenCodes.add(parsed.code);
          }

          let action: PreviewRow["action"] = "create";
          if (errors.length) action = "error";
          else if (parsed.code && existingCodes.has(parsed.code)) {
            if (onExisting === "skip") action = "skip";
            else if (onExisting === "error") { errors.push("Código ya existe"); action = "error"; }
            else action = "update";
          }
          rows.push({ rowNumber: idx + 2, raw, parsed, action, errors });
        });

        setPreview(rows);
        setParsing(false);
      },
      error: (err) => { toast.error("Error leyendo CSV: " + err.message); setParsing(false); },
    });
  }

  async function confirmImport() {
    if (!preview || !file) return;
    setConfirming(true);
    const { data: { user } } = await supabase.auth.getUser();
    const fileKey = `${Date.now()}-${file.name}`;
    await supabase.storage.from("core-import-files").upload(fileKey, file).catch(() => null);

    // Create batch row
    const { data: batch, error: batchErr } = await supabase.from("core_import_batches").insert({
      template_id: template.id, data_type: template.data_type, file_name: file.name, file_url: fileKey,
      status: "preview", total_rows: preview.length, created_by: user?.id ?? null,
    }).select().single();
    if (batchErr || !batch) { setConfirming(false); return toast.error(batchErr?.message ?? "Error creando batch"); }
    const batchId = (batch as any).id;

    // Auto-create categories/units if enabled
    const autoCats = !!template.settings?.auto_create_categories;
    const autoUnits = !!template.settings?.auto_create_units;
    const newCats = new Map<string, string>();
    const newUnits = new Map<string, string>();

    if (autoCats) {
      const missing = new Set<string>();
      preview.forEach((p) => { if (p.parsed._category_name && !p.parsed.category_id) missing.add(p.parsed._category_name); });
      for (const name of missing) {
        const { data } = await supabase.from("core_raw_material_categories").insert({ name, status: "active" }).select().single();
        if (data) {
          newCats.set(name.toLowerCase(), (data as any).id);
          await logCoreAudit({ table: "core_raw_material_categories", recordId: (data as any).id, action: "auto_create_from_import", newValue: name });
        }
      }
    }
    if (autoUnits) {
      const missing = new Set<string>();
      preview.forEach((p) => { if (p.parsed._unit_name && !p.parsed.unit_of_measure_id) missing.add(p.parsed._unit_name); });
      for (const name of missing) {
        const { data } = await supabase.from("core_units_of_measure").insert({ name, abbreviation: name, status: "active" }).select().single();
        if (data) {
          newUnits.set(name.toLowerCase(), (data as any).id);
          await logCoreAudit({ table: "core_units_of_measure", recordId: (data as any).id, action: "auto_create_from_import", newValue: name });
        }
      }
    }

    let created = 0, updated = 0, errored = 0;
    const rowsToInsert: any[] = [];

    for (const p of preview) {
      // Resolve auto-created lookups
      if (!p.parsed.category_id && p.parsed._category_name) {
        const id = newCats.get(String(p.parsed._category_name).toLowerCase());
        if (id) { p.parsed.category_id = id; p.errors = p.errors.filter(e => !e.startsWith("Categoría no encontrada")); }
      }
      if (!p.parsed.unit_of_measure_id && p.parsed._unit_name) {
        const id = newUnits.get(String(p.parsed._unit_name).toLowerCase());
        if (id) { p.parsed.unit_of_measure_id = id; p.errors = p.errors.filter(e => !e.startsWith("Unidad no encontrada")); }
      }
      if (p.errors.length === 0 && p.action === "error") p.action = "create";

      let targetId: string | null = null;
      let validation = "ok";
      if (p.action === "error" || p.errors.length > 0) { errored++; validation = "error"; }
      else if (p.action === "skip") { validation = "skipped"; }
      else {
        const payload: any = {
          code: p.parsed.code, name: p.parsed.name,
          category_id: p.parsed.category_id, unit_of_measure_id: p.parsed.unit_of_measure_id,
          unit_cost: p.parsed.unit_cost, currency: p.parsed.currency,
          supplier: p.parsed.supplier ?? null, status: p.parsed.status ?? "active",
          notes: p.parsed.notes ?? null,
        };
        if (p.action === "update") {
          const { data: existing } = await supabase.from("core_raw_materials").select("id,unit_cost").eq("code", payload.code).maybeSingle();
          if (existing) {
            const { error } = await supabase.from("core_raw_materials").update(payload).eq("id", (existing as any).id);
            if (error) { errored++; validation = "error"; p.errors.push(error.message); }
            else {
              updated++; targetId = (existing as any).id;
              if (Number((existing as any).unit_cost) !== Number(payload.unit_cost)) {
                await logCoreAudit({ table: "core_raw_materials", recordId: targetId, action: "import_update_cost", field: "unit_cost", oldValue: (existing as any).unit_cost, newValue: payload.unit_cost });
              }
            }
          }
        } else {
          const { data, error } = await supabase.from("core_raw_materials").insert(payload).select().single();
          if (error) { errored++; validation = "error"; p.errors.push(error.message); }
          else { created++; targetId = (data as any).id; }
        }
      }

      rowsToInsert.push({
        batch_id: batchId, row_number: p.rowNumber, raw_data: p.raw, parsed_data: p.parsed,
        validation_status: validation, errors: p.errors, action: p.action, target_record_id: targetId,
      });
    }

    // Insert batch rows in chunks
    for (let i = 0; i < rowsToInsert.length; i += 200) {
      await supabase.from("core_import_batch_rows").insert(rowsToInsert.slice(i, i + 200));
    }

    const finalStatus = errored === 0 ? "completed" : (created + updated > 0 ? "completed_with_errors" : "failed");
    await supabase.from("core_import_batches").update({
      status: finalStatus, created_rows: created, updated_rows: updated, error_rows: errored,
      summary: { template_name: template.name },
    }).eq("id", batchId);

    await logCoreAudit({ table: "core_import_batches", recordId: batchId, action: "import_run", newValue: `creadas:${created} actualizadas:${updated} errores:${errored}` });

    toast.success(`Importación finalizada — Creadas: ${created}, Actualizadas: ${updated}, Errores: ${errored}`);
    setConfirming(false);
    onClose();
  }

  const summary = useMemo(() => {
    if (!preview) return null;
    return {
      create: preview.filter(p => p.action === "create").length,
      update: preview.filter(p => p.action === "update").length,
      skip: preview.filter(p => p.action === "skip").length,
      error: preview.filter(p => p.action === "error").length,
    };
  }, [preview]);

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar — {template.name}</DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sube un archivo CSV con las columnas definidas por este template. El sistema validará cada fila antes de guardar.
            </p>
            <div className="flex items-center gap-2">
              <Input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} disabled={parsing} />
            </div>
            <p className="text-xs text-muted-foreground">Columnas esperadas: <span className="font-mono">{fields.map(f => f.column_name).join(", ")}</span></p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">A crear: {summary?.create}</Badge>
              <Badge variant="secondary">A actualizar: {summary?.update}</Badge>
              <Badge variant="outline">Saltar: {summary?.skip}</Badge>
              <Badge variant="destructive">Errores: {summary?.error}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">{file?.name}</span>
            </div>
            <div className="rounded-lg border overflow-x-auto max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Fila</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((p) => (
                    <TableRow key={p.rowNumber} className={p.errors.length ? "bg-destructive/5" : ""}>
                      <TableCell className="text-xs">{p.rowNumber}</TableCell>
                      <TableCell>
                        {p.action === "create" && <Badge>Crear</Badge>}
                        {p.action === "update" && <Badge variant="secondary">Actualizar</Badge>}
                        {p.action === "skip" && <Badge variant="outline">Saltar</Badge>}
                        {p.action === "error" && <Badge variant="destructive">Error</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.parsed.code ?? p.raw.codigo}</TableCell>
                      <TableCell>{p.parsed.name ?? p.raw.nombre}</TableCell>
                      <TableCell className="text-xs">{p.parsed._category_name ?? p.raw.categoria}</TableCell>
                      <TableCell className="text-xs">{p.parsed._unit_name ?? p.raw.unidad_medida}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.parsed.unit_cost ?? p.raw.costo_unitario}</TableCell>
                      <TableCell>{p.parsed.currency ?? p.raw.moneda}</TableCell>
                      <TableCell className="text-xs text-destructive">{p.errors.join("; ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={confirming}><X className="h-4 w-4 mr-1" />Cancelar</Button>
          {preview && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPreview(null); setFile(null); if (fileRef.current) fileRef.current.value = ""; }} disabled={confirming}>Volver</Button>
              <Button onClick={confirmImport} disabled={confirming || (summary?.create === 0 && summary?.update === 0)}>
                {confirming ? "Importando…" : "Confirmar importación"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============== utils ===============
function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
