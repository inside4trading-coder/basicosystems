/**
 * Canal / origen de la venta. Dimensión independiente del método de pago:
 * una venta por WhatsApp puede cobrarse con pago móvil, y una venta en tienda
 * puede cobrarse con Cashea.
 *
 * El origen es obligatorio y nunca viene preseleccionado.
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
  /** Pide detalle libre del origen. */
  requiresDetail?: boolean;
}

export const POS_SALES_CHANNELS: PosSalesChannelDef[] = [
  { id: "in_store", label: "Tienda física" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "cashea", label: "Cashea" },
  { id: "instagram", label: "Instagram" },
  { id: "phone", label: "Teléfono" },
  { id: "web", label: "Web" },
  { id: "other", label: "Otro", requiresDetail: true },
];

export const posChannel = (id: PosSalesChannelId): PosSalesChannelDef =>
  POS_SALES_CHANNELS.find((c) => c.id === id) ?? POS_SALES_CHANNELS[0];

export const posChannelLabel = (id: PosSalesChannelId | null, detail?: string) => {
  if (!id) return "Sin origen";
  const def = posChannel(id);
  return def.requiresDetail && detail?.trim() ? `${def.label} · ${detail.trim()}` : def.label;
};
