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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, Search, Power, PowerOff, Copy, Upload, Download, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { logCoreAudit } from "@/lib/coreAudit";

type CostStructure = {
  id: string;
  name: string;
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
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Borrador", variant: "outline" },
  active: { label: "Activa", variant: "default" },
  inactive: { label: "Inactiva", variant: "secondary" },
};

const PRODUCT_TYPES = ["Franela", "Hoodie", "Jogger", "Cargo", "Short", "Gorra", "Accesorio", "Producto terminado", "Otro"];

export default function CoreCostStructures() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CostStructure[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fType, setFType] = useState("all");
  const [fCurrency, setFCurrency] = useState("all");
  const [fWoo, setFWoo] = useState<"all" | "connected" | "missing">("all");

  const [toDelete, setToDelete] = useState<CostStructure | null>(null);
  const [viewing, setViewing] = useState<CostStructure | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("core_cost_structures")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error("Error cargando estructuras");
    setItems((data as any) ?? []);
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

  const placeholder = () => toast.info("La importación/exportación de estructuras de costos se conectará al sistema de Template de Carga materia prima en el siguiente ajuste.");

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
          <h1 className="text-3xl font-black tracking-tight">Estructuras de Costos</h1>
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
          <Button variant="outline" size="sm" onClick={placeholder}>
            <Download className="h-4 w-4 mr-1" />Exportar
          </Button>
          <Button size="sm" onClick={() => navigate("/core/estructuras-costos/nueva")}>
            <Plus className="h-4 w-4 mr-1" />Nueva estructura
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
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
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
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin estructuras de costos</TableCell></TableRow>
              ) : filtered.map(s => {
                const st = STATUS_LABELS[s.status] ?? { label: s.status, variant: "outline" as const };
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.product_type || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(s.total_unit_cost).toFixed(2)}</TableCell>
                    <TableCell>{s.base_currency}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {s.estimated_gross_margin_percent != null
                        ? `${Number(s.estimated_gross_margin_percent).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(s.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewing(s)} title="Ver"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/core/estructuras-costos/${s.id}`)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => duplicate(s)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => toggleStatus(s)} title={s.status === "active" ? "Desactivar" : "Activar"}>
                          {s.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(s)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
