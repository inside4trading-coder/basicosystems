import { useState } from "react";
import { Lock, User, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/hooks/useCrewAudit";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PrivateNote {
  id: string;
  employee_id: string;
  note_type: string;
  content: string;
  privacy_level: string;
  author: string | null;
  created_at: string;
}

const noteTypes = ["Observación", "Advertencia", "Reconocimiento", "Seguimiento", "Legal", "Otro"];
const privacyLevels = ["Solo admins", "Restringido"];

export function CrewPrivateNotes({ employeeId }: { employeeId: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["private_notes", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("private_notes")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PrivateNote[];
    },
  });

  const insertMutation = useMutation({
    mutationFn: async (note: Omit<PrivateNote, "id" | "created_at">) => {
      const { error } = await supabase.from("private_notes").insert(note);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["private_notes", employeeId] });
      toast.success("Nota guardada");
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("private_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["private_notes", employeeId] });
      toast.success("Nota eliminada");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Warning strip */}
      <div className="bg-muted/80 border border-border rounded-lg px-4 py-2.5 flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs font-semibold text-muted-foreground">🔒 Esta sección es privada y solo visible para administradores.</p>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Agregar nota
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="kpi-card bg-muted/40">
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Lock className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">Sin notas privadas</p>
            <p className="text-xs text-muted-foreground/70">Las notas aquí son confidenciales y solo accesibles por administradores</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="bg-muted/60 border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                  {note.author && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />{note.author}
                    </span>
                  )}
                  <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${
                    note.privacy_level === "Solo admins" ? "border-destructive/50 text-destructive" : "border-yellow-500/50 text-yellow-600"
                  }`}>
                    {note.privacy_level === "Solo admins" ? "Admin" : "Restringido"}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(note.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <span className="text-xs border border-border rounded-full px-2 py-0.5 font-medium inline-block">{note.note_type}</span>
              <p className="text-sm">{note.content}</p>
            </div>
          ))}
        </div>
      )}

      <AddNoteSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        employeeId={employeeId}
        onSave={(data) => insertMutation.mutate(data)}
        saving={insertMutation.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta nota?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddNoteSheet({ open, onOpenChange, employeeId, onSave, saving }: {
  open: boolean; onOpenChange: (v: boolean) => void; employeeId: string;
  onSave: (data: Omit<PrivateNote, "id" | "created_at">) => void; saving: boolean;
}) {
  const [noteType, setNoteType] = useState("");
  const [content, setContent] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState("Solo admins");
  const [author, setAuthor] = useState("");

  const reset = () => { setNoteType(""); setContent(""); setPrivacyLevel("Solo admins"); setAuthor(""); };

  const handleSave = () => {
    if (!noteType) { toast.error("Selecciona un tipo de nota"); return; }
    if (content.trim().length < 10) { toast.error("El contenido debe tener al menos 10 caracteres"); return; }
    onSave({
      employee_id: employeeId,
      note_type: noteType,
      content: content.trim(),
      privacy_level: privacyLevel,
      author: author.trim() || null,
    });
    reset();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Agregar nota privada</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de nota</label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
              <SelectContent>
                {noteTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contenido</label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="mt-1" rows={5} placeholder="Mínimo 10 caracteres" />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{content.length} caracteres</p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nivel de privacidad</label>
            <Select value={privacyLevel} onValueChange={setPrivacyLevel}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {privacyLevels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Autor</label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1" placeholder="Tu nombre" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Guardando…" : "Guardar nota"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
