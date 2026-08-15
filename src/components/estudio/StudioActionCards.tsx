import { Camera, Scissors, Sparkles, Clapperboard, UserRound, Lock } from "lucide-react";
import type { StudioKind } from "@/lib/estudioNaming";
import { cn } from "@/lib/utils";
import heroCatalogo from "@/assets/studio-catalogo.jpg";
import heroTransparente from "@/assets/studio-transparente.jpg";
import heroDinamico from "@/assets/studio-dinamico.jpg";
import heroVideo from "@/assets/studio-video.jpg";
import heroModelo from "@/assets/studio-modelo.jpg";

interface ActionCard {
  kind: StudioKind | null;
  title: string;
  description: string;
  icon: typeof Camera;
  hero: string;
  tags: string[];
  available: boolean;
}

const CARDS: ActionCard[] = [
  {
    kind: "catalogo",
    title: "Foto para catálogo",
    description: "Imagen limpia y profesional para tienda online y producto.",
    icon: Camera,
    hero: heroCatalogo,
    tags: ["Imagen limpia", "Lista para catálogo", "Enfocada en tu producto"],
    available: true,
  },
  {
    kind: "transparente",
    title: "Fondo transparente",
    description: "Aísla la prenda y genera PNG limpio listo para diseño, e-commerce y composición.",
    icon: Scissors,
    hero: heroTransparente,
    tags: ["PNG limpio", "Recorte preciso", "Listo para diseño"],
    available: true,
  },
  {
    kind: "dinamico",
    title: "Fondo dinámico",
    description: "Crea escenas visuales para campañas, redes y carruseles.",
    icon: Sparkles,
    hero: heroDinamico,
    tags: ["Imagen individual", "Carrusel x4", "Campaña visual"],
    available: true,
  },
  {
    kind: null,
    title: "Video corto",
    description: "Videos de producto para reels y campañas.",
    icon: Clapperboard,
    hero: heroVideo,
    tags: ["Próximamente"],
    available: false,
  },
  {
    kind: null,
    title: "Mockup con modelo",
    description: "Prenda sobre modelo generado con IA.",
    icon: UserRound,
    hero: heroModelo,
    tags: ["Próximamente"],
    available: false,
  },
];

export function StudioActionCards({ onSelect }: { onSelect: (kind: StudioKind) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const blocked = !card.available;

        return (
          <article
            key={card.title}
            {...(blocked
              ? { "aria-disabled": true }
              : {
                  role: "button",
                  tabIndex: 0,
                  onClick: () => card.kind && onSelect(card.kind),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if ((e.key === "Enter" || e.key === " ") && card.kind) {
                      e.preventDefault();
                      onSelect(card.kind);
                    }
                  },
                })}
            className={cn(
              "group flex flex-col overflow-hidden rounded-[20px] border bg-card",
              "shadow-[0_1px_2px_rgba(10,13,18,0.04),0_8px_24px_-16px_rgba(10,13,18,0.25)]",
              "transition-all duration-200",
              blocked
                ? "cursor-not-allowed select-none border-border/70 bg-studio-mist"
                : "cursor-pointer hover:-translate-y-0.5 hover:border-studio-accent hover:shadow-[0_2px_4px_rgba(11,55,255,0.08),0_16px_40px_-20px_rgba(11,55,255,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-accent focus-visible:ring-offset-2",
            )}
          >
            {/* Hero: ~57% de la card, recorte sin deformar. */}
            <div className="p-2">
              <div className="relative overflow-hidden rounded-2xl bg-studio-mist aspect-[3/2]">
                <img
                  src={card.hero}
                  alt={card.title}
                  loading="lazy"
                  className={cn(
                    "h-full w-full object-cover transition-transform duration-500",
                    card.kind === "transparente" && "scale-[1.10]",
                    blocked ? "grayscale opacity-60" : "group-hover:scale-[1.03]",
                    card.kind === "transparente" && !blocked && "group-hover:scale-[1.13]",
                  )}
                />
                {blocked && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                    <Lock className="h-3 w-3" />
                    En construcción
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-3">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    blocked ? "bg-muted text-muted-foreground" : "bg-studio-accent/10 text-studio-accent",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                  Basico Studio
                </span>
              </div>

              <div className="space-y-1.5">
                <h3
                  className={cn(
                    "text-xl font-black tracking-tight",
                    blocked ? "text-muted-foreground" : "text-studio-ink",
                  )}
                >
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {card.tags.map((t) => (
                  <span
                    key={t}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      blocked
                        ? "border-border text-muted-foreground"
                        : "border-studio-accent/25 bg-studio-accent/5 text-studio-accent",
                    )}
                  >
                    {t}
                  </span>
                ))}
              </div>

              <p
                className={cn(
                  "mt-auto pt-3 text-sm font-semibold",
                  blocked ? "text-muted-foreground" : "text-studio-accent",
                )}
              >
                {blocked ? "Gracias por tu paciencia." : "Empezar →"}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
