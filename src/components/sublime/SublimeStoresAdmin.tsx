import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSublimeStores } from "@/hooks/useSublimeClock";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, Plus, Loader2, Save, Power } from "lucide-react";
import { toast } from "sonner";
import type { SublimeStore } from "@/types/sublime";

interface StoreFormState {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  radius_meters: string;
  active: boolean;
}

const emptyForm: StoreFormState = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radius_meters: "75",
  active: true,
};

function toForm(s: SublimeStore): StoreFormState {
  return {
    name: s.name,
    address: s.address ?? "",
    latitude: s.latitude != null ? String(s.latitude) : "",
    longitude: s.longitude != null ? String(s.longitude) : "",
    radius_meters: String(s.radius_meters ?? 75),
    active: s.active,
  };
}

function parseForm(f: StoreFormState) {
  const lat = f.latitude.trim() === "" ? null : Number(f.latitude);
  const lng = f.longitude.trim() === "" ? null : Number(f.longitude);
  const radius = Number(f.radius_meters);
  if (lat != null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
    throw new Error("Latitud inválida");
  }
  if (lng != null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
    throw new Error("Longitud inválida");
  }
  if (Number.isNaN(radius) || radius <= 0 || radius > 5000) {
    throw new Error("Radio inválido (1–5000 m)");
  }
  return {
    name: f.name.trim(),
    address: f.address.trim() || null,
    latitude: lat,
    longitude: lng,
    radius_meters: Math.round(radius),
    active: f.active,
  };
}

function StoreEditor({
  store,
  onSave,
  canEdit,
}: {
  store: SublimeStore;
  onSave: (id: string, patch: Partial<SublimeStore>) => Promise<void>;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<StoreFormState>(toForm(store));
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(toForm(store)), [store]);

  const dirty = JSON.stringify(toForm(store)) !== JSON.stringify(form);

  const set = <K extends keyof StoreFormState>(k: K, v: StoreFormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    try {
      setSaving(true);
      const patch = parseForm(form);
      await onSave(store.id, patch);
      toast.success("Tienda actualizada");
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (active: boolean) => {
    set("active", active);
    try {
      await onSave(store.id, { active });
    } catch (e: any) {
      toast.error(e.message ?? "Error al actualizar estado");
      set("active", !active);
    }
  };

  return (
    <Card className="rounded-2xl border-border/60 p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{store.name || "Sin nombre"}</h3>
            <p className="text-xs text-muted-foreground truncate">{store.address || "Sin dirección"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={store.active ? "default" : "secondary"} className="rounded-lg">
            {store.active ? "Activa" : "Inactiva"}
          </Badge>
          {canEdit && (
            <Switch
              checked={form.active}
              onCheckedChange={handleToggleActive}
              aria-label="Activa"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Nombre de tienda</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Dirección</Label>
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-1.5">
          <Label>Latitud</Label>
          <Input
            inputMode="decimal"
            placeholder="10.067667"
            value={form.latitude}
            onChange={(e) => set("latitude", e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Longitud</Label>
          <Input
            inputMode="decimal"
            placeholder="-69.313389"
            value={form.longitude}
            onChange={(e) => set("longitude", e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Radio permitido (m)</Label>
          <Input
            inputMode="numeric"
            value={form.radius_meters}
            onChange={(e) => set("radius_meters", e.target.value)}
            disabled={!canEdit}
          />
          <p className="text-xs text-muted-foreground">
            Distancia máxima desde la tienda para validar fichaje automático.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
            <Power className={`h-4 w-4 ${form.active ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-sm">{form.active ? "Activa" : "Inactiva"}</span>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!dirty || saving} className="rounded-xl">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar cambios
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function SublimeStoresAdmin() {
  const { stores, loading, createStore, updateStore } = useSublimeStores();
  const { role } = useAuth();
  const canEdit = role === "admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<StoreFormState>(emptyForm);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const patch = parseForm(form);
      if (!patch.name) throw new Error("El nombre es obligatorio");
      await createStore(patch);
      toast.success("Tienda creada");
      setCreateOpen(false);
      setForm(emptyForm);
    } catch (e: any) {
      toast.error(e.message ?? "Error al crear tienda");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Tiendas de fichaje</h2>
          <p className="text-sm text-muted-foreground">
            Las coordenadas y el radio determinan dónde se permite fichar.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Nueva tienda
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : stores.length === 0 ? (
        <Card className="rounded-2xl border-border/60 p-10 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No hay tiendas configuradas</h3>
          <p className="text-sm text-muted-foreground">
            Crea la primera tienda para habilitar el fichaje del equipo.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stores.map((s) => (
            <StoreEditor key={s.id} store={s} onSave={updateStore} canEdit={canEdit} />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nueva tienda</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Dirección</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Latitud</Label>
              <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Longitud</Label>
              <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Radio (m)</Label>
              <Input value={form.radius_meters} onChange={(e) => setForm({ ...form, radius_meters: e.target.value })} />
            </div>
            <div className="space-y-1.5 flex flex-col">
              <Label>Activa</Label>
              <div className="flex items-center h-10">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="rounded-xl">
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear tienda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
