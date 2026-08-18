import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_CATALOG_BG, normalizeHexColor } from "@/lib/estudioPrompts";

interface CatalogBackgroundFieldProps {
  value: string;
  onChange: (hex: string) => void;
  /** `true` cuando hay recorte PNG: el color queda exacto por composición local. */
  exact: boolean;
}

/**
 * Color de fondo de "Foto para catálogo". El default es el gris BASICO, pero el usuario
 * puede cambiarlo por generación: nunca queda fijo.
 */
export function CatalogBackgroundField({ value, onChange, exact }: CatalogBackgroundFieldProps) {
  const safe = normalizeHexColor(value) ?? DEFAULT_CATALOG_BG;

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div>
        <Label className="font-medium text-sm">Color de fondo de catálogo</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Este color se aplica exactamente cuando la imagen usa recorte/composición. En modo
          generativo puede variar.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="h-9 w-9 rounded-lg border shrink-0"
          style={{ backgroundColor: safe }}
          aria-hidden
        />
        <input
          type="color"
          aria-label="Selector de color de fondo"
          value={safe}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded-lg border bg-background p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={DEFAULT_CATALOG_BG}
          className="h-9 w-32 font-mono text-sm"
          aria-label="Color HEX de fondo"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => onChange(DEFAULT_CATALOG_BG)}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Restaurar gris BASICO
        </Button>
      </div>

      <p
        className={
          exact
            ? "text-xs text-emerald-600 dark:text-emerald-500"
            : "text-xs text-amber-600 dark:text-amber-500"
        }
      >
        {exact
          ? "Composición con recorte: el fondo queda exactamente en este color."
          : "Generativo: el fondo puede variar. Para color exacto usa recorte/fondo transparente."}
      </p>
    </div>
  );
}
