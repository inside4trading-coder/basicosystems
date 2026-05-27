import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Plus, Search, Pencil, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "cutter", label: "Cortador" },
  { value: "sewer", label: "Costurera/o" },
  { value: "printer", label: "Estampador" },
  { value: "embroiderer", label: "Bordador" },
  { value: "logistics", label: "Logística" },
  { value: "packing", label: "Empaque" },
  { value: "quality", label: "Calidad" },
  { value: "other", label: "Otro" },
];

type Operator = {
  id: string;
  first_name: string;
  last_name: string | null;
  alias: string | null;
  phone: string | null;
  document_id: string | null;
  photo_url: string | null;
  status: string;
  start_date: string | null;
  base_rate: number | null;
  notes: string | null;
  updated_at: string;
};
type Role = { id: string; operator_id: string; role_type: string; role_label: string | null; is_primary: boolean; status: string };

export default function CoreFactoryOperators() {
  const [ops, setOps] = useState<Operator[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [editing, setEditing] = useState<Operator | null>(null);
  const [open, setOpen] = useState(false);

  // form
  const [form, setForm] = useState<any>(emptyForm());
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [primaryRole, setPrimaryRole] = useState<string>("");

  function emptyForm() {
    return {
      first_name: "", last_name: "", alias: "", phone: "", document_id: "",
      status: "active", start_date: "", base_rate: "", notes: "", photo_url: "",
    };
  }

  async function load() {
    const [{ data: o }, { data: r }] = await Promise.all([
      supabase.from("core_factory_operators").select("*").order("first_name"),
      supabase.from("core_factory_operator_roles").select("*"),
    ]);
    setOps((o as Operator[]) || []);
    setRoles((r as Role[]) || []);
  }
  useEffect(() => { load(); }, []);

  const rolesByOp = useMemo(() => {
    const m: Record<string, Role[]> = {};
    for (const r of roles) {
      if (!m[r.operator_id]) m[r.operator_id] = [];
      m[r.operator_id].push(r);
    }
    return m;
  }, [roles]);

  const filtered = useMemo(() => {
    return ops.filter((o) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterRole !== "all") {
        const has = (rolesByOp[o.id] || []).some((r) => r.role_type === filterRole && r.status === "active");
        if (!has) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const full = `${o.first_name} ${o.last_name || ""} ${o.alias || ""} ${o.phone || ""} ${o.document_id || ""}`.toLowerCase();
        if (!full.includes(q)) return false;
      }
      return true;
    });
  }, [ops, rolesByOp, filterRole, filterStatus, search]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setSelectedRoles([]);
    setPrimaryRole("");
    setOpen(true);
  }
  function openEdit(op: Operator) {
    setEditing(op);
    setForm({
      first_name: op.first_name,
      last_name: op.last_name || "",
      alias: op.alias || "",
      phone: op.phone || "",
      document_id: op.document_id || "",
      status: op.status,
      start_date: op.start_date || "",
      base_rate: op.base_rate ?? "",
      notes: op.notes || "",
      photo_url: op.photo_url || "",
    });
    const opRoles = (rolesByOp[op.id] || []).filter((r) => r.status === "active");
    setSelectedRoles(opRoles.map((r) => r.role_type));
    setPrimaryRole(opRoles.find((r) => r.is_primary)?.role_type || "");
    setOpen(true);
  }

  async function save() {
    if (!form.first_name.trim()) { toast({ title: "Nombre obligatorio", variant: "destructive" }); return; }
    if (selectedRoles.length === 0) { toast({ title: "Selecciona al menos un rol productivo", variant: "destructive" }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      first_name: form.first_name.trim(),
      last_name: form.last_name?.trim() || null,
      alias: form.alias?.trim() || null,
      phone: form.phone?.trim() || null,
      document_id: form.document_id?.trim() || null,
      photo_url: form.photo_url?.trim() || null,
      status: form.status,
      start_date: form.start_date || null,
      base_rate: form.base_rate === "" ? null : Number(form.base_rate),
      notes: form.notes?.trim() || null,
      updated_by: user?.id || null,
    };
    let opId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("core_factory_operators").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      payload.created_by = user?.id || null;
      const { data, error } = await supabase.from("core_factory_operators").insert(payload).select().single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      opId = data.id;
    }

    // Sync roles: delete removed, upsert kept
    const current = (rolesByOp[opId!] || []);
    const toRemove = current.filter((r) => !selectedRoles.includes(r.role_type));
    for (const r of toRemove) {
      await supabase.from("core_factory_operator_roles").delete().eq("id", r.id);
    }
    for (const rt of selectedRoles) {
      const existing = current.find((r) => r.role_type === rt);
      const label = ROLE_OPTIONS.find((o) => o.value === rt)?.label || rt;
      const is_primary = primaryRole === rt;
      if (existing) {
        await supabase.from("core_factory_operator_roles")
          .update({ is_primary, status: "active", role_label: label }).eq("id", existing.id);
      } else {
        await supabase.from("core_factory_operator_roles").insert({
          operator_id: opId, role_type: rt, role_label: label, is_primary, status: "active",
        });
      }
    }

    toast({ title: editing ? "Operario actualizado" : "Operario creado" });
    setOpen(false);
    await load();
  }

  async function toggleStatus(op: Operator) {
    const next = op.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("core_factory_operators").update({ status: next }).eq("id", op.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: next === "active" ? "Operario activado" : "Operario desactivado" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Basico Crew / Operarios de Fábrica</h1>
          <p className="text-sm text-muted-foreground">Catálogo de personas que participan en producción, escaneo y nómina.</p>
        </div>
        <Button onClick={openNew} variant="brand"><Plus className="h-4 w-4" /> Nuevo operario</Button>
      </div>

      <Card className="p-4">
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[220px]">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-3 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, alias, teléfono..." />
            </div>
          </div>
          <div className="min-w-[180px]">
            <Label>Rol</Label>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label>Estado</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Alias</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Actualizado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin operarios.</TableCell></TableRow>
            )}
            {filtered.map((o) => {
              const opRoles = (rolesByOp[o.id] || []).filter((r) => r.status === "active");
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.first_name} {o.last_name || ""}</TableCell>
                  <TableCell>{o.alias || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {opRoles.map((r) => (
                        <Badge key={r.id} variant={r.is_primary ? "default" : "secondary"} className="text-[10px]">
                          {r.role_label || r.role_type}{r.is_primary && " ★"}
                        </Badge>
                      ))}
                      {opRoles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>{o.phone || "—"}</TableCell>
                  <TableCell><Badge variant={o.status === "active" ? "default" : "outline"}>{o.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(o.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(o)}><Power className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar operario" : "Nuevo operario"}</DialogTitle>
            <DialogDescription>Datos básicos y roles productivos.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <Label>Apellido</Label>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div>
              <Label>Alias</Label>
              <Input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Documento / cédula</Label>
              <Input value={form.document_id} onChange={(e) => setForm({ ...form, document_id: e.target.value })} />
            </div>
            <div>
              <Label>Fecha de ingreso</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label>Tarifa base</Label>
              <Input type="number" step="0.01" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} />
            </div>
            <div>
              <Label>Estado *</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Foto URL</Label>
              <Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <Label>Roles productivos *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                {ROLE_OPTIONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-2 border rounded p-2 cursor-pointer">
                    <Checkbox
                      checked={selectedRoles.includes(r.value)}
                      onCheckedChange={(c) => {
                        if (c) setSelectedRoles([...selectedRoles, r.value]);
                        else {
                          setSelectedRoles(selectedRoles.filter((x) => x !== r.value));
                          if (primaryRole === r.value) setPrimaryRole("");
                        }
                      }}
                    />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {selectedRoles.length > 0 && (
              <div className="col-span-2">
                <Label>Rol principal (opcional)</Label>
                <Select value={primaryRole} onValueChange={setPrimaryRole}>
                  <SelectTrigger><SelectValue placeholder="Sin rol principal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Sin principal —</SelectItem>
                    {selectedRoles.map((rt) => {
                      const label = ROLE_OPTIONS.find((o) => o.value === rt)?.label || rt;
                      return <SelectItem key={rt} value={rt}>{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
