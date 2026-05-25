import { useEffect, useState } from "react";
import { Plus, Package, Check, Tag as TagIcon, Pencil, Trash2, ShoppingBag, Truck, Megaphone, Trophy, ExternalLink, FileDown, Info } from "lucide-react";
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
import type { RRPPBrand } from "@/hooks/useRRPPBrand";
import { useRRPPPermissions } from "./useRRPPPermissions";
import { cn } from "@/lib/utils";
import { generateShippingPdf } from "@/lib/rrppShippingPdf";

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

interface Props {
  contactId: string;
  brand?: RRPPBrand;
  contactName?: string;
  contactAlias?: string;
  onPipelineChanged?: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  // Step 1 - Pedido
  send_date: today(),
  products: "",
  order_details: "",
  // Step 2 - Envío (destinatario)
  shipping_name: "",
  shipping_last_name: "",
  shipping_id_number: "",
  shipping_email: "",
  shipping_phone: "",
  shipping_postal_code: "",
  shipping_address: "",
  shipping_city: "",
  shipping_country: "",
  // Step 2.1 - Confirmación de envío
  tracking_number: "",
  shipped_at: "",
  received: false,
  // Cupón
  has_coupon: false,
  coupon_code: "",
  coupon_revenue: 0,
  // Step 3 - Publicación
  collab_done: false,
  network_posted: "",
  post_date: today(),
  post_url: "",
  post_observation: "",
  published_at: "",
  observations: "",
});

type Stage = 1 | 2 | 3 | 4;
const STAGES: { n: Stage; label: string; icon: any }[] = [
  { n: 1, label: "Pedido", icon: ShoppingBag },
  { n: 2, label: "Envío", icon: Truck },
  { n: 3, label: "Publicación", icon: Megaphone },
  { n: 4, label: "Exitosa", icon: Trophy },
];

function computeStage(c: Partial<Collaboration>): Stage {
  if (c.published_at || (c.collab_done && c.post_date)) return 4;
  if (c.collab_done) return 3;
  if (c.shipped_at || c.tracking_number || c.received) return 2;
  return 1;
}

export function RRPPCollaborations({ contactId, brand = "basico_ve", contactName = "", contactAlias = "", onPipelineChanged }: Props) {
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
      order_details: c.order_details ?? "",
      shipping_name: c.shipping_name ?? "",
      shipping_last_name: c.shipping_last_name ?? "",
      shipping_id_number: c.shipping_id_number ?? "",
      shipping_email: c.shipping_email ?? "",
      shipping_phone: c.shipping_phone ?? "",
      shipping_postal_code: c.shipping_postal_code ?? "",
      shipping_address: c.shipping_address ?? "",
      shipping_city: c.shipping_city ?? "",
      shipping_country: c.shipping_country ?? "",
      tracking_number: c.tracking_number ?? "",
      shipped_at: c.shipped_at ? c.shipped_at.slice(0, 10) : "",
      received: !!c.received,
      has_coupon: !!c.has_coupon,
      coupon_code: c.coupon_code ?? "",
      coupon_revenue: Number(c.coupon_revenue ?? 0),
      collab_done: !!c.collab_done,
      network_posted: c.network_posted ?? "",
      post_date: c.post_date ?? today(),
      post_url: c.post_url ?? "",
      post_observation: c.post_observation ?? "",
      published_at: c.published_at ? c.published_at.slice(0, 10) : "",
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
        order_details: form.order_details.trim(),
        shipping_name: form.shipping_name.trim(),
        shipping_last_name: form.shipping_last_name.trim(),
        shipping_id_number: form.shipping_id_number.trim(),
        shipping_email: form.shipping_email.trim(),
        shipping_phone: form.shipping_phone.trim(),
        shipping_postal_code: form.shipping_postal_code.trim(),
        shipping_address: form.shipping_address.trim(),
        shipping_city: form.shipping_city.trim(),
        shipping_country: form.shipping_country.trim(),
        tracking_number: form.tracking_number.trim(),
        shipped_at: form.shipped_at || null,
        received: form.received,
        collab_done: form.collab_done,
        has_coupon: form.has_coupon,
        coupon_code: form.has_coupon ? form.coupon_code.trim() : "",
        coupon_revenue: form.has_coupon ? Number(form.coupon_revenue) || 0 : 0,
        network_posted: form.collab_done ? form.network_posted : "",
        post_date: form.collab_done ? form.post_date || null : null,
        post_url: form.collab_done ? form.post_url.trim() : "",
        post_observation: form.collab_done ? form.post_observation.trim() : "",
        published_at: form.collab_done ? (form.published_at || null) : null,
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
        if (payload.published_at || (payload.collab_done && payload.post_date)) target = "colaboracion_exitosa" as any;
        else if (payload.collab_done) target = "colaboracion_en_curso";
        else if (payload.shipped_at || payload.tracking_number || payload.received || payload.send_date) target = "producto_enviado";

        if (target) {
          const { data: contactRow } = await db
            .from("rrpp_contacts").select("relationship_status").eq("id", contactId).maybeSingle();
          const current = contactRow?.relationship_status as string | undefined;
          if (current && !TERMINAL_STATUSES.has(current)) {
            const curRank = STATUS_RANK[current] ?? 0;
            const newRank = target === "colaboracion_exitosa" ? 99 : (STATUS_RANK[target] ?? 0);
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

  const currentStage = computeStage(form);

  return (
    <div className="space-y-4">
      {perms.canManageCollaborations && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />Nueva colaboración
          </Button>
        </div>
      )}

      <Sheet open={openSheet} onOpenChange={(v) => { setOpenSheet(v); if (!v) setEditingId(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{editingId ? "Editar colaboración" : "Nueva colaboración"}</SheetTitle>
          </SheetHeader>

          <div className="mt-4">
            <Stepper stage={currentStage} />
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Estos contactos ya están clasificados y avanzando. Rellena cada paso a medida que ocurra.
          </p>

          <div className="space-y-6 mt-6">
            {/* STEP 1 - PEDIDO */}
            <Section icon={ShoppingBag} title="1. Pedido" active={currentStage >= 1}>
              <div className="rounded-md border-2 border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm font-black text-destructive uppercase tracking-wide">
                  ⚠ NO OLVIDES COLOCAR LA TALLA
                </p>
              </div>
              <div>
                <Label>Fecha de pedido</Label>
                <Input type="date" value={form.send_date}
                  onChange={(e) => setForm({ ...form, send_date: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="font-bold">Productos (incluye TALLA)</Label>
                <Textarea rows={2} maxLength={500} value={form.products}
                  placeholder="Ej. 2 bikinis modelo X — TALLA M"
                  onChange={(e) => setForm({ ...form, products: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Detalles del pedido</Label>
                <Textarea rows={2} maxLength={500} value={form.order_details}
                  placeholder="N° de orden, notas internas, precio, etc."
                  onChange={(e) => setForm({ ...form, order_details: e.target.value })} className="mt-1" />
              </div>
            </Section>

            {/* STEP 2 - ENVÍO (destinatario por marca) */}
            <Section icon={Truck} title="2. Datos de envío" active={currentStage >= 2}>
              <p className="text-xs text-muted-foreground -mt-1">
                {brand === "basico_es"
                  ? "Datos para envío internacional (Básico España / Europa)."
                  : "Datos para envío MRW (Venezuela)."}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nombre</Label>
                  <Input value={form.shipping_name} maxLength={80}
                    onChange={(e) => setForm({ ...form, shipping_name: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Apellido</Label>
                  <Input value={form.shipping_last_name} maxLength={80}
                    onChange={(e) => setForm({ ...form, shipping_last_name: e.target.value })} className="mt-1" />
                </div>
              </div>

              {brand === "basico_es" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Correo</Label>
                      <Input type="email" value={form.shipping_email} maxLength={120}
                        onChange={(e) => setForm({ ...form, shipping_email: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label>Teléfono</Label>
                      <Input value={form.shipping_phone} maxLength={40}
                        onChange={(e) => setForm({ ...form, shipping_phone: e.target.value })} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Código postal</Label>
                      <Input value={form.shipping_postal_code} maxLength={20}
                        onChange={(e) => setForm({ ...form, shipping_postal_code: e.target.value })} className="mt-1" />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Dirección</Label>
                      <Input value={form.shipping_address} maxLength={250}
                        onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} className="mt-1" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Cédula</Label>
                      <Input value={form.shipping_id_number} maxLength={30}
                        onChange={(e) => setForm({ ...form, shipping_id_number: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label>Teléfono</Label>
                      <Input value={form.shipping_phone} maxLength={40}
                        onChange={(e) => setForm({ ...form, shipping_phone: e.target.value })} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label>Dirección oficina MRW</Label>
                    <Input value={form.shipping_address} maxLength={250}
                      placeholder="Ej. MRW Las Mercedes, Av. principal..."
                      onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} className="mt-1" />
                  </div>
                </>
              )}

              {/* PDF helper */}
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Genera el PDF con <b>datos del pedido + envío</b> y envíaselo al equipo de tienda
                    para que preparen el paquete. Guarda primero los cambios para incluir lo más reciente.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={!editingId}
                  onClick={() => {
                    const c = items.find((i) => i.id === editingId);
                    if (!c) return;
                    generateShippingPdf({ collab: c, brand, contactName, contactAlias });
                  }}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  {editingId ? "Descargar PDF para tienda" : "Guarda la colaboración para generar el PDF"}
                </Button>
              </div>

              {/* STEP 2.1 - Confirmación de envío */}
              <div className="rounded-md border border-dashed p-3 space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded">Paso 2.1</span>
                  <h5 className="text-sm font-semibold">Confirmación de envío (tienda / fábrica)</h5>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Número de guía</Label>
                    <Input value={form.tracking_number} maxLength={80}
                      placeholder="Cualquier miembro del equipo puede agregarlo"
                      onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Fecha de envío real</Label>
                    <Input type="date" value={form.shipped_at}
                      onChange={(e) => setForm({ ...form, shipped_at: e.target.value })} className="mt-1" />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label className="cursor-pointer">Recibido por el contacto</Label>
                  <Switch checked={form.received} onCheckedChange={(v) => setForm({ ...form, received: v })} />
                </div>
              </div>
            </Section>


            {/* CUPÓN */}
            <Section icon={TagIcon} title="Cupón (opcional)" active={form.has_coupon}>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label className="cursor-pointer">Tiene cupón</Label>
                <Switch checked={form.has_coupon} onCheckedChange={(v) => setForm({ ...form, has_coupon: v })} />
              </div>
              {form.has_coupon && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Código</Label>
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
            </Section>

            {/* STEP 3 - PUBLICACIÓN */}
            <Section icon={Megaphone} title="3. Publicación" active={currentStage >= 3}>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label className="cursor-pointer">Contenido publicado</Label>
                <Switch checked={form.collab_done} onCheckedChange={(v) => setForm({ ...form, collab_done: v })} />
              </div>
              {form.collab_done && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Red</Label>
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
                  </div>
                  <div>
                    <Label>URL del post</Label>
                    <Input type="url" value={form.post_url} placeholder="https://..."
                      onChange={(e) => setForm({ ...form, post_url: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Observación del post</Label>
                    <Textarea rows={2} maxLength={500} value={form.post_observation}
                      onChange={(e) => setForm({ ...form, post_observation: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Fecha de cierre (marcar como exitosa)</Label>
                    <Input type="date" value={form.published_at}
                      onChange={(e) => setForm({ ...form, published_at: e.target.value })} className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">Al completar esta fecha la colaboración pasa a "Exitosa".</p>
                  </div>
                </div>
              )}
            </Section>

            <div>
              <Label>Observaciones generales</Label>
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
          {items.map((c) => {
            const stage = computeStage(c);
            return (
              <div key={c.id} className="kpi-card">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Pedido</p>
                    <p className="font-semibold">{c.send_date ? new Date(c.send_date).toLocaleDateString() : "—"}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    {c.has_coupon && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded inline-flex items-center gap-1 bg-primary/10 text-primary">
                        <TagIcon className="h-3 w-3" /> Cupón
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => generateShippingPdf({ collab: c, brand, contactName, contactAlias })}
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1" /> PDF tienda
                    </Button>
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

                <div className="mt-4">
                  <Stepper stage={stage} compact />
                </div>

                {(c.products || c.order_details) && (
                  <div className="mt-3 space-y-2">
                    {c.products && (
                      <div>
                        <p className="text-xs text-muted-foreground">Productos</p>
                        <p className="text-sm">{c.products}</p>
                      </div>
                    )}
                    {c.order_details && (
                      <div>
                        <p className="text-xs text-muted-foreground">Detalles del pedido</p>
                        <p className="text-sm">{c.order_details}</p>
                      </div>
                    )}
                  </div>
                )}

                {(c.shipping_name || c.tracking_number || c.shipped_at) && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-md bg-muted/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Destinatario</p>
                      <p className="text-sm">{c.shipping_name || "—"}</p>
                      {(c.shipping_city || c.shipping_country) && (
                        <p className="text-xs text-muted-foreground">{[c.shipping_city, c.shipping_country].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Guía</p>
                      <p className="text-sm font-mono">{c.tracking_number || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Enviado</p>
                      <p className="text-sm">{c.shipped_at ? new Date(c.shipped_at).toLocaleDateString() : "—"}</p>
                    </div>
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
                      <p className="text-xs text-muted-foreground">Post</p>
                      {c.post_url ? (
                        <a href={c.post_url} target="_blank" rel="noreferrer"
                           className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <p className="text-sm">—</p>}
                    </div>
                    {c.post_observation && (
                      <div className="md:col-span-3">
                        <p className="text-xs text-muted-foreground">Observación post</p>
                        <p className="text-sm">{c.post_observation}</p>
                      </div>
                    )}
                  </div>
                )}

                {c.observations && (
                  <p className="text-sm italic text-muted-foreground mt-3">"{c.observations}"</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stepper({ stage, compact = false }: { stage: Stage; compact?: boolean }) {
  return (
    <div className="flex items-center gap-1 w-full">
      {STAGES.map((s, i) => {
        const reached = stage >= s.n;
        const isCurrent = stage === s.n;
        const Icon = s.icon;
        return (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            <div className={cn(
              "flex flex-col items-center gap-1",
              compact ? "" : "min-w-[60px]"
            )}>
              <div className={cn(
                "rounded-full flex items-center justify-center transition-colors",
                compact ? "h-7 w-7" : "h-9 w-9",
                reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}>
                {s.n === 4 && reached
                  ? <Check className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                  : <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />}
              </div>
              <span className={cn(
                "text-[10px] font-medium tracking-wide",
                reached ? "text-foreground" : "text-muted-foreground"
              )}>{s.label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mx-1 mb-5 rounded",
                stage > s.n ? "bg-primary" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({ icon: Icon, title, active, children }: { icon: any; title: string; active: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3 transition-colors",
      active ? "border-primary/40 bg-primary/[0.02]" : "border-border"
    )}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      {children}
    </div>
  );
}
