import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";

/** Nota de producción propia de UNA solicitud de fabricación (no del producto global). */
export default function FabricationNoteDialog({
  open,
  onOpenChange,
  requestId,
  productName,
  initialNote,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: string | null;
  productName?: string | null;
  initialNote: string | null;
  onSaved: (note: string | null) => void;
}) {
  const [note, setNote] = useState(initialNote || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setNote(initialNote || ""); }, [open, initialNote]);

  const persist = async (value: string | null) => {
    if (!requestId) return;
    setSaving(true);
    const { error } = await supabase
      .from("esp_fabrication_requests")
      .update({ notes: value })
      .eq("id", requestId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(value ? "Nota guardada" : "Nota eliminada");
    onSaved(value);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-primary" /> Nota de producción
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {productName && <p className="text-xs text-muted-foreground">{productName}</p>}
          <Label className="text-xs">Nota de producción (opcional)</Label>
          <Textarea
            value={note}
            rows={4}
            maxLength={1000}
            placeholder="Ej. usar blank XL y ajustar antes de estampar"
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">Esta nota pertenece solo a esta solicitud de fabricación.</p>
        </div>
        <DialogFooter className="gap-2">
          {initialNote && (
            <Button variant="ghost" className="text-destructive mr-auto" disabled={saving} onClick={() => persist(null)}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving} onClick={() => persist(note.trim() || null)}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
