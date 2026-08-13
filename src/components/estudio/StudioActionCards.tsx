import { Card } from "@/components/ui/card";
import { Camera, Scissors, Sparkles, Clapperboard, UserRound, Lock } from "lucide-react";
import type { StudioKind } from "@/lib/estudioNaming";
import { cn } from "@/lib/utils";

interface ActionCard {
  kind: StudioKind | null;
  title: string;
  description: string;
  icon: typeof Camera;
  tags: string[];
  available: boolean;
}

const CARDS: ActionCard[] = [
  {
    kind: "catalogo",
    title: "Foto para catálogo",
    description: "Imagen limpia y profesional para tienda online y producto.",
    icon: Camera,
    tags: ["Imagen limpia", "Lista para catálogo", "Enfocada en tu producto"],
    available: true,
  },
  {
    kind: "transparente",
    title: "Fondo transparente",
    description: "Aísla la prenda y genera PNG limpio listo para diseño, e-commerce y composición.",
    icon: Scissors,
    tags: ["PNG limpio", "Recorte preciso", "Listo para diseño"],
    available: true,
  },
  {
    kind: "dinamico",
    title: "Fondo dinámico",
    description: "Crea escenas visuales para campañas, redes y carruseles.",
    icon: Sparkles,
    tags: ["Imagen individual", "Carrusel x4", "Campaña visual"],
    available: true,
  },
  {
    kind: null,
    title: "Video corto",
    description: "Videos de producto para reels y campañas.",
    icon: Clapperboard,
    tags: ["Próximamente"],
    available: false,
  },
  {
    kind: null,
    title: "Mockup con modelo",
    description: "Prenda sobre modelo generado con IA.",
    icon: UserRound,
    tags: ["Próximamente"],
    available: false,
  },
];

export function StudioActionCards({ onSelect }: { onSelect: (kind: StudioKind) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center",
                  card.available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              {!card.available && (
                <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider rounded-full bg-muted text-muted-foreground px-2.5 py-1">
                  <Lock className="h-3 w-3" />
                  En construcción
                </span>
              )}
            </div>

            <div className="mt-4 space-y-1.5">
              <h3
                className={cn(
                  "text-xl font-black tracking-tight",
                  !card.available && "text-muted-foreground",
                )}
              >
                {card.title}
              </h3>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {card.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] uppercase tracking-wide rounded-full border px-2 py-0.5 text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </>
        );

        if (!card.available) {
          return (
            <Card
              key={card.title}
              aria-disabled
              className="p-6 rounded-2xl bg-muted/40 border-dashed opacity-70 cursor-not-allowed select-none"
            >
              {body}
              <p className="mt-4 text-xs text-muted-foreground">Gracias por tu paciencia.</p>
            </Card>
          );
        }

        return (
          <Card
            key={card.title}
            role="button"
            tabIndex={0}
            onClick={() => card.kind && onSelect(card.kind)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && card.kind) {
                e.preventDefault();
                onSelect(card.kind);
              }
            }}
            className="p-6 rounded-2xl cursor-pointer transition-all hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {body}
            <p className="mt-4 text-sm font-semibold text-primary">Empezar →</p>
          </Card>
        );
      })}
    </div>
  );
}
