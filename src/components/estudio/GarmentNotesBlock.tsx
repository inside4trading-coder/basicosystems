import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Atajos frecuentes de fidelidad: insertan una línea en las notas de la prenda. */
export const GARMENT_NOTE_CHIPS = [
  "Estampado, no bordado",
  "Bordado, no estampado",
  "Costuras blancas",
  "Costuras en contraste",
  "Mantener altura del estampado",
  "Mantener texto exacto",
  "Tela gruesa",
  "Tela ligera",
  "Preservar gramaje",
  "Preservar simetría visual",
  "Preservar caída natural",
  "No eliminar imperfecciones reales",
];

const PLACEHOLDER = [
  "- Estampado, no bordado",
  "- Costuras blancas",
  "- Tela ripstop",
  '- El texto dice exactamente: "..."',
  "- Mantener altura exacta del estampado",
  "- El artwork trasero va centrado entre bolsillos",
].join("\n");

export interface GarmentNotesBlockProps {
  value: string;
  onChange: (v: string) => void;
}

export function GarmentNotesBlock({ value, onChange }: GarmentNotesBlockProps) {
  const lines = value
    .split("\n")
    .map((l) => l.replace(/^[-•]\s*/, "").trim().toLowerCase())
    .filter(Boolean);

  const toggleChip = (chip: string) => {
    const normalized = chip.toLowerCase();
    if (lines.includes(normalized)) {
      const kept = value
        .split("\n")
        .filter((l) => l.replace(/^[-•]\s*/, "").trim().toLowerCase() !== normalized);
      onChange(kept.join("\n").replace(/\n{3,}/g, "\n\n").trim());
      return;
    }
    const base = value.trimEnd();
    onChange(base ? `${base}\n- ${chip}` : `- ${chip}`);
  };

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div>
        <h4 className="font-semibold text-sm">Detalles clave de la prenda (opcional)</h4>
        <p className="text-xs text-muted-foreground">
          Contexto extra para que la IA respete la prenda real.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="garment-notes" className="text-sm font-medium">
          Notas adicionales para esta prenda
        </Label>
        <Textarea
          id="garment-notes"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={5}
          className="text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {GARMENT_NOTE_CHIPS.map((chip) => {
          const active = lines.includes(chip.toLowerCase());
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={active}
              onClick={() => toggleChip(chip)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {chip}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Estas notas ayudan a que la IA respete mejor corte, tela, costuras, textos, artwork y
        detalles importantes de la prenda.
      </p>
    </div>
  );
}
