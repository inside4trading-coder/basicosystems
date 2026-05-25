import { useEffect, useMemo, useState } from "react";
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, Search, Power, PowerOff, Copy, Upload, Download, FileSpreadsheet, Wand2, ArrowRightLeft } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";

type Template = {
  id: string;
  name: string;
  description: string | null;
  product_type: string | null;
  base_currency: string;
  status: string;
  notes: string | null;
  total_estimated_cost: number;
  source_cost_structure_id: string | null;
  updated_at: string;
};

type Structure = {
  id: string;
  name: string;
  base_currency: string;
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Borrador", variant: "outline" },
  active: { label: "Activo", variant: "default" },
  inactive: { label: "Inactivo", variant: "secondary" },
};

const PRODUCT_TYPES = ["Franela", "Hoodie", "Jogger", "Cargo", "Short", "Gorra", "Accesorio", "Producto terminado", "Otro"];

export default function CoreCostTemplates() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Template[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fType, setFType] = useState("all");
  const [fCurrency, setFCurrency] = useState("all");

  const [toDelete, setToDelete] = useState<Template | null>(null);
  const [viewing, setViewing] = useState<Template | null>(null);

  const [fromStructureOpen, setFromStructureOpen] = useState(false);
  const [pickedStructureId, setPickedStructureId] = useState<string>("");
  const [creatingFromStructure, setCreatingFromStructure] = useState(false);

  async function load() {
    setLoading(true);
    const [tpl, st] = await Promise.all([
      supabase.from("core_cost_templates").select("*").order("updated_at", { ascending: false }),
      supabase.from("core_cost_structures").select("id, name, base_currency").order("name"),
    ]);
    if (tpl.error) toast.error("Error cargando templates: " + tpl.error.message);
    setItems((tpl.data as any) ?? []);
    setStructures((st.data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (fStatus !== "all" && i.status !== fStatus) return false;
      if (fType !== "all" && i.product_type !== fType) return false;
      if (fCurrency !== "all" && i.base_currency !== fCurrency) return false;
      return true;
    });
  }, [items, search, fStatus, fType, fCurrency]);

  async function toggleStatus(t: Template) {
    const newStatus = t.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("core_cost_templates").update({ status: newStatus }).eq("id", t.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_cost_templates", recordId: t.id, action: "update", field: "status", oldValue: t.status, newValue: newStatus });
    toast.success(newStatus === "active" ? "Template activado" : "Template desactivado");
    load();
  }

  async function duplicate(t: Template) {
    const { data: full, error: e1 } = await supabase.from("core_cost_templates").select("*").eq("id", t.id).maybeSingle();
    if (e1 || !full) return toast.error("No se pudo cargar el template");
    const { data: itemsData, error: e2 } = await supabase.from("core_cost_template_items").select("*").eq("cost_template_id", t.id);
    if (e2) return toast.error("No se pudieron cargar las líneas");

    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = full as any;
    const { data: newRow, error: e3 } = await supabase
      .from("core_cost_templates")
      .insert({ ...rest, name: `${full.name} (copia)`, status: "draft" })
      .select()
      .single();
    if (e3 || !newRow) return toast.error(e3?.message ?? "No se pudo duplicar");

    if (itemsData && itemsData.length > 0) {
      const newItems = (itemsData as any[]).map(({ id, created_at, updated_at, cost_template_id, ...r }) => ({
        ...r, cost_template_id: newRow.id,
      }));
      const { error: e4 } = await supabase.from("core_cost_template_items").insert(newItems);
      if (e4) toast.error("Template creado pero hubo error copiando líneas: " + e4.message);
    }
    await logCoreAudit({ table: "core_cost_templates", recordId: newRow.id, action: "duplicate", oldValue: t.id, newValue: newRow.id });
    toast.success("Template duplicado");
    load();
  }

  async function createStructureFromTemplate(t: Template) {
    const { data: full, error: e1 } = await supabase.from("core_cost_templates").select("*").eq("id", t.id).maybeSingle();
    if (e1 || !full) return toast.error("No se pudo cargar el template");
    if (full.status !== "active") {
      return toast.error("Solo se puede crear una estructura desde un template activo");
    }
    const { data: tplItems, error: e2 } = await supabase.from("core_cost_template_items").select("*").eq("cost_template_id", t.id);
    if (e2) return toast.error("Error cargando líneas");

    const { data: { user } } = await supabase.auth.getUser();
    const { data: newStruct, error: e3 } = await supabase
      .from("core_cost_structures")
      .insert({
        name: `${full.name} — Estructura`,
        description: full.description,
        product_type: full.product_type,
        base_currency: full.base_currency,
        status: "draft",
        notes: full.notes,
        total_raw_materials: full.total_raw_materials,
        total_labor: full.total_labor,
        total_technical_processes: full.total_technical_processes,
        total_variable_costs: full.total_variable_costs,
        total_logistics: full.total_logistics,
        total_other_costs: full.total_other_costs,
        total_unit_cost: full.total_estimated_cost,
        suggested_fabrication_fund: full.total_estimated_cost,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      })
      .select()
      .single();
    if (e3 || !newStruct) return toast.error(e3?.message ?? "No se pudo crear la estructura");

    if (tplItems && tplItems.length > 0) {
      // Fetch fresh raw material costs to snapshot
      const rmIds = Array.from(new Set((tplItems as any[]).filter(i => i.raw_material_id).map(i => i.raw_material_id)));
      const rmMap: Record<string, any> = {};
      if (rmIds.length > 0) {
        const { data: rms } = await supabase.from("core_raw_materials").select("id, code, name, unit_cost, currency").in("id", rmIds);
        (rms as any[] ?? []).forEach(r => { rmMap[r.id] = r; });
      }
      const payload = (tplItems as any[]).map(it => {
        const fresh = it.raw_material_id ? rmMap[it.raw_material_id] : null;
        const unitCost = fresh ? Number(fresh.unit_cost) : Number(it.unit_cost) || 0;
        const subtotal = Number((unitCost * (Number(it.quantity) || 0)).toFixed(4));
        const snapshot = fresh ? {
          raw_material_id: fresh.id,
          code: fresh.code,
          name: fresh.name,
          unit_cost: unitCost,
          currency: fresh.currency,
          taken_at: new Date().toISOString(),
          from_template_id: t.id,
        } : null;
        const { id, created_at, updated_at, cost_template_id, ...rest } = it;
        return {
          ...rest,
          cost_structure_id: newStruct.id,
          unit_cost: unitCost,
          subtotal,
          cost_snapshot: snapshot,
        };
      });
      const { error: e4 } = await supabase.from("core_cost_structure_items").insert(payload);
      if (e4) toast.error("Estructura creada, error copiando líneas: " + e4.message);
    }
    await logCoreAudit({ table: "core_cost_structures", recordId: newStruct.id, action: "create_from_template", oldValue: t.id, newValue: newStruct.id });
    toast.success("Estructura creada desde template");
    navigate(`/core/estructuras-costos/${newStruct.id}`);
  }

  async function createTemplateFromStructure() {
    if (!pickedStructureId) return;
    setCreatingFromStructure(true);
    try {
      const { data: src, error: e1 } = await supabase.from("core_cost_structures").select("*").eq("id", pickedStructureId).maybeSingle();
      if (e1 || !src) throw e1 ?? new Error("No encontrado");
      const { data: srcItems, error: e2 } = await supabase.from("core_cost_structure_items").select("*").eq("cost_structure_id", pickedStructureId);
      if (e2) throw e2;

      const { data: { user } } = await supabase.auth.getUser();
      const { data: newTpl, error: e3 } = await supabase
        .from("core_cost_templates")
        .insert({
          name: `${src.name} (template)`,
          description: src.description,
          product_type: src.product_type,
          base_currency: src.base_currency,
          status: "draft",
          notes: src.notes,
          total_raw_materials: src.total_raw_materials,
          total_labor: src.total_labor,
          total_technical_processes: src.total_technical_processes,
          total_variable_costs: src.total_variable_costs,
          total_logistics: src.total_logistics,
          total_other_costs: src.total_other_costs,
          total_estimated_cost: src.total_unit_cost,
          source_cost_structure_id: src.id,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select()
        .single();
      if (e3 || !newTpl) throw e3 ?? new Error("No se pudo crear");

      if (srcItems && srcItems.length > 0) {
        // Templates do not store packaging as a section — fold packaging into "other" if any
        const payload = (srcItems as any[]).map(it => {
          const { id, created_at, updated_at, cost_structure_id, cost_snapshot, ...rest } = it;
          const section = rest.section === "packaging" ? "variable_cost" : rest.section;
          return { ...rest, section, cost_template_id: newTpl.id };
        });
        const { error: e4 } = await supabase.from("core_cost_template_items").insert(payload);
        if (e4) toast.error("Template creado, error copiando líneas: " + e4.message);
      }
      await logCoreAudit({ table: "core_cost_templates", recordId: newTpl.id, action: "create_from_structure", oldValue: src.id, newValue: newTpl.id });
      toast.success("Template creado desde estructura");
      setFromStructureOpen(false);
      setPickedStructureId("");
      navigate(`/core/templates-costos/${newTpl.id}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    } finally {
      setCreatingFromStructure(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("core_cost_templates").delete().eq("id", toDelete.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({ table: "core_cost_templates", recordId: toDelete.id, action: "delete", field: "record", oldValue: toDelete.name, newValue: null });
    toast.success("Template eliminado");
    setToDelete(null);
    load();
  }

  const placeholder = () => toast.info("La importación/exportación de templates de costos se conectará al sistema de Templates de Carga en un siguiente ajuste.");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Templates de Costos / Producción</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plantillas reutilizables para construir estructuras de costos y procesos de fabricación.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={placeholder}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Formato base
          </Button>
          <Button variant="outline" size="sm" onClick={placeholder}>
            <Upload className="h-4 w-4 mr-1" />Importar
          </Button>
          <Button variant="outline" size="sm" onClick={placeholder}>
            <Download className="h-4 w-4 mr-1" />Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFromStructureOpen(true)}>
            <Wand2 className="h-4 w-4 mr-1" />Desde estructura
          </Button>
          <Button size="sm" onClick={() => navigate("/core/templates-costos/nuevo")}>
            <Plus className="h-4 w-4 mr-1" />Nuevo template
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nombre" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
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
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Costo estimado base</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Actualización</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin templates</TableCell></TableRow>
              ) : filtered.map(t => {
                const st = STATUS_LABELS[t.status] ?? { label: t.status, variant: "outline" as const };
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.product_type || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(t.total_estimated_cost).toFixed(2)}</TableCell>
                    <TableCell>{t.base_currency}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewing(t)} title="Ver"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/core/templates-costos/${t.id}`)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => duplicate(t)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => createStructureFromTemplate(t)} title="Crear estructura desde template"><ArrowRightLeft className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => toggleStatus(t)} title={t.status === "active" ? "Desactivar" : "Activar"}>
                          {t.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(t)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar template?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{toDelete?.name}</strong> y todas sus líneas. Esta acción no se puede deshacer.
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
                <div className="flex justify-between"><span className="text-muted-foreground">Costo estimado base</span><span className="tabular-nums">{Number(viewing?.total_estimated_cost ?? 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estado</span><span>{viewing && (STATUS_LABELS[viewing.status]?.label ?? viewing.status)}</span></div>
                {viewing?.description && <div className="pt-2 border-t"><span className="text-muted-foreground">Descripción:</span><p className="mt-1">{viewing.description}</p></div>}
                {viewing?.notes && <div className="pt-2 border-t"><span className="text-muted-foreground">Observaciones:</span><p className="mt-1">{viewing.notes}</p></div>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (viewing) navigate(`/core/templates-costos/${viewing.id}`); }}>Editar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={fromStructureOpen} onOpenChange={setFromStructureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear template desde estructura</DialogTitle>
            <DialogDescription>
              Selecciona una estructura de costos existente. Se copiarán todos sus bloques y el template quedará en estado Borrador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Select value={pickedStructureId} onValueChange={setPickedStructureId}>
              <SelectTrigger><SelectValue placeholder="Selecciona una estructura" /></SelectTrigger>
              <SelectContent>
                {structures.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.base_currency})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFromStructureOpen(false)}>Cancelar</Button>
            <Button onClick={createTemplateFromStructure} disabled={!pickedStructureId || creatingFromStructure}>
              {creatingFromStructure ? "Creando…" : "Crear template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
