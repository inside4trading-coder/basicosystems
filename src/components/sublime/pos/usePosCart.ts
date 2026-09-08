import { useCallback, useMemo, useState } from "react";
import { variantLabel } from "@/lib/sublimeMock";
import type { SublimeProduct, SublimeVariant } from "@/types/sublimeHub";
import type { PosSalesChannelId } from "@/lib/posSalesChannels";

export const POS_STORE_LOCATION = "loc-bq";
export const POS_BCV_RATE = 150;
/** IVA ya contenido en todos los precios mostrados. Solo se desglosa en factura. */
export const POS_TAX_PCT = 16;

/** Impuesto contenido en un precio final (no se suma, se extrae). */
export const includedTax = (total: number) => total - total / (1 + POS_TAX_PCT / 100);

/** Origen del descuento de una línea o del carrito. */
export type PosDiscountSource =
  | "promo"
  | "manual_pct"
  | "manual_fixed"
  | "coupon"
  | "auto"
  | "cart";

export interface PosLineDiscount {
  source: PosDiscountSource;
  /** Descuento por unidad, en REF. */
  amount: number;
  reason?: string;
  appliedBy?: string;
}

export interface PosCatalogEntry {
  variant: SublimeVariant;
  product: SublimeProduct;
  storeStock: number;
  /** Precio regular / full en REF, IVA incluido. */
  regularPrice: number;
  /** Precio vigente en REF, IVA incluido. */
  finalPrice: number;
  /** Descuento por unidad en REF (0 si no hay). */
  unitDiscount: number;
  discountPct: number;
  discountSource: PosDiscountSource | null;
}

export type PosManualKind = "producto" | "servicio" | "extra";

export interface PosManualItem {
  id: string;
  name: string;
  kind: PosManualKind;
  /** Precio en REF, IVA incluido. */
  priceRef: number;
  qty: number;
}

export interface PosCartLine {
  key: string;
  kind: "catalog" | "manual";
  title: string;
  subtitle: string;
  sku: string | null;
  variant?: SublimeVariant;
  product?: SublimeProduct;
  qty: number;
  regularPrice: number;
  finalPrice: number;
  unitDiscount: number;
  discountPct: number;
  /** Precio regular × cantidad. */
  regularTotal: number;
  /** Descuento total de la línea. */
  discountTotal: number;
  /** Precio final × cantidad. */
  lineTotal: number;
  discount: PosLineDiscount | null;
}

/**
 * El catálogo del POS ya NO vive aquí: proviene del Inventario Maestro Sublime
 * (`useSublimePosCatalog`) y se inyecta al carrito.
 */


interface RegisterCartState {
  items: Record<string, number>;
  manual: PosManualItem[];
  cartDiscount: number;
  cartDiscountSource: PosDiscountSource;
  cartDiscountReason: string;
  note: string;
  channel: PosSalesChannelId | null;
  channelDetail: string;
}

const emptyCart = (): RegisterCartState => ({
  items: {},
  manual: [],
  cartDiscount: 0,
  cartDiscountSource: "manual_fixed",
  cartDiscountReason: "",
  note: "",
  channel: null,
  channelDetail: "",
});

export interface PosSuspendedCart {
  id: string;
  registerId: string;
  registerName: string;
  cashierName: string;
  customerName: string | null;
  at: string;
  totalRef: number;
  state: RegisterCartState;
}

const MANUAL_KIND_LABEL: Record<PosManualKind, string> = {
  producto: "Producto manual",
  servicio: "Servicio",
  extra: "Extra",
};

/**
 * Cada caja/sesión mantiene su propio carrito activo: Caja 1 y Caja 2 no
 * comparten carrito. El inventario, en cambio, es único por sede.
 */
export function usePosCart(registerId: string, catalog: PosCatalogEntry[] = []) {
  const [carts, setCarts] = useState<Record<string, RegisterCartState>>({});
  const [suspended, setSuspended] = useState<PosSuspendedCart[]>([]);

  const state = carts[registerId] ?? emptyCart();

  const patch = useCallback(
    (p: Partial<RegisterCartState>) =>
      setCarts((c) => ({ ...c, [registerId]: { ...(c[registerId] ?? emptyCart()), ...p } })),
    [registerId]
  );

  const lines: PosCartLine[] = useMemo(() => {
    const catalogLines = Object.entries(state.items).flatMap(([variantId, qty]) => {
      const entry = catalog.find((e) => e.variant.id === variantId);
      if (!entry) return [];
      return [{
        key: entry.variant.id,
        kind: "catalog" as const,
        title: entry.product.title,
        subtitle: variantLabel(entry.variant),
        sku: entry.variant.sku,
        variant: entry.variant,
        product: entry.product,
        qty,
        regularPrice: entry.regularPrice,
        finalPrice: entry.finalPrice,
        unitDiscount: entry.unitDiscount,
        discountPct: entry.discountPct,
        regularTotal: entry.regularPrice * qty,
        discountTotal: entry.unitDiscount * qty,
        lineTotal: entry.finalPrice * qty,
        discount:
          entry.unitDiscount > 0
            ? { source: entry.discountSource ?? "promo", amount: entry.unitDiscount }
            : null,
      }];
    });

    const manualLines = state.manual.map((m) => ({
      key: m.id,
      kind: "manual" as const,
      title: m.name,
      subtitle: MANUAL_KIND_LABEL[m.kind],
      sku: null,
      qty: m.qty,
      regularPrice: m.priceRef,
      finalPrice: m.priceRef,
      unitDiscount: 0,
      discountPct: 0,
      regularTotal: m.priceRef * m.qty,
      discountTotal: 0,
      lineTotal: m.priceRef * m.qty,
      discount: null,
    }));

    return [...catalogLines, ...manualLines];
  }, [state.items, state.manual, catalog]);

  const subtotalRegular = lines.reduce((a, l) => a + l.regularTotal, 0);
  const lineDiscounts = lines.reduce((a, l) => a + l.discountTotal, 0);
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const cartDiscount = Math.min(state.cartDiscount, subtotal);
  const discountTotal = lineDiscounts + cartDiscount;
  /** Total final: los precios ya incluyen IVA, no se suma nada al cierre. */
  const total = Math.max(0, subtotal - cartDiscount);
  const taxIncluded = includedTax(total);
  const units = lines.reduce((a, l) => a + l.qty, 0);

  const add = (variantId: string) =>
    patch({ items: { ...state.items, [variantId]: (state.items[variantId] ?? 0) + 1 } });

  const addManual = (item: Omit<PosManualItem, "id">) =>
    patch({ manual: [...state.manual, { ...item, id: `man-${Date.now()}` }] });

  const changeQty = (key: string, delta: number) => {
    if (state.items[key] !== undefined) {
      const next = (state.items[key] ?? 0) + delta;
      const items = { ...state.items };
      if (next <= 0) delete items[key];
      else items[key] = next;
      patch({ items });
      return;
    }
    const manual = state.manual
      .map((m) => (m.id === key ? { ...m, qty: m.qty + delta } : m))
      .filter((m) => m.qty > 0);
    patch({ manual });
  };

  const remove = (key: string) => {
    if (state.items[key] !== undefined) {
      const items = { ...state.items };
      delete items[key];
      patch({ items });
      return;
    }
    patch({ manual: state.manual.filter((m) => m.id !== key) });
  };

  const clear = () => setCarts((c) => ({ ...c, [registerId]: emptyCart() }));

  const suspend = (info: { registerName: string; cashierName: string; customerName: string | null }) => {
    if (lines.length === 0) return null;
    const entry: PosSuspendedCart = {
      id: `SUS-${String(suspended.length + 1).padStart(3, "0")}`,
      registerId,
      at: new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }),
      totalRef: total,
      state,
      ...info,
    };
    setSuspended((s) => [entry, ...s]);
    clear();
    return entry;
  };

  const resume = (id: string) => {
    const found = suspended.find((s) => s.id === id);
    if (!found) return null;
    setCarts((c) => ({ ...c, [registerId]: found.state }));
    setSuspended((s) => s.filter((x) => x.id !== id));
    return found;
  };

  return {
    lines,
    units,
    subtotalRegular,
    lineDiscounts,
    subtotal,
    cartDiscount,
    setCartDiscount: (n: number) => patch({ cartDiscount: n }),
    cartDiscountSource: state.cartDiscountSource,
    setCartDiscountSource: (s: PosDiscountSource) => patch({ cartDiscountSource: s }),
    cartDiscountReason: state.cartDiscountReason,
    setCartDiscountReason: (r: string) => patch({ cartDiscountReason: r }),
    discountTotal,
    taxIncluded,
    total,
    note: state.note,
    setNote: (n: string) => patch({ note: n }),
    channel: state.channel,
    setChannel: (c: PosSalesChannelId | null) => patch({ channel: c }),
    channelDetail: state.channelDetail,
    setChannelDetail: (d: string) => patch({ channelDetail: d }),
    add,
    addManual,
    changeQty,
    remove,
    clear,
    suspend,
    resume,
    suspended,
  };
}

export type PosCartApi = ReturnType<typeof usePosCart>;
