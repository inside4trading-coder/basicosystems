import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCoreLocations, useUpsertLocation, useDeleteLocation, type CoreLocation } from "@/hooks/useCoreLocations";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

const empty = (): Partial<CoreLocation> => ({
  name: "",
  type: "sede",
  is_main: false,
  status: "activa",
  notes: "",
});

export default function LocationsTab() {
  const { data: locations = [], isLoading } = useCoreLocations();
  const upsert = useUpsertLocation();
  const del = useDeleteLocation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<CoreLocation>>(empty());

  const onSave = async () => {
    if (!form.name?.trim()) {
      toast({ title: "Nombre requerido", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync(form as any);
      toast({ title: form.id ? "Ubicación actualizada" : "Ubicación creada" });
      setOpen(false);
      setForm(empty());
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 rounded-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">Sedes y ubicaciones</h3>
          <p className="text-sm text-muted-foreground">El stock se mueve desde la sede principal.</p>
        </div>
        <Button onClick={() => { setForm(empty()); setOpen(true); }} variant="brand">
          <Plus className="h-4 w-4 mr-2" /> Nueva ubicación
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Principal</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={5} className="text-muted-foreground">Cargando…</TableCell></TableRow>
          )}
          {locations.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">
                {l.name}
                {l.notes && <p className="text-xs text-muted-foreground mt-0.5">{l.notes}</p>}
              </TableCell>
              <TableCell><Badge variant="outline">{l.type}</Badge></TableCell>
              <TableCell>{l.is_main ? <Badge>Sí</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell>
                <Badge variant={l.status === "activa" ? "default" : "secondary"}>{l.status}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button size="icon" variant="ghost" onClick={() => { setForm(l); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => {
                  if (confirm(`¿Eliminar "${l.name}"?`)) del.mutate(l.id);
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar ubicación" : "Nueva ubicación"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type ?? "sede"} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sede">Sede</SelectItem>
                    <SelectItem value="transito">Tránsito</SelectItem>
                    <SelectItem value="futura">Futura sede</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.status ?? "activa"} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activa">Activa</SelectItem>
                    <SelectItem value="inactiva">Inactiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/60">
              <Label>Es sede principal</Label>
              <Switch checked={Boolean(form.is_main)} onCheckedChange={(v) => setForm({ ...form, is_main: v })} />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="brand" onClick={onSave} disabled={upsert.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
