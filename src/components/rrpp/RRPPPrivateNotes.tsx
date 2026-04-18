import { useEffect, useState } from "react";
import { Plus, Lock, Trash2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { PrivateNote } from "@/types/rrpp";
import { useRRPPPermissions } from "./useRRPPPermissions";

const db = supabase as any;
const NOTE_TYPES = ["Observación", "Advertencia", "Estratégica", "Compromiso", "Riesgo"];
const PRIVACY_LEVELS = ["Solo admins", "Solo RRPP", "Equipo RRPP + Marketing"];

interface Props { contactId: string; }

export function RRPPPrivateNotes({ contactId }: Props) {
  const perms = useRRPPPermissions();
  const { user } = useAuth();
  const [notes, setNotes] = useState<PrivateNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSheet, setOpenSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    note_type: "Observación",
    content: "",
    privacy_level: "Solo admins",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("rrpp_private_notes")
      .select("*")
      .eq("contact_id", contactId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setNotes((data ?? []) as PrivateNote[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [contactId]);

  async function logAudit(action: string, noteType: string) {
    const { data: u } = await supabase.auth.getUser();
    // IMPORTANT: never log content of private notes
    await db.from("rrpp_audit_log").insert({
      contact_id: contactId,
      action,
      field_changed: "private_notes",
      new_value: noteType,
      performed_by: u.user?.email ?? u.user?.id ?? "system",
    });
  }

  const handleSave = async () => {
    if (form.content.trim().length < 10) {
      return toast.error("La nota debe tener al menos 10 caracteres");
    }
    setSaving(true);
    try {
      const author = user?.email ?? user?.id ?? "system";
      const { error } = await db.from("rrpp_private_notes").insert({
        contact_id: contactId,
        note_type: form.note_type,
        content: form.content.trim(),
        privacy_level: form.privacy_level,
        author,
      });
      if (error) throw error;
      await logAudit("private_note_add", form.note_type);
      toast.success("Nota agregada");
      setOpenSheet(false);
      setForm({ note_type: "Observación", content: "", privacy_level: "Solo admins" });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note: PrivateNote) => {
    const { error } = await db.from("rrpp_private_notes").delete().eq("id", note.id);
    if (error) return toast.error(error.message);
    await logAudit("private_note_delete", note.note_type);
    toast.success("Nota eliminada");
    load();
  };

  if (loading) return <div className="kpi-card text-muted-foreground text-sm">Cargando notas…</div>;

  return (
    <div className="space-y-4">
      <div className="kpi-card border-l-4 border-l-yellow-500 bg-yellow-500/5">
        <p className="text-sm flex items-start gap-2">
          <Lock className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
          <span>
            <strong>Esta sección es privada.</strong> Solo visible para admins y roles autorizados.
            El contenido nunca se registra en el historial de auditoría.
          </span>
        </p>
      </div>

      {perms.canAddPrivateNote && (
        <div className="flex justify-end">
          <Sheet open={openSheet} onOpenChange={setOpenSheet}>
            <SheetTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Agregar nota</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader><SheetTitle>Nueva nota privada</SheetTitle></SheetHeader>
              <div className="space-y-4 mt-6">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.note_type} onValueChange={(v) => setForm({ ...form, note_type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NOTE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contenido * (mín. 10 caracteres)</Label>
                  <Textarea rows={6} maxLength={2000} value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })} className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">{form.content.length}/2000</p>
                </div>
                <div>
                  <Label>Nivel de privacidad</Label>
                  <Select value={form.privacy_level} onValueChange={(v) => setForm({ ...form, privacy_level: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIVACY_LEVELS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground">
                  Autor: {user?.email ?? "—"}
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

      {notes.length === 0 ? (
        <div className="kpi-card text-center py-16">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Sin notas privadas</p>
          <p className="text-sm text-muted-foreground mt-1">
            Agrega la primera nota confidencial para este contacto.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="kpi-card">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.date).toLocaleDateString()}
                  </span>
                  {n.author && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <UserIcon className="h-3 w-3" /> {n.author}
                    </span>
                  )}
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                    {n.note_type}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" /> {n.privacy_level}
                  </span>
                </div>
                {perms.canDeletePrivateNote && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar nota?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(n)}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
