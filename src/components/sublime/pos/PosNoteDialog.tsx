import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Nota general de la venta: viaja al historial, al detalle y a la factura. */
export function PosNoteDialog({
  open,
  onOpenChange,
  note,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  note: string;
  onSave: (n: string) => void;
}) {
  const [draft, setDraft] = useState(note);

  useEffect(() => {
    if (open) setDraft(note);
  }, [open, note]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nota del pedido</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Se mostrará en el historial, en el detalle de la venta y en la factura.
        </p>
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          placeholder="Entrega el sábado, cliente pasa por la tienda…"
        />
        <div className="flex gap-2">
          {note ? (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                onSave("");
                onOpenChange(false);
              }}
            >
              Quitar nota
            </Button>
          ) : null}
          <Button
            className="flex-1 font-black"
            onClick={() => {
              onSave(draft.trim());
              onOpenChange(false);
            }}
          >
            GUARDAR NOTA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
