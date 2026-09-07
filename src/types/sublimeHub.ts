/**
 * SUBLIME HUB V2 — Modelo conceptual (fase visual).
 *
 * Principios inalterables:
 *  - PRODUCTO ≠ VARIANTE ≠ UNIDAD FÍSICA
 *  - SKU ≠ UNIT ID ≠ RFID EPC
 *  - STATUS ≠ LOCATION
 *
 * El "SKU web" del módulo actual de Mercancía es un campo legacy y NO es la
 * base de este modelo: el SKU definitivo nace a nivel de variante en el
 * workspace "Preparar producto".
 */

/** Ubicaciones: catálogo abierto, no una lista fija de dos. */
export type LocationKind = "warehouse" | "store" | "popup" | "transit" | "external";

export interface SublimeLocation {
  id: string;
  name: string;
  kind: LocationKind;
  active: boolean;
}

/** Estado de la unidad/variante. Independiente de la ubicación. */
export type StockStatus =
  | "incoming"
  | "available"
  | "reserved"
  | "sold"
  | "returned"
  | "damaged"
  | "lost";

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  incoming: "En camino",
  available: "Disponible",
  reserved: "Reservada",
  sold: "Vendida",
  returned: "Devuelta",
  damaged: "Dañada",
  lost: "Perdida",
};

export type AcquisitionType = "owned" | "consignment";

export type PreparationStatus = "not_started" | "in_progress" | "ready" | "published";

export const PREPARATION_LABEL: Record<PreparationStatus, string> = {
  not_started: "Sin preparar",
  in_progress: "En preparación",
  ready: "Listo para publicar",
  published: "Publicado",
};

/** Modelo comercial general. */
export interface SublimeProduct {
  id: string;
  title: string;
  provisionalName: string;
  brand: string | null;
  category: string | null;
  collection: string | null;
  description: string | null;
  tags: string[];
  manufacturerCode: string | null;
  /** Campo legacy heredado de Mercancía. No usar como identificador de variante. */
  legacyWebSku: string | null;
  acquisition: AcquisitionType;
  consignmentPct: number | null;
  preparation: PreparationStatus;
  referenceImages: string[];
  webImages: string[];
}

/** Combinación vendible. Aquí vive el SKU. */
export interface SublimeVariant {
  id: string;
  productId: string;
  size: string;
  color: string;
  sku: string;
  quantity: number;
  unitCost: number;
  pvp: number;
}

/** Prenda física individual. */
export interface SublimeUnit {
  id: string;
  unitCode: string;
  variantId: string;
  status: StockStatus;
  locationId: string;
  rfidEpc: string | null;
  receivedAt: string | null;
}

export type MovementType =
  | "reception"
  | "transfer"
  | "pos_sale"
  | "web_sale"
  | "return"
  | "adjustment"
  | "damage"
  | "loss"
  | "count";

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  reception: "Recepción",
  transfer: "Transferencia",
  pos_sale: "Venta POS",
  web_sale: "Venta Web",
  return: "Devolución",
  adjustment: "Ajuste",
  damage: "Daño",
  loss: "Pérdida",
  count: "Conteo",
};

export interface SublimeMovement {
  id: string;
  at: string;
  type: MovementType;
  productTitle: string;
  sku: string;
  unitCode: string | null;
  fromLocationId: string | null;
  toLocationId: string | null;
  user: string;
  reason: string | null;
}

/** Ciclo de vida visible del producto. */
export type LifecycleStage =
  | "purchased"
  | "assigned_shipment"
  | "in_transit"
  | "prepared"
  | "published"
  | "received"
  | "warehouse"
  | "store"
  | "sold";

export const LIFECYCLE_ORDER: LifecycleStage[] = [
  "purchased",
  "assigned_shipment",
  "in_transit",
  "prepared",
  "published",
  "received",
  "warehouse",
  "store",
  "sold",
];

export const LIFECYCLE_LABEL: Record<LifecycleStage, string> = {
  purchased: "Comprado",
  assigned_shipment: "Asignado a envío",
  in_transit: "En tránsito",
  prepared: "Preparado",
  published: "Publicado",
  received: "Recibido",
  warehouse: "Almacén",
  store: "Tienda",
  sold: "Vendido",
};

export interface LifecycleEvent {
  stage: LifecycleStage;
  at: string | null;
  user: string | null;
  locationId: string | null;
  note: string | null;
}

export type PaymentMethod =
  | "cash"
  | "card"
  | "transfer"
  | "mobile_payment"
  | "zelle"
  | "foreign_currency";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Punto de venta",
  transfer: "Transferencia",
  mobile_payment: "Pago móvil",
  zelle: "Zelle",
  foreign_currency: "Divisa",
};

export type Currency = "USD" | "VES";

export interface SalePayment {
  id: string;
  method: PaymentMethod;
  currency: Currency;
  amount: number;
  amountUsd: number;
  reference: string | null;
  bank: string | null;
}

export interface SublimeCustomer {
  id: string;
  name: string;
  idCard: string | null;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  address: string | null;
  purchases: number;
  lastPurchaseAt: string | null;
  avgTicketUsd: number;
  notes: string | null;
}

export interface SublimeSale {
  id: string;
  code: string;
  at: string;
  channel: "pos" | "web";
  customerId: string | null;
  customerName: string | null;
  totalUsd: number;
  discountUsd: number;
  units: number;
  payments: SalePayment[];
  locationId: string;
}
