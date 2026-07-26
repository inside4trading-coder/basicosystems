export interface MerchItemLike {
  precio_compra: number | null;
  peso_kg: number | null;
  pvp: number | null;
  sku_web: string | null;
}

export interface MerchShipmentLike {
  cost_per_kg_eur: number | null;
}

export function calculateShippingCost(
  item: Pick<MerchItemLike, "peso_kg">,
  shipment?: MerchShipmentLike | null,
): number {
  const peso = Number(item.peso_kg ?? 0);
  const rate = Number(shipment?.cost_per_kg_eur ?? 0);
  return peso * rate;
}

export function calculateTotalCost(
  item: Pick<MerchItemLike, "precio_compra" | "peso_kg">,
  shipment?: MerchShipmentLike | null,
): number {
  const precio = Number(item.precio_compra ?? 0);
  return precio + calculateShippingCost(item, shipment);
}

export function calculateMargin(
  item: MerchItemLike,
  shipment?: MerchShipmentLike | null,
): number | null {
  if (item.pvp == null) return null;
  return Number(item.pvp) - calculateTotalCost(item, shipment);
}

export type UploadValidation =
  | { ok: true }
  | { ok: false; reason: "missing_sku" | "missing_pvp"; message: string };

export function canMarkUploaded(item: MerchItemLike): UploadValidation {
  if (!item.sku_web || !item.sku_web.trim()) {
    return {
      ok: false,
      reason: "missing_sku",
      message:
        "Debes asignar un SKU web antes de marcar este producto como subido al sistema.",
    };
  }
  if (item.pvp == null || Number.isNaN(Number(item.pvp))) {
    return {
      ok: false,
      reason: "missing_pvp",
      message:
        "Debes asignar un PVP antes de marcar este producto como subido al sistema.",
    };
  }
  return { ok: true };
}

export const MERCH_ESTADOS = [
  "purchased",
  "in_transit",
  "received",
  "available",
  "cancelled",
] as const;

export type MerchEstado = (typeof MERCH_ESTADOS)[number];

export const MERCH_ESTADO_LABEL: Record<MerchEstado, string> = {
  purchased: "Comprado",
  in_transit: "En camino",
  received: "Recibido",
  available: "Disponible",
  cancelled: "Cancelado",
};
