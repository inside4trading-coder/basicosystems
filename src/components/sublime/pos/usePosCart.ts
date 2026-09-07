import { useCallback, useMemo, useState } from "react";
import { mockProducts, mockUnits, mockVariants } from "@/lib/sublimeMock";
import type { SublimeProduct, SublimeVariant } from "@/types/sublimeHub";
import {
  POS_DEFAULT_CHANNEL,
  type PosSalesChannelId,
} from "@/lib/posSalesChannels";

export const POS_STORE_LOCATION = "loc-bq";
export const POS_BCV_RATE = 150;
export const POS_TAX_PCT = 16;

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
  /** Precio regular / full en REF. */
  regularPrice: number;
  /** Precio vigente en REF. */
  finalPrice: number;
  /** Descuento por unidad en REF (0 si no hay). */
  unitDiscount: number;
  discountPct: number;
  discountSource: PosDiscountSource | null;
}

export interface PosCartLine extends PosCatalogEntry {
  qty: number;
  /** Precio regular × cantidad. */
  regularTotal: number;
  /** Descuento total de la línea. */
  discountTotal: number;
  /** Precio final × cantidad. */
  lineTotal: number;
  discount: PosLineDiscount | null;
}

/** Disponibilidad exclusiva de la tienda activa: nunca suma almacén. */
export function storeStockOf(variantId: string, locationId = POS_STORE_LOCATION) {
  return mockUnits.filter(
    (u) => u.variantId === variantId && u.locationId === locationId && u.status === "available"
  ).length;
}

/**
 * Precios promocionales simulados: precio regular por variante.
 * El precio vigente sigue siendo el `pvp` del catálogo.
 */
const POS_REGULAR_PRICES: Record<string, number> = {
  "var-1": 40,
  "var-2": 40,
  "var-4": 60,
  "var-7": 92,
};

export const posCatalog: PosCatalogEntry[] = mockVariants.map((variant) => {
  const finalPrice = variant.pvp;
  const regularPrice = Math.max(POS_REGULAR_PRICES[variant.id] ?? finalPrice, finalPrice);
  const unitDiscount = Math.max(0, regularPrice - finalPrice);
  return {
    variant,
    product: mockProducts.find((p) => p.id === variant.productId)!,
    storeStock: storeStockOf(variant.id),
    regularPrice,
    finalPrice,
    unitDiscount,
    discountPct: regularPrice > 0 ? Math.round((unitDiscount / regularPrice) * 100) : 0,
    discountSource: unitDiscount > 0 ? ("promo" as PosDiscountSource) : null,
  };
});

export const posCategories = Array.from(
  new Set(posCatalog.map((e) => e.product.category).filter(Boolean) as string[])
);

interface RegisterCartState {
  items: Record<string, number>;
  cartDiscount: number;
  cartDiscountSource: PosDiscountSource;
  cartDiscountReason: string;
  taxEnabled: boolean;
  note: string;
  channel: PosSalesChannelId;
  channelDetail: string;
}

const emptyCart = (): RegisterCartState => ({
  items: {},
  cartDiscount: 0,
  cartDiscountSource: "manual_fixed",
  cartDiscountReason: "",
  taxEnabled: false,
  note: "",
  channel: POS_DEFAULT_CHANNEL,
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

/**
 * Cada caja/sesión mantiene su propio carrito activo: Caja 1 y Caja 2 no
 * comparten carrito. El inventario, en cambio, es único por sede.
 */
export function usePosCart(registerId: string) {
  const [carts, setCarts] = useState<Record<string, RegisterCartState>>({});
  const [suspended, setSuspended] = useState<PosSuspendedCart[]>([]);

  const state = carts[registerId] ?? emptyCart();

  const patch = useCallback(
    (p: Partial<RegisterCartState>) =>
      setCarts((c) => ({ ...c, [registerId]: { ...(c[registerId] ?? emptyCart()), ...p } })),
    [registerId]
  );

  const lines: PosCartLine[] = useMemo(
    () =>
      Object.entries(state.items).map(([variantId, qty]) => {
        const entry = posCatalog.find((e) => e.variant.id === variantId)!;
        const discountTotal = entry.unitDiscount * qty;
        return {
          ...entry,
          qty,
          regularTotal: entry.regularPrice * qty,
          discountTotal,
          lineTotal: entry.finalPrice * qty,
          discount:
            entry.unitDiscount > 0
              ? { source: entry.discountSource ?? "promo", amount: entry.unitDiscount }
              : null,
        };
      }),
    [state.items]
  );

  const subtotalRegular = lines.reduce((a, l) => a + l.regularTotal, 0);
  const lineDiscounts = lines.reduce((a, l) => a + l.discountTotal, 0);
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const cartDiscount = Math.min(state.cartDiscount, subtotal);
  const discountTotal = lineDiscounts + cartDiscount;
  const taxable = Math.max(0, subtotal - cartDiscount);
  const taxUsd = state.taxEnabled ? (taxable * POS_TAX_PCT) / 100 : 0;
  const total = taxable + taxUsd;
  const units = lines.reduce((a, l) => a + l.qty, 0);

  const add = (variantId: string) =>
    patch({ items: { ...state.items, [variantId]: (state.items[variantId] ?? 0) + 1 } });

  const changeQty = (variantId: string, delta: number) => {
    const next = (state.items[variantId] ?? 0) + delta;
    const items = { ...state.items };
    if (next <= 0) delete items[variantId];
    else items[variantId] = next;
    patch({ items });
  };

  const remove = (variantId: string) => {
    const items = { ...state.items };
    delete items[variantId];
    patch({ items });
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
    taxEnabled: state.taxEnabled,
    setTaxEnabled: (v: boolean) => patch({ taxEnabled: v }),
    taxUsd,
    total,
    note: state.note,
    setNote: (n: string) => patch({ note: n }),
    channel: state.channel,
    setChannel: (c: PosSalesChannelId) => patch({ channel: c }),
    channelDetail: state.channelDetail,
    setChannelDetail: (d: string) => patch({ channelDetail: d }),
    add,
    changeQty,
    remove,
    clear,
    suspend,
    resume,
    suspended,
  };
}

export type PosCartApi = ReturnType<typeof usePosCart>;
