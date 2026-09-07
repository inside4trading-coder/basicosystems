/**
 * Identidad visual por canal de venta.
 * WhatsApp verde · Cashea amarillo #FDFF00 con texto negro · Tienda negro con texto amarillo.
 */
import type { PosSalesChannelId } from "@/lib/posSalesChannels";

const STYLES: Record<PosSalesChannelId, string> = {
  whatsapp: "bg-[#12A150] text-white hover:bg-[#12A150]/90",
  cashea: "bg-[#FDFF00] text-black hover:bg-[#FDFF00]/90",
  in_store: "bg-black text-[#FDFF00] hover:bg-black/90",
  web: "bg-sky-600 text-white hover:bg-sky-600/90",
};

const RINGS: Record<PosSalesChannelId, string> = {
  whatsapp: "ring-[#12A150]",
  cashea: "ring-[#FDFF00]",
  in_store: "ring-black",
  web: "ring-sky-600",
};

export const posChannelButtonClass = (id: PosSalesChannelId | null) =>
  id ? STYLES[id] : "bg-muted text-muted-foreground";

export const posChannelAccentClass = (id: PosSalesChannelId | null) =>
  id ? STYLES[id].split(" ").slice(0, 2).join(" ") : "bg-muted text-muted-foreground";

export const posChannelRingClass = (id: PosSalesChannelId | null) =>
  id ? RINGS[id] : "ring-transparent";
