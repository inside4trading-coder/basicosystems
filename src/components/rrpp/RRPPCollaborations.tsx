import { useEffect, useState } from "react";
import { Plus, Package, Check, X, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchConfig } from "@/hooks/useRRPPData";
import type { Collaboration } from "@/types/rrpp";
import { useRRPPPermissions } from "./useRRPPPermissions";

const db = supabase as any;
const DEFAULT_NETWORKS = ["Instagram", "TikTok", "YouTube", "X", "Facebook", "LinkedIn"];

interface Props { contactId: string; }

export function RRPPCollaborations({ contactId }: Props) {
  const perms = useRRPPPermissions();
  const [items, setItems] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [networks, setNetworks] = useState<string[]>(DEFAULT_NETWORKS);
  const [openSheet, setOpenSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    send_date: today,
    products: "",
    received: false,
    collab_done: false,
    has_coupon: false,
    coupon_code: "",
    coupon_revenue: 0,
    network_posted: "",
    post_date: today,
    post_observation: "",
    observations: "",
  });

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

  async function logAudit(newValue: string) {
    const { data: u } = await supabase.auth.getUser();
    await db.from("rrpp_audit_log").insert({
      contact_id: contactId,
      action: "collaboration_add",
      field_changed: "collaborations",
      new_value: newValue,
      performed_by: u.user?.email ?? u.user?.id ?? "system",
    });
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        contact_id: contactId,
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
      const { error } = await db.from("rrpp_collaborations").insert(payload);
      if (error) throw error;
      await logAudit(`Envío ${form.send_date}${form.has_coupon ? ` · cupón ${form.coupon_code}` : ""}`);
      toast.success("Colaboración registrada");
      setOpenSheet(false);
      setForm({
        send_date: today, products: "", received: false, collab_done: false,
        has_coupon: false, coupon_code: "", coupon_revenue: 0,
        network_posted: "", post_date: today, post_observation: "", observations: "",
      });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="kpi-card text-muted-foreground text-sm">Cargando colaboraciones…</div>;

  return (
    <div className="space-y-4">
      {perms.canManageCollaborations && (
        <div className="flex justify-end">
          <Sheet open={openSheet} onOpenChange={setOpenSheet}>
            <SheetTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Registrar colaboración</Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader><SheetTitle>Nueva colaboración</SheetTitle></SheetHeader>
              <div className="space-y-4 mt-6">
                <div>
                  <Label>Fecha de envío</Label>
                  <Input type="date" value={form.send_date}
                    onChange={(e) => setForm({ ...form, send_date: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Productos enviados</Label>
                  <Textarea rows={2} maxLength={500} value={form.products}
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
                <Button variant="ghost" onClick={() => setOpenSheet(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      )}

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
                <div className="flex gap-2 flex-wrap">
                  <StatusPill on={c.received} label="Recibido" />
                  <StatusPill on={c.collab_done} label="Colaboración hecha" />
                  {c.has_coupon && <StatusPill on label="Cupón" />}
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
