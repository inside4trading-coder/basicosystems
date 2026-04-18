import { useEffect, useState } from "react";
import { Plus, MessageSquare, ArrowRight, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Interaction } from "@/types/rrpp";

const db = supabase as any;

const INTERACTION_TYPES = [
  "DM enviado", "Respuesta recibida", "Llamada", "Reunión",
  "Propuesta enviada", "Recordatorio", "Seguimiento", "Cierre",
];

const CHANNELS = ["Instagram", "WhatsApp", "Email", "Llamada", "Reunión", "TikTok", "Otro"];

const TYPE_COLORS: Record<string, string> = {
  "DM enviado": "bg-blue-500",
  "Respuesta recibida": "bg-green-500",
  "Llamada": "bg-purple-500",
  "Reunión": "bg-yellow-500",
  "Propuesta enviada": "bg-orange-500",
  "Recordatorio": "bg-pink-500",
  "Seguimiento": "bg-cyan-500",
  "Cierre": "bg-primary",
};

interface Props {
  contactId: string;
}

function relativeDate(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} meses`;
  return `Hace ${Math.floor(days / 365)} años`;
}

export function RRPPInteractions({ contactId }: Props) {
  const [items, setItems] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSheet, setOpenSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: today,
    type: "",
    channel: "",
    summary: "",
    result: "",
    next_action: "",
    responsible: "",
    observation: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("rrpp_interactions")
      .select("*")
      .eq("contact_id", contactId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Interaction[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [contactId]);

  async function logAudit(newValue: string) {
    const { data: u } = await supabase.auth.getUser();
    await db.from("rrpp_audit_log").insert({
      contact_id: contactId,
      action: "interaction_add",
      field_changed: "interactions",
      new_value: newValue,
      performed_by: u.user?.email ?? u.user?.id ?? "system",
    });
  }

  const handleSave = async () => {
    if (!form.type) return toast.error("Selecciona un tipo");
    if (!form.summary.trim()) return toast.error("El resumen es requerido");
    if (form.summary.length > 150) return toast.error("Máximo 150 caracteres en el resumen");
    setSaving(true);
    try {
      const { error } = await db.from("rrpp_interactions").insert({
        contact_id: contactId,
        date: form.date,
        type: form.type,
        channel: form.channel,
        summary: form.summary.trim(),
        result: form.result.trim(),
        next_action: form.next_action.trim(),
        responsible: form.responsible.trim(),
        observation: form.observation.trim(),
      });
      if (error) throw error;
      await logAudit(`${form.type}: ${form.summary}`);
      toast.success("Interacción registrada");
      setOpenSheet(false);
      setForm({
        date: today, type: "", channel: "", summary: "",
        result: "", next_action: "", responsible: "", observation: "",
      });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="kpi-card text-muted-foreground text-sm">Cargando interacciones…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          <SheetTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Registrar interacción</Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader><SheetTitle>Nueva interacción</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="mt-1" />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
                  <SelectContent>
                    {INTERACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canal</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona canal" /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Resumen * ({form.summary.length}/150)</Label>
                <Input value={form.summary} maxLength={150}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Resultado</Label>
                <Input value={form.result} maxLength={200}
                  onChange={(e) => setForm({ ...form, result: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Próxima acción</Label>
                <Input value={form.next_action} maxLength={200}
                  onChange={(e) => setForm({ ...form, next_action: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Responsable</Label>
                <Input value={form.responsible} maxLength={80}
                  onChange={(e) => setForm({ ...form, responsible: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Observación</Label>
                <Textarea rows={3} maxLength={500} value={form.observation}
                  onChange={(e) => setForm({ ...form, observation: e.target.value })} className="mt-1" />
              </div>
            </div>
            <SheetFooter className="mt-6">
              <Button variant="ghost" onClick={() => setOpenSheet(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {items.length === 0 ? (
        <div className="kpi-card text-center py-16">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Sin interacciones registradas</p>
          <p className="text-sm text-muted-foreground mt-1">
            Registra la primera interacción con este contacto.
          </p>
        </div>
      ) : (
        <TooltipProvider>
          <div className="space-y-3">
            {items.map((it) => {
              const dot = TYPE_COLORS[it.type] ?? "bg-muted-foreground";
              return (
                <div key={it.id} className="kpi-card">
                  <div className="flex items-start gap-3">
                    <div className={`h-3 w-3 rounded-full mt-1.5 shrink-0 ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                          {it.type}
                        </span>
                        {it.channel && (
                          <span className="text-[10px] font-medium uppercase tracking-wide bg-muted text-muted-foreground px-2 py-0.5 rounded">
                            {it.channel}
                          </span>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {relativeDate(it.date)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{new Date(it.date).toLocaleString()}</TooltipContent>
                        </Tooltip>
                      </div>
                      {it.summary && <p className="font-semibold text-sm">{it.summary}</p>}
                      {it.result && <p className="text-sm text-muted-foreground mt-1">→ {it.result}</p>}
                      {it.next_action && (
                        <p className="text-sm text-foreground mt-1 flex items-center gap-1">
                          <ArrowRight className="h-3.5 w-3.5" /> {it.next_action}
                        </p>
                      )}
                      {it.observation && (
                        <p className="text-xs italic text-muted-foreground mt-2">"{it.observation}"</p>
                      )}
                      {it.responsible && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <UserIcon className="h-3 w-3" /> {it.responsible}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
