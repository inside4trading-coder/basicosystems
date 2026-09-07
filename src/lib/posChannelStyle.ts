/**
 * Identidad visual por canal de venta.
 * WhatsApp verde · Cashea amarillo pollito con texto negro · Tienda negro con texto amarillo.
 */
import type { PosSalesChannelId } from "@/lib/posSalesChannels";

const STYLES: Record<PosSalesChannelId, string> = {
  whatsapp: "bg-[#12A150] text-white hover:bg-[#12A150]/90",
  cashea: "bg-[#FFE04B] text-black hover:bg-[#FFE04B]/90",
  in_store: "bg-black text-[#FFE04B] hover:bg-black/90",
  web: "bg-sky-600 text-white hover:bg-sky-600/90",
};

const RINGS: Record<PosSalesChannelId, string> = {
  whatsapp: "ring-[#12A150]",
  cashea: "ring-[#FFE04B]",
  in_store: "ring-black",
  web: "ring-sky-600",
};

export const posChannelButtonClass = (id: PosSalesChannelId | null) =>
  id ? STYLES[id] : "bg-muted text-muted-foreground";

export const posChannelAccentClass = (id: PosSalesChannelId | null) =>
  id ? STYLES[id].split(" ").slice(0, 2).join(" ") : "bg-muted text-muted-foreground";

export const posChannelRingClass = (id: PosSalesChannelId | null) =>
  id ? RINGS[id] : "ring-transparent";
