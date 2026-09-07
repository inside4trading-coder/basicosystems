/**
 * Canal / origen de la venta. Dimensión independiente del método de pago:
 * una venta por WhatsApp puede cobrarse con pago móvil, y una venta en tienda
 * puede cobrarse con Cashea.
 */
export type PosSalesChannelId =
  | "in_store"
  | "web"
  | "whatsapp"
  | "cashea"
  | "instagram"
  | "phone"
  | "other";

export interface PosSalesChannelDef {
  id: PosSalesChannelId;
  label: string;
  /** Canales fijados por el pedido de origen: el cajero no los elige. */
  systemAssigned?: boolean;
  /** Pide detalle libre del origen. */
  requiresDetail?: boolean;
}

export const POS_SALES_CHANNELS: PosSalesChannelDef[] = [
  { id: "in_store", label: "Tienda física" },
  { id: "web", label: "Web", systemAssigned: true },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "cashea", label: "Cashea" },
  { id: "instagram", label: "Instagram" },
  { id: "phone", label: "Teléfono" },
  { id: "other", label: "Otro", requiresDetail: true },
];

export const POS_DEFAULT_CHANNEL: PosSalesChannelId = "in_store";

export const posChannel = (id: PosSalesChannelId): PosSalesChannelDef =>
  POS_SALES_CHANNELS.find((c) => c.id === id) ?? POS_SALES_CHANNELS[0];

export const posChannelLabel = (id: PosSalesChannelId, detail?: string) => {
  const def = posChannel(id);
  return def.requiresDetail && detail?.trim() ? `${def.label} · ${detail.trim()}` : def.label;
};
