import { useMemo, useState } from "react";
import { mockProducts, mockUnits, mockVariants } from "@/lib/sublimeMock";
import type { SublimeProduct, SublimeVariant } from "@/types/sublimeHub";

export const POS_STORE_LOCATION = "loc-bq";
export const POS_BCV_RATE = 150;
export const POS_TAX_PCT = 16;

export interface PosCatalogEntry {
  variant: SublimeVariant;
  product: SublimeProduct;
  storeStock: number;
}

export interface PosCartLine extends PosCatalogEntry {
  qty: number;
  lineTotal: number;
}

/** Disponibilidad exclusiva de la tienda activa: nunca suma almacén. */
export function storeStockOf(variantId: string, locationId = POS_STORE_LOCATION) {
  return mockUnits.filter(
    (u) => u.variantId === variantId && u.locationId === locationId && u.status === "available"
  ).length;
}

export const posCatalog: PosCatalogEntry[] = mockVariants.map((variant) => ({
  variant,
  product: mockProducts.find((p) => p.id === variant.productId)!,
  storeStock: storeStockOf(variant.id),
}));

export const posCategories = Array.from(
  new Set(posCatalog.map((e) => e.product.category).filter(Boolean) as string[])
);

export function usePosCart() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [discountUsd, setDiscountUsd] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [note, setNote] = useState("");

  const lines: PosCartLine[] = useMemo(
    () =>
      Object.entries(cart).map(([variantId, qty]) => {
        const entry = posCatalog.find((e) => e.variant.id === variantId)!;
        return { ...entry, qty, lineTotal: entry.variant.pvp * qty };
      }),
    [cart]
  );

  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const taxable = Math.max(0, subtotal - discountUsd);
  const taxUsd = taxEnabled ? (taxable * POS_TAX_PCT) / 100 : 0;
  const total = taxable + taxUsd;
  const units = lines.reduce((a, l) => a + l.qty, 0);

  const add = (variantId: string) =>
    setCart((c) => ({ ...c, [variantId]: (c[variantId] ?? 0) + 1 }));

  const changeQty = (variantId: string, delta: number) =>
    setCart((c) => {
      const next = (c[variantId] ?? 0) + delta;
      const copy = { ...c };
      if (next <= 0) delete copy[variantId];
      else copy[variantId] = next;
      return copy;
    });

  const remove = (variantId: string) =>
    setCart((c) => {
      const copy = { ...c };
      delete copy[variantId];
      return copy;
    });

  const clear = () => {
    setCart({});
    setDiscountUsd(0);
    setTaxEnabled(false);
    setNote("");
  };

  return {
    lines,
    units,
    subtotal,
    discountUsd,
    setDiscountUsd,
    taxEnabled,
    setTaxEnabled,
    taxUsd,
    total,
    note,
    setNote,
    add,
    changeQty,
    remove,
    clear,
  };
}
