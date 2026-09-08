import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SublimeProduct, SublimeVariant } from "@/types/sublimeHub";
import type { PosCatalogEntry } from "./usePosCart";

const sb = supabase as any;

/**
 * Catálogo REAL del POS: Inventario Maestro Sublime, ubicación que vende en POS.
 * Solo variantes habilitadas, activas, con precio y con disponible > 0.
 */
export function useSublimePosCatalog() {
  return useQuery({
    queryKey: ["sublime_pos_catalog"],
    queryFn: async () => {
      const { data: locs, error: locErr } = await sb
        .from("sublime_locations")
        .select("*")
        .eq("sells_in_pos", true)
        .eq("is_active", true)
        .order("name");
      if (locErr) throw locErr;
      const location = (locs ?? [])[0] as { id: string; name: string } | undefined;
      if (!location) return { location: null, entries: [] as PosCatalogEntry[], categories: [] as string[] };

      const [prodRes, varRes, stockRes] = await Promise.all([
        sb.from("sublime_products").select("*").eq("is_active", true),
        sb.from("sublime_variants").select("*").eq("is_active", true).eq("pos_enabled", true),
        sb.from("sublime_stocks").select("*").eq("location_id", location.id),
      ]);
      for (const r of [prodRes, varRes, stockRes]) if (r.error) throw r.error;

      const products = new Map<string, any>(((prodRes.data ?? []) as any[]).map((p) => [p.id, p]));
      const stockByVariant = new Map<string, number>(
        ((stockRes.data ?? []) as any[]).map((s) => [s.variant_id, Number(s.quantity_available ?? 0)])
      );

      const entries: PosCatalogEntry[] = [];
      for (const v of (varRes.data ?? []) as any[]) {
        const p = products.get(v.product_id);
        if (!p) continue;
        const stock = stockByVariant.get(v.id) ?? 0;
        if (stock <= 0) continue;
        const finalPrice = Number(v.current_price_ref ?? 0);
        if (!(finalPrice > 0)) continue;
        const regularPrice = Math.max(Number(v.full_price_ref ?? finalPrice), finalPrice);
        const unitDiscount = Math.max(0, regularPrice - finalPrice);

        const product: SublimeProduct = {
          id: p.id,
          title: p.name,
          provisionalName: p.name,
          brand: p.brand ?? null,
          category: p.category ?? null,
          collection: null,
          description: null,
          tags: [],
          manufacturerCode: null,
          legacyWebSku: null,
          acquisition: "owned",
          consignmentPct: null,
          preparation: "published",
          referenceImages: p.main_image_url ? [p.main_image_url] : [],
          webImages: p.main_image_url ? [p.main_image_url] : [],
        };

        const variant: SublimeVariant = {
          id: v.id,
          productId: p.id,
          size: v.size ?? "—",
          color: v.color ?? "—",
          sku: v.sku ?? "",
          quantity: stock,
          unitCost: 0,
          pvp: finalPrice,
        };

        entries.push({
          variant,
          product,
          storeStock: stock,
          regularPrice,
          finalPrice,
          unitDiscount,
          discountPct: regularPrice > 0 ? Math.round((unitDiscount / regularPrice) * 100) : 0,
          discountSource: unitDiscount > 0 ? "promo" : null,
        });
      }

      entries.sort((a, b) => a.product.title.localeCompare(b.product.title));
      const categories = Array.from(
        new Set(entries.map((e) => e.product.category).filter(Boolean) as string[])
      ).sort();

      return { location, entries, categories };
    },
  });
}
