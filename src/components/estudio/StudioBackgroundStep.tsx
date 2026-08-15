import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BackgroundsTab from "@/components/estudio/config/BackgroundsTab";
import type { StudioBackground } from "@/lib/estudioBackgrounds";
import { cn } from "@/lib/utils";

/** Selector visual de fondos dinámicos. Vive dentro del wizard, no es otra pantalla. */
export function StudioBackgroundStep({
  backgrounds,
  coverUrls,
  selectedId,
  onSelect,
  onChanged,
}: {
  backgrounds: StudioBackground[];
  coverUrls: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const [manageOpen, setManageOpen] = useState(false);

  const closeManage = () => {
    setManageOpen(false);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {backgrounds.map((bg) => {
          const selected = bg.id === selectedId;
          return (
            <button
              key={bg.id}
              type="button"
              onClick={() => onSelect(bg.id)}
              aria-pressed={selected}
              className={cn(
                "group relative rounded-xl border overflow-hidden text-left transition-all",
                selected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50",
              )}
            >
              <div className="aspect-square w-full bg-muted overflow-hidden">
                {coverUrls[bg.id] && (
                  <img
                    src={coverUrls[bg.id]}
                    alt={bg.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                )}
              </div>
              {selected && (
                <span className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              <p className="px-2.5 py-2 text-xs font-semibold truncate">{bg.name}</p>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors min-h-[9rem]"
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs font-semibold">Agregar fondo</span>
        </button>
      </div>

      {backgrounds.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No hay fondos activos. Crea uno con “Agregar fondo”.
        </p>
      )}

      <Dialog open={manageOpen} onOpenChange={(o) => (o ? setManageOpen(true) : closeManage())}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fondos dinámicos</DialogTitle>
            <DialogDescription>
              Portada, imagen de referencia y prompt por modelo de cada fondo.
            </DialogDescription>
          </DialogHeader>
          <BackgroundsTab startNew />
        </DialogContent>
      </Dialog>
    </div>
  );
}
