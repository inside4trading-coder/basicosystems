/**
 * DATOS MOCK — SUBLIME HUB V2 (fase visual).
 *
 * Todo lo que hay aquí es ficticio y vive únicamente en memoria.
 * No se escribe en ninguna tabla real y puede sustituirse por consultas
 * reales sin tocar las pantallas.
 */
import type {
  LifecycleEvent,
  SublimeCustomer,
  SublimeLocation,
  SublimeMovement,
  SublimeProduct,
  SublimeSale,
  SublimeUnit,
  SublimeVariant,
} from "@/types/sublimeHub";

export const MOCK_NOTICE =
  "Datos de ejemplo — esta pantalla todavía no está conectada al sistema real.";

export const mockLocations: SublimeLocation[] = [
  { id: "loc-wh", name: "Almacén Sublime", kind: "warehouse", active: true },
  { id: "loc-bq", name: "Sublime Barquicenter", kind: "store", active: true },
  { id: "loc-transit", name: "En tránsito", kind: "transit", active: true },
];

export const locationName = (id: string | null) =>
  mockLocations.find((l) => l.id === id)?.name ?? "—";

export const mockProducts: SublimeProduct[] = [
  {
    id: "prd-1",
    title: "Camiseta Champion 1980",
    provisionalName: "Franela Champion vintage",
    brand: "Champion",
    category: "Camisetas",
    collection: "Vintage 90s",
    description: "Camiseta vintage de algodón con logo bordado.",
    tags: ["vintage", "algodón"],
    manufacturerCode: "CH-1980",
    legacyWebSku: "WEB-0231",
    acquisition: "owned",
    consignmentPct: null,
    preparation: "published",
    referenceImages: [],
    webImages: [],
  },
  {
    id: "prd-2",
    title: "Cargo South",
    provisionalName: "Pantalón cargo verde",
    brand: "South",
    category: "Pantalones",
    collection: "Utility",
    description: null,
    tags: ["cargo"],
    manufacturerCode: "SO-CG32",
    legacyWebSku: null,
    acquisition: "owned",
    consignmentPct: null,
    preparation: "ready",
    referenceImages: [],
    webImages: [],
  },
  {
    id: "prd-3",
    title: "Franela de rayas blanca",
    provisionalName: "Franela rayas blanca",
    brand: null,
    category: "Camisetas",
    collection: null,
    description: null,
    tags: [],
    manufacturerCode: "FR-RB01",
    legacyWebSku: null,
    acquisition: "consignment",
    consignmentPct: 30,
    preparation: "in_progress",
    referenceImages: [],
    webImages: [],
  },
  {
    id: "prd-4",
    title: "Chaqueta denim Levi's",
    provisionalName: "Chaqueta jean",
    brand: "Levi's",
    category: "Chaquetas",
    collection: null,
    description: null,
    tags: [],
    manufacturerCode: "LV-DJ44",
    legacyWebSku: null,
    acquisition: "owned",
    consignmentPct: null,
    preparation: "not_started",
    referenceImages: [],
    webImages: [],
  },
];

export const mockVariants: SublimeVariant[] = [
  { id: "var-1", productId: "prd-1", size: "S", color: "Negro", sku: "CHAMP-BLK-S", quantity: 3, unitCost: 12.4, pvp: 34 },
  { id: "var-2", productId: "prd-1", size: "M", color: "Negro", sku: "CHAMP-BLK-M", quantity: 4, unitCost: 12.4, pvp: 34 },
  { id: "var-3", productId: "prd-1", size: "L", color: "Caqui", sku: "CHAMP-KHAKI-L", quantity: 2, unitCost: 12.4, pvp: 34 },
  { id: "var-4", productId: "prd-2", size: "32", color: "Verde", sku: "SOUTH-GRN-32", quantity: 5, unitCost: 18.9, pvp: 52 },
  { id: "var-5", productId: "prd-2", size: "34", color: "Verde", sku: "SOUTH-GRN-34", quantity: 2, unitCost: 18.9, pvp: 52 },
  { id: "var-6", productId: "prd-3", size: "M", color: "Blanco", sku: "RAYAS-WHT-M", quantity: 6, unitCost: 9.2, pvp: 28 },
  { id: "var-7", productId: "prd-4", size: "L", color: "Azul", sku: "LEVIS-BLU-L", quantity: 2, unitCost: 26.5, pvp: 78 },
];

export const variantLabel = (v: SublimeVariant) => `${v.size} · ${v.color}`;

export const productOf = (variantId: string) => {
  const v = mockVariants.find((x) => x.id === variantId);
  return mockProducts.find((p) => p.id === v?.productId) ?? null;
};

function buildUnits(): SublimeUnit[] {
  const units: SublimeUnit[] = [];
  let n = 1;
  const plan: { variantId: string; count: number; locationId: string }[] = [
    { variantId: "var-1", count: 3, locationId: "loc-wh" },
    { variantId: "var-2", count: 2, locationId: "loc-wh" },
    { variantId: "var-2", count: 2, locationId: "loc-bq" },
    { variantId: "var-3", count: 2, locationId: "loc-bq" },
    { variantId: "var-4", count: 3, locationId: "loc-wh" },
    { variantId: "var-4", count: 2, locationId: "loc-bq" },
    { variantId: "var-5", count: 2, locationId: "loc-wh" },
    { variantId: "var-6", count: 6, locationId: "loc-wh" },
    { variantId: "var-7", count: 2, locationId: "loc-transit" },
  ];
  for (const p of plan) {
    for (let i = 0; i < p.count; i++) {
      units.push({
        id: `unit-${n}`,
        unitCode: `UNIT-${String(n).padStart(6, "0")}`,
        variantId: p.variantId,
        status: p.locationId === "loc-transit" ? "incoming" : "available",
        locationId: p.locationId,
        rfidEpc: null,
        receivedAt: p.locationId === "loc-transit" ? null : "2026-08-21",
      });
      n++;
    }
  }
  return units;
}

export const mockUnits: SublimeUnit[] = buildUnits();

export const unitsOfVariant = (variantId: string) =>
  mockUnits.filter((u) => u.variantId === variantId);

export const mockMovements: SublimeMovement[] = [
  { id: "mv-1", at: "2026-09-06T14:20:00Z", type: "pos_sale", productTitle: "Camiseta Champion 1980", sku: "CHAMP-BLK-M", unitCode: "UNIT-000005", fromLocationId: "loc-bq", toLocationId: null, user: "Mari", reason: "Venta POS-000142" },
  { id: "mv-2", at: "2026-09-05T11:02:00Z", type: "transfer", productTitle: "Cargo South", sku: "SOUTH-GRN-32", unitCode: "UNIT-000012", fromLocationId: "loc-wh", toLocationId: "loc-bq", user: "Andrés", reason: "Reposición tienda" },
  { id: "mv-3", at: "2026-09-04T09:45:00Z", type: "reception", productTitle: "Franela de rayas blanca", sku: "RAYAS-WHT-M", unitCode: "UNIT-000015", fromLocationId: null, toLocationId: "loc-wh", user: "Andrés", reason: "Envío ENV-014" },
  { id: "mv-4", at: "2026-09-03T18:10:00Z", type: "adjustment", productTitle: "Camiseta Champion 1980", sku: "CHAMP-KHAKI-L", unitCode: "UNIT-000008", fromLocationId: "loc-bq", toLocationId: "loc-bq", user: "Mari", reason: "Conteo semanal" },
  { id: "mv-5", at: "2026-09-02T16:30:00Z", type: "damage", productTitle: "Chaqueta denim Levi's", sku: "LEVIS-BLU-L", unitCode: "UNIT-000023", fromLocationId: "loc-wh", toLocationId: null, user: "Andrés", reason: "Mancha irreparable" },
  { id: "mv-6", at: "2026-09-01T12:00:00Z", type: "web_sale", productTitle: "Cargo South", sku: "SOUTH-GRN-34", unitCode: "UNIT-000018", fromLocationId: "loc-wh", toLocationId: null, user: "Sistema", reason: "Pedido web #1042" },
];

export const mockLifecycle: Record<string, LifecycleEvent[]> = {
  "prd-1": [
    { stage: "purchased", at: "2026-07-02", user: "Andrés", locationId: null, note: "Compra en lote vintage" },
    { stage: "assigned_shipment", at: "2026-07-08", user: "Andrés", locationId: null, note: "Envío ENV-011" },
    { stage: "in_transit", at: "2026-07-10", user: "Sistema", locationId: "loc-transit", note: null },
    { stage: "prepared", at: "2026-07-28", user: "Mari", locationId: null, note: "Variantes y SKU creados" },
    { stage: "published", at: "2026-07-29", user: "Mari", locationId: null, note: "sublime.com.ve" },
    { stage: "received", at: "2026-08-01", user: "Andrés", locationId: "loc-wh", note: "9 unidades" },
    { stage: "warehouse", at: "2026-08-01", user: "Andrés", locationId: "loc-wh", note: null },
    { stage: "store", at: "2026-08-14", user: "Mari", locationId: "loc-bq", note: "4 unidades movidas" },
    { stage: "sold", at: "2026-09-06", user: "Mari", locationId: "loc-bq", note: "1 unidad vendida" },
  ],
  "prd-3": [
    { stage: "purchased", at: "2026-08-18", user: "Andrés", locationId: null, note: "Consignación 30%" },
    { stage: "assigned_shipment", at: "2026-08-22", user: "Andrés", locationId: null, note: "Envío ENV-014" },
    { stage: "in_transit", at: "2026-08-24", user: "Sistema", locationId: "loc-transit", note: null },
    { stage: "prepared", at: null, user: null, locationId: null, note: null },
    { stage: "published", at: null, user: null, locationId: null, note: null },
    { stage: "received", at: "2026-09-04", user: "Andrés", locationId: "loc-wh", note: "13 de 14 recibidas" },
    { stage: "warehouse", at: "2026-09-04", user: "Andrés", locationId: "loc-wh", note: null },
    { stage: "store", at: null, user: null, locationId: null, note: null },
    { stage: "sold", at: null, user: null, locationId: null, note: null },
  ],
};

export const defaultLifecycle: LifecycleEvent[] = [
  { stage: "purchased", at: "2026-08-30", user: "Andrés", locationId: null, note: null },
  { stage: "assigned_shipment", at: null, user: null, locationId: null, note: null },
  { stage: "in_transit", at: null, user: null, locationId: null, note: null },
  { stage: "prepared", at: null, user: null, locationId: null, note: null },
  { stage: "published", at: null, user: null, locationId: null, note: null },
  { stage: "received", at: null, user: null, locationId: null, note: null },
  { stage: "warehouse", at: null, user: null, locationId: null, note: null },
  { stage: "store", at: null, user: null, locationId: null, note: null },
  { stage: "sold", at: null, user: null, locationId: null, note: null },
];

export const mockCustomers: SublimeCustomer[] = [
  { id: "cus-1", name: "María Pérez", idCard: "V-18.442.101", phone: "0414-1234567", email: "maria@mail.com", birthDate: "1994-03-12", address: "Barquisimeto", purchases: 7, lastPurchaseAt: "2026-09-06", avgTicketUsd: 46.2, notes: "Prefiere tallas M." },
  { id: "cus-2", name: "Luis Gómez", idCard: "V-20.115.933", phone: "0424-7654321", email: null, birthDate: null, address: null, purchases: 2, lastPurchaseAt: "2026-08-28", avgTicketUsd: 31, notes: null },
  { id: "cus-3", name: "Ana Rivas", idCard: null, phone: "0412-9988776", email: "ana@mail.com", birthDate: "1999-11-02", address: "Cabudare", purchases: 4, lastPurchaseAt: "2026-09-02", avgTicketUsd: 58.5, notes: null },
];

export const mockSales: SublimeSale[] = [
  {
    id: "sal-1", code: "POS-000142", at: "2026-09-06T14:20:00Z", channel: "pos", customerId: "cus-1", customerName: "María Pérez",
    totalUsd: 62, discountUsd: 0, units: 2, locationId: "loc-bq",
    payments: [
      { id: "pay-1", method: "cash", currency: "USD", amount: 30, amountUsd: 30, reference: null, bank: null },
      { id: "pay-2", method: "mobile_payment", currency: "VES", amount: 4800, amountUsd: 32, reference: "004512", bank: "Banesco" },
    ],
  },
  {
    id: "sal-2", code: "POS-000141", at: "2026-09-06T11:05:00Z", channel: "pos", customerId: null, customerName: null,
    totalUsd: 34, discountUsd: 0, units: 1, locationId: "loc-bq",
    payments: [{ id: "pay-3", method: "card", currency: "VES", amount: 5100, amountUsd: 34, reference: "889201", bank: "Mercantil" }],
  },
  {
    id: "sal-3", code: "WEB-001042", at: "2026-09-05T20:15:00Z", channel: "web", customerId: "cus-3", customerName: "Ana Rivas",
    totalUsd: 52, discountUsd: 5, units: 1, locationId: "loc-wh",
    payments: [{ id: "pay-4", method: "zelle", currency: "USD", amount: 47, amountUsd: 47, reference: "ZL-2291", bank: "BofA" }],
  },
];

export const mockSummary = {
  salesTodayUsd: 96,
  salesWeekUsd: 742,
  salesMonthUsd: 3128,
  unitsSoldMonth: 71,
  avgTicketUsd: 44.1,
  inventoryAvailable: 24,
  inventoryWarehouse: 16,
  inventoryStore: 8,
  incoming: 5,
  pendingPreparation: 2,
  pendingClosures: 1,
  pendingReconciliation: 3,
  upcomingObligations: 2,
  inventoryValueUsd: 1980,
};

export const mockDashboard = {
  topProducts: [
    { name: "Camiseta Champion 1980", units: 14, usd: 476 },
    { name: "Cargo South", units: 9, usd: 468 },
    { name: "Franela de rayas blanca", units: 7, usd: 196 },
  ],
  topBrands: [
    { name: "Champion", units: 21 },
    { name: "South", units: 12 },
    { name: "Levi's", units: 6 },
  ],
  topSizes: [
    { name: "M", units: 26 },
    { name: "L", units: 18 },
    { name: "S", units: 11 },
  ],
  topColors: [
    { name: "Negro", units: 24 },
    { name: "Verde", units: 13 },
    { name: "Blanco", units: 9 },
  ],
  paymentMix: [
    { name: "Pago móvil", pct: 38 },
    { name: "Punto de venta", pct: 27 },
    { name: "Efectivo USD", pct: 21 },
    { name: "Zelle", pct: 14 },
  ],
  channelMix: [
    { name: "POS", pct: 78 },
    { name: "Web", pct: 22 },
  ],
  topHours: [
    { name: "17:00 – 19:00", units: 22 },
    { name: "12:00 – 14:00", units: 15 },
  ],
  topDays: [
    { name: "Sábado", usd: 612 },
    { name: "Viernes", usd: 488 },
  ],
  slowInventory: [
    { name: "Chaqueta denim Levi's", days: 96 },
    { name: "Cargo South · 34", days: 74 },
  ],
  criticalStock: [
    { name: "Camiseta Champion · L", stock: 1 },
    { name: "Franela rayas · S", stock: 0 },
  ],
  rotationDays: 42,
  consignmentUsd: 340,
  grossMarginUsd: 1810,
};

export const mockAccounts = [
  { id: "acc-1", bank: "Banesco", account: "0134 ···· 8821", currency: "VES", balance: 148200, inflow: 96400, outflow: 41200, lastReconciled: "2026-09-05" },
  { id: "acc-2", bank: "Mercantil", account: "0105 ···· 4410", currency: "VES", balance: 62150, inflow: 41800, outflow: 22300, lastReconciled: "2026-09-04" },
  { id: "acc-3", bank: "Zelle / BofA", account: "sublime@···", currency: "USD", balance: 1240, inflow: 980, outflow: 420, lastReconciled: "2026-09-06" },
  { id: "acc-4", bank: "Caja tienda", account: "Efectivo Barquicenter", currency: "USD", balance: 310, inflow: 640, outflow: 330, lastReconciled: "2026-09-06" },
];

export const mockReconciliation = [
  { id: "rec-1", sale: "POS-000142", method: "Pago móvil", amount: "VES 4.800", reference: "004512", account: "Banesco", status: "pending" as const },
  { id: "rec-2", sale: "POS-000141", method: "Punto de venta", amount: "VES 5.100", reference: "889201", account: "Mercantil", status: "confirmed" as const },
  { id: "rec-3", sale: "WEB-001042", method: "Zelle", amount: "USD 47", reference: "ZL-2291", account: "Zelle / BofA", status: "reconciled" as const },
  { id: "rec-4", sale: "POS-000139", method: "Pago móvil", amount: "VES 2.150", reference: "771002", account: "Banesco", status: "difference" as const },
];

export const mockClosures = [
  { id: "clo-1", date: "2026-09-06", type: "Punto de venta", expected: "VES 18.400", counted: "VES 18.400", diff: "0", user: "Mari", status: "Confirmado" },
  { id: "clo-2", date: "2026-09-06", type: "Efectivo", expected: "USD 310", counted: "USD 305", diff: "-5", user: "Mari", status: "Con diferencia" },
  { id: "clo-3", date: "2026-09-05", type: "Punto de venta", expected: "VES 14.900", counted: "VES 14.900", diff: "0", user: "Andrés", status: "Confirmado" },
];

export const mockPreparationChecklist = [
  { key: "price", label: "Precio" },
  { key: "sizes", label: "Tallas" },
  { key: "sku", label: "SKU" },
  { key: "title", label: "Título" },
  { key: "description", label: "Descripción" },
  { key: "web_images", label: "Imágenes web" },
];

export const mockPreparationState: Record<string, string[]> = {
  "prd-1": ["price", "sizes", "sku", "title", "description", "web_images"],
  "prd-2": ["price", "sizes", "sku", "title", "description"],
  "prd-3": ["price", "sizes", "sku", "title"],
  "prd-4": ["price"],
};

export const usdFormat = (n: number) =>
  new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
