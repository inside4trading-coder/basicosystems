/**
 * Estilo del botón FINALIZAR VENTA según el origen de la venta.
 * Paleta provisional: la interacción queda preparada, los colores son ajustables.
 */
import type { PosSalesChannelId } from "@/lib/posSalesChannels";

const STYLES: Record<PosSalesChannelId, string> = {
  in_store: "bg-primary text-primary-foreground hover:bg-primary/90",
  whatsapp: "bg-emerald-600 text-white hover:bg-emerald-600/90",
  cashea: "bg-violet-600 text-white hover:bg-violet-600/90",
  instagram: "bg-pink-600 text-white hover:bg-pink-600/90",
  phone: "bg-amber-600 text-white hover:bg-amber-600/90",
  web: "bg-sky-600 text-white hover:bg-sky-600/90",
  other: "bg-foreground text-background hover:bg-foreground/90",
};

export const posChannelButtonClass = (id: PosSalesChannelId | null) =>
  id ? STYLES[id] : "bg-muted text-muted-foreground";

export const posChannelAccentClass = (id: PosSalesChannelId | null) =>
  id ? STYLES[id].split(" ").slice(0, 2).join(" ") : "bg-muted text-muted-foreground";
