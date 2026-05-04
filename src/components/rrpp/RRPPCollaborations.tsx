import { useEffect, useState } from "react";
import { Plus, Package, Check, X, Tag as TagIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { fetchConfig } from "@/hooks/useRRPPData";
import type { Collaboration, RelationshipStatus } from "@/types/rrpp";
import { useRRPPPermissions } from "./useRRPPPermissions";

const db = supabase as any;
const DEFAULT_NETWORKS = ["Instagram", "TikTok", "YouTube", "X", "Facebook", "LinkedIn"];

const STATUS_RANK: Record<string, number> = {
  nuevo: 0,
  contactado: 1,
  producto_enviado: 2,
  colaboracion_en_curso: 3,
};
const TERMINAL_STATUSES = new Set(["colaboracion_exitosa", "no_colaboro", "descartado"]);

interface Props { contactId: string; onPipelineChanged?: () => void; }

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  send_date: today(),
  products: "",
  received: false,
  collab_done: false,
  has_coupon: false,
  coupon_code: "",
  coupon_revenue: 0,
  network_posted: "",
  post_date: today(),
  post_observation: "",
  observations: "",
});

export function RRPPCollaborations({ contactId, onPipelineChanged }: Props) {
  const perms = useRRPPPermissions();
  const [items, setItems] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [networks, setNetworks] = useState<string[]>(DEFAULT_NETWORKS);
  const [openSheet, setOpenSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("rrpp_collaborations")
      .select("*")
      .eq("contact_id", contactId)
      .order("send_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Collaboration[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    fetchConfig("network").then((rows) => {
      const fromCfg = rows.map((r) => r.value);
      if (fromCfg.length) setNetworks(Array.from(new Set([...fromCfg, ...DEFAULT_NETWORKS])));
    }).catch(() => {});
    // eslint-disable-next-line
  }, [contactId]);

  async function logAudit(action: string, newValue: string) {
    const { data: u } = await supabase.auth.getUser();
    await db.from("rrpp_audit_log").insert({
      contact_id: contactId,
      action,
      field_changed: "collaborations",
      new_value: newValue,
      performed_by: u.user?.email ?? u.user?.id ?? "system",
    });
  }

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOpenSheet(true);
  };

  const openEdit = (c: Collaboration) => {
    setEditingId(c.id);
    setForm({
      send_date: c.send_date ?? today(),
      products: c.products ?? "",
      received: !!c.received,
      collab_done: !!c.collab_done,
      has_coupon: !!c.has_coupon,
      coupon_code: c.coupon_code ?? "",
      coupon_revenue: Number(c.coupon_revenue ?? 0),
      network_posted: c.network_posted ?? "",
      post_date: c.post_date ?? today(),
      post_observation: c.post_observation ?? "",
      observations: c.observations ?? "",
    });
    setOpenSheet(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        send_date: form.send_date || null,
        products: form.products.trim(),
        received: form.received,
        collab_done: form.collab_done,
        has_coupon: form.has_coupon,
        coupon_code: form.has_coupon ? form.coupon_code.trim() : "",
        coupon_revenue: form.has_coupon ? Number(form.coupon_revenue) || 0 : 0,
        network_posted: form.collab_done ? form.network_posted : "",
        post_date: form.collab_done ? form.post_date || null : null,
        post_observation: form.collab_done ? form.post_observation.trim() : "",
        observations: form.observations.trim(),
      };

      if (editingId) {
        const { error } = await db.from("rrpp_collaborations").update(payload).eq("id", editingId);
        if (error) throw error;
        await logAudit("collaboration_update", `Editada (envío ${payload.send_date ?? "—"})`);
        toast.success("Colaboración actualizada");
      } else {
        const { error } = await db.from("rrpp_collaborations").insert({ ...payload, contact_id: contactId });
        if (error) throw error;
        await logAudit("collaboration_add", `Envío ${payload.send_date ?? "—"}${form.has_coupon ? ` · cupón ${form.coupon_code}` : ""}`);
        toast.success("Colaboración registrada");
      }

      // Auto-advance pipeline if applicable
      try {
        let target: RelationshipStatus | null = null;
        if (payload.collab_done) target = "colaboracion_en_curso";
        else if (payload.received || payload.send_date) target = "producto_enviado";

        if (target) {
          const { data: contactRow } = await db
            .from("rrpp_contacts").select("relationship_status").eq("id", contactId).maybeSingle();
          const current = contactRow?.relationship_status as string | undefined;
          if (current && !TERMINAL_STATUSES.has(current)) {
            const curRank = STATUS_RANK[current] ?? 0;
            const newRank = STATUS_RANK[target] ?? 0;
            if (newRank > curRank) {
              await db.from("rrpp_contacts").update({ relationship_status: target }).eq("id", contactId);
              await logAudit("auto_status_change", `${current} → ${target} (auto: colaboración registrada)`);
              onPipelineChanged?.();
            }
          }
        }
      } catch { /* non-fatal */ }

      setOpenSheet(false);
      setEditingId(null);
      setForm(emptyForm());
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Collaboration) => {
    const { error } = await db.from("rrpp_collaborations").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    await logAudit("collaboration_delete", `Envío ${c.send_date ?? "—"}`);
    toast.success("Colaboración eliminada");
    load();
  };

  if (loading) return <div className="kpi-card text-muted-foreground text-sm">Cargando colaboraciones…</div>;

  return (
    <div className="space-y-4">
      {perms.canManageCollaborations && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />Registrar colaboración
          </Button>
        </div>
      )}

      <Sheet open={openSheet} onOpenChange={(v) => { setOpenSheet(v); if (!v) setEditingId(null); }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Editar colaboración" : "Nueva colaboración"}</SheetTitle>
          </SheetHeader>
          <p className="text-xs text-muted-foreground mt-2">
            Solo es necesario rellenar lo que ya tengas. Puedes editar más tarde para añadir cupón, ingresos o datos del post.
          </p>
          <div className="space-y-4 mt-6">
            <div>
              <Label>Fecha de envío</Label>
              <Input type="date" value={form.send_date}
                onChange={(e) => setForm({ ...form, send_date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Productos enviados</Label>
              <Textarea rows={2} maxLength={500} value={form.products}
                placeholder="Opcional"
                onChange={(e) => setForm({ ...form, products: e.target.value })} className="mt-1" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label className="cursor-pointer">Recibido</Label>
              <Switch checked={form.received} onCheckedChange={(v) => setForm({ ...form, received: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label className="cursor-pointer">Colaboración realizada</Label>
              <Switch checked={form.collab_done} onCheckedChange={(v) => setForm({ ...form, collab_done: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label className="cursor-pointer">Tiene cupón</Label>
              <Switch checked={form.has_coupon} onCheckedChange={(v) => setForm({ ...form, has_coupon: v })} />
            </div>

            {form.has_coupon && (
              <div className="space-y-3 pl-3 border-l-2 border-primary/40">
                <div>
                  <Label>Código de cupón</Label>
                  <Input value={form.coupon_code} maxLength={60}
                    onChange={(e) => setForm({ ...form, coupon_code: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Ingresos generados</Label>
                  <Input type="number" min={0} step="0.01" value={form.coupon_revenue}
                    onChange={(e) => setForm({ ...form, coupon_revenue: Number(e.target.value) })} className="mt-1" />
                </div>
              </div>
            )}

            {form.collab_done && (
              <div className="space-y-3 pl-3 border-l-2 border-primary/40">
                <div>
                  <Label>Red donde se publicó</Label>
                  <Select value={form.network_posted} onValueChange={(v) => setForm({ ...form, network_posted: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona red" /></SelectTrigger>
                    <SelectContent>
                      {networks.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha del post</Label>
                  <Input type="date" value={form.post_date}
                    onChange={(e) => setForm({ ...form, post_date: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Observación del post</Label>
                  <Textarea rows={2} maxLength={500} value={form.post_observation}
                    onChange={(e) => setForm({ ...form, post_observation: e.target.value })} className="mt-1" />
                </div>
              </div>
            )}

            <div>
              <Label>Observaciones</Label>
              <Textarea rows={3} maxLength={1000} value={form.observations}
                onChange={(e) => setForm({ ...form, observations: e.target.value })} className="mt-1" />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="ghost" onClick={() => { setOpenSheet(false); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Actualizar" : "Guardar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {items.length === 0 ? (
        <div className="kpi-card text-center py-16">
          <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Sin colaboraciones registradas</p>
          <p className="text-sm text-muted-foreground mt-1">
            Registra la primera colaboración con este contacto.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className="kpi-card">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Envío</p>
                  <p className="font-semibold">{c.send_date ? new Date(c.send_date).toLocaleDateString() : "—"}</p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <StatusPill on={c.received} label="Recibido" />
                  <StatusPill on={c.collab_done} label="Colaboración hecha" />
                  {c.has_coupon && <StatusPill on label="Cupón" />}
                  {perms.canManageCollaborations && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar colaboración?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará permanentemente este registro. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(c)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>

              {c.products && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">Productos</p>
                  <p className="text-sm">{c.products}</p>
                </div>
              )}

              {c.has_coupon && (
                <div className="mt-3 grid grid-cols-2 gap-3 p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TagIcon className="h-3 w-3" /> Cupón
                    </p>
                    <p className="text-sm font-mono font-semibold">{c.coupon_code || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ingresos</p>
                    <p className="text-sm font-semibold">${Number(c.coupon_revenue ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {c.collab_done && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground">Red</p>
                    <p className="text-sm">{c.network_posted || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha del post</p>
                    <p className="text-sm">{c.post_date ? new Date(c.post_date).toLocaleDateString() : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Observación post</p>
                    <p className="text-sm">{c.post_observation || "—"}</p>
                  </div>
                </div>
              )}

              {c.observations && (
                <p className="text-sm italic text-muted-foreground mt-3">"{c.observations}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded inline-flex items-center gap-1 ${
      on ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"
    }`}>
      {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {label}
    </span>
  );
}
