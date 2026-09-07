/**
 * Canal / origen de la venta. Dimensión independiente del método de pago:
 * una venta por WhatsApp puede cobrarse con pago móvil, y una venta en tienda
 * puede cobrarse con Cashea.
 *
 * El origen es obligatorio y nunca viene preseleccionado.
 * En el POS solo se seleccionan manualmente WhatsApp, Cashea y Tienda.
 * "web" existe para las ventas que llegarán identificadas automáticamente
 * desde la integración de la tienda online.
 */
export type PosSalesChannelId = "in_store" | "web" | "whatsapp" | "cashea";

export interface PosSalesChannelDef {
  id: PosSalesChannelId;
  label: string;
  /** Pide detalle libre del origen. */
  requiresDetail?: boolean;
  /** Se puede elegir manualmente en el POS. */
  manual?: boolean;
}

export const POS_ALL_SALES_CHANNELS: PosSalesChannelDef[] = [
  { id: "whatsapp", label: "WhatsApp", manual: true },
  { id: "cashea", label: "Cashea", manual: true },
  { id: "in_store", label: "Tienda", manual: true },
  { id: "web", label: "Web" },
];

/** Opciones seleccionables por el cajero. */
export const POS_SALES_CHANNELS: PosSalesChannelDef[] = POS_ALL_SALES_CHANNELS.filter(
  (c) => c.manual
);

export const posChannel = (id: PosSalesChannelId): PosSalesChannelDef =>
  POS_ALL_SALES_CHANNELS.find((c) => c.id === id) ?? POS_ALL_SALES_CHANNELS[0];

export const posChannelLabel = (id: PosSalesChannelId | null, detail?: string) => {
  if (!id) return "Sin origen";
  const def = posChannel(id);
  return def.requiresDetail && detail?.trim() ? `${def.label} · ${detail.trim()}` : def.label;
};
