import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeName,
  posBlockers,
  SIZE_UNIQUE,
  type CostSource,
  type SublimeChannelMapping,
  type SublimeInvLocation,
  type SublimeInvLot,
  type SublimeInvProduct,
  type SublimeInvProposal,
  type SublimeInvStock,
  type SublimeInvVariant,
  type SublimeWooCatalogRow,
} from "@/lib/sublimeInventory";
import {
  FALLBACK_PRICING_RULES,
  calculateTotalCost,
  calculateTotalUnits,
  findPricingRule,
  getFinalPvp,
  normalizeSizeQuantities,
  type MerchItemLike,
  type PricingRuleLike,
} from "@/lib/sublimeMerch";

const T_LOC = "sublime_locations";
const T_PROD = "sublime_products";
const T_VAR = "sublime_variants";
const T_STOCK = "sublime_stocks";
const T_LOT = "sublime_variant_lots";
const T_PROP = "sublime_stock_intake_proposals";

const sb = supabase as any;

/** Estados de Abastecimiento que representan mercancía físicamente recibida. */
const RECEIVED_STATES = ["received", "available"];

// ---------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------

export function useSublimeLocations() {
  return useQuery({
    queryKey: ["sublime_inv_locations"],
    queryFn: async () => {
      const { data, error } = await sb.from(T_LOC).select("*").order("sells_in_pos", { ascending: false }).order("name");
      if (error) throw error;
      return (data ?? []) as SublimeInvLocation[];
    },
  });
}

export interface InventoryRow {
  product: SublimeInvProduct;
  variant: SublimeInvVariant;
  stocks: SublimeInvStock[];
  lots: SublimeInvLot[];
  proposals: SublimeInvProposal[];
}

export function useSublimeInventory() {
  return useQuery({
    queryKey: ["sublime_inv_all"],
    queryFn: async () => {
      const [prods, vars, stocks, lots, props] = await Promise.all([
        sb.from(T_PROD).select("*").order("name"),
        sb.from(T_VAR).select("*"),
        sb.from(T_STOCK).select("*"),
        sb.from(T_LOT).select("*"),
        sb.from(T_PROP).select("*"),
      ]);
      for (const r of [prods, vars, stocks, lots, props]) if (r.error) throw r.error;
      const products = (prods.data ?? []) as SublimeInvProduct[];
      const variants = (vars.data ?? []) as SublimeInvVariant[];
      const allStocks = (stocks.data ?? []) as SublimeInvStock[];
      const allLots = (lots.data ?? []) as SublimeInvLot[];
      const allProps = (props.data ?? []) as SublimeInvProposal[];
      const byProduct = new Map(products.map((p) => [p.id, p]));

      const rows: InventoryRow[] = variants
        .filter((v) => byProduct.has(v.product_id))
        .map((v) => ({
          product: byProduct.get(v.product_id)!,
          variant: v,
          stocks: allStocks.filter((s) => s.variant_id === v.id),
          lots: allLots.filter((l) => l.variant_id === v.id),
          proposals: allProps.filter((p) => p.variant_id === v.id),
        }))
        .sort((a, b) =>
          a.product.name.localeCompare(b.product.name) ||
          String(a.variant.size ?? "").localeCompare(String(b.variant.size ?? ""))
        );

      return { products, variants, stocks: allStocks, lots: allLots, proposals: allProps, rows };
    },
  });
}

// ---------------------------------------------------------------
// Mutaciones de catálogo / stock
// ---------------------------------------------------------------

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["sublime_inv_all"] });
  qc.invalidateQueries({ queryKey: ["sublime_pos_catalog"] });
}

export function useUpdateSublimeVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SublimeInvVariant> }) => {
      const { error } = await sb.from(T_VAR).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateSublimeProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SublimeInvProduct> }) => {
      const { error } = await sb.from(T_PROD).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Ajuste manual de existencias oficiales (ya validadas). */
export function useSetSublimeStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      variantId,
      locationId,
      onHand,
    }: {
      variantId: string;
      locationId: string;
      onHand: number;
    }) => {
      const { error } = await sb.from(T_STOCK).upsert(
        {
          variant_id: variantId,
          location_id: locationId,
          quantity_on_hand: Math.max(0, Math.floor(onHand)),
          last_counted_at: new Date().toISOString(),
        },
        { onConflict: "variant_id,location_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

/**
 * Recalcula `pos_enabled` de todas las variantes con la única regla de negocio
 * (`posBlockers`). No inventa datos: solo habilita lo que ya cumple.
 */
export function useRecalcPosReadiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const [prods, vars, stocks, locs] = await Promise.all([
        sb.from(T_PROD).select("*"),
        sb.from(T_VAR).select("*"),
        sb.from(T_STOCK).select("*"),
        sb.from(T_LOC).select("*"),
      ]);
      for (const r of [prods, vars, stocks, locs]) if (r.error) throw r.error;
      const products = new Map(((prods.data ?? []) as SublimeInvProduct[]).map((p) => [p.id, p]));
      const posLocs = new Set(
        ((locs.data ?? []) as SublimeInvLocation[]).filter((l) => l.sells_in_pos && l.is_active).map((l) => l.id)
      );
      const stockList = (stocks.data ?? []) as SublimeInvStock[];
      let enabled = 0;
      let disabled = 0;
      for (const v of (vars.data ?? []) as SublimeInvVariant[]) {
        const product = products.get(v.product_id);
        if (!product) continue;
        const posStock = stockList
          .filter((s) => s.variant_id === v.id && posLocs.has(s.location_id))
          .reduce((a, s) => a + Number(s.quantity_available ?? 0), 0);
        const ready = posBlockers({ product, variant: v, posStock }).length === 0;
        if (ready === v.pos_enabled) continue;
        const { error } = await sb.from(T_VAR).update({ pos_enabled: ready }).eq("id", v.id);
        if (error) throw error;
        if (ready) enabled++;
        else disabled++;
      }
      return { enabled, disabled };
    },
    onSuccess: () => invalidate(qc),
  });
}

// ---------------------------------------------------------------
// A. Importación de CATÁLOGO desde Abastecimiento
// ---------------------------------------------------------------

interface MerchRow extends MerchItemLike {
  id: string;
  name: string;
  brand: string | null;
  estado: string | null;
  shipment_id: string | null;
  fotos_web: string[] | null;
  fotos_origen: string[] | null;
}

async function loadMerchContext() {
  const [items, rules, ships] = await Promise.all([
    sb.from("sublime_merch_items").select("*").eq("brand", "sublime"),
    sb.from("sublime_merch_pricing_rules").select("*").eq("brand", "sublime").eq("active", true),
    sb.from("sublime_merch_shipments").select("id, cost_per_kg_eur"),
  ]);
  for (const r of [items, rules, ships]) if (r.error) throw r.error;
  const shipmentById = new Map(
    ((ships.data ?? []) as { id: string; cost_per_kg_eur: number | null }[]).map((s) => [s.id, s])
  );
  const pricingRules = ((rules.data ?? []) as PricingRuleLike[]).length
    ? ((rules.data ?? []) as PricingRuleLike[])
    : FALLBACK_PRICING_RULES;
  return { items: (items.data ?? []) as MerchRow[], pricingRules, shipmentById };
}

function sizesOf(item: MerchRow): { size: string; qty: number }[] {
  if (item.no_size) {
    return [{ size: SIZE_UNIQUE, qty: Math.max(0, Math.floor(Number(item.unit_count ?? 0))) }];
  }
  const q = normalizeSizeQuantities(item.size_quantities as Record<string, unknown> | null);
  const entries = Object.entries(q).map(([size, qty]) => ({ size, qty }));
  return entries.length ? entries : [{ size: SIZE_UNIQUE, qty: Math.max(0, Math.floor(Number(item.unit_count ?? 0))) }];
}

function mainPhoto(item: MerchRow): string | null {
  const web = (item.fotos_web ?? []).filter(Boolean);
  const origen = (item.fotos_origen ?? []).filter(Boolean);
  return web[0] ?? origen[0] ?? null;
}

export interface ImportCatalogResult {
  itemsScanned: number;
  productsCreated: number;
  productsLinked: number;
  variantsCreated: number;
  lotsCreated: number;
  lotsUpdated: number;
  skusAssigned: number;
  skipped: number;
}

/**
 * Crea/actualiza catálogo desde las compras de Abastecimiento.
 * Idempotente: reconoce el lote ya vinculado y nunca duplica productos.
 * NO escribe stock y NO inventa SKU, color ni categoría.
 */
export function useImportSublimeCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ImportCatalogResult> => {
      const { items, pricingRules, shipmentById } = await loadMerchContext();
      const [prods, vars, lots] = await Promise.all([
        sb.from(T_PROD).select("*"),
        sb.from(T_VAR).select("*"),
        sb.from(T_LOT).select("*"),
      ]);
      for (const r of [prods, vars, lots]) if (r.error) throw r.error;

      const products = (prods.data ?? []) as SublimeInvProduct[];
      const variants = (vars.data ?? []) as SublimeInvVariant[];
      const existingLots = (lots.data ?? []) as SublimeInvLot[];

      const productByName = new Map(products.map((p) => [`${p.brand}|${normalizeName(p.name)}`, p]));
      const variantBySku = new Map(variants.filter((v) => v.sku).map((v) => [v.sku!.trim().toLowerCase(), v]));
      const productByLotItem = new Map<string, string>();
      for (const l of existingLots) {
        const v = variants.find((x) => x.id === l.variant_id);
        if (v) productByLotItem.set(l.merch_item_id, v.product_id);
      }
      const takenSkus = new Set(variants.filter((v) => v.sku).map((v) => v.sku!.trim().toLowerCase()));

      const res: ImportCatalogResult = {
        itemsScanned: items.length,
        productsCreated: 0,
        productsLinked: 0,
        variantsCreated: 0,
        lotsCreated: 0,
        lotsUpdated: 0,
        skusAssigned: 0,
        skipped: 0,
      };

      for (const item of items) {
        if (!item.name || !item.name.trim()) {
          res.skipped++;
          continue;
        }
        const rule = findPricingRule(pricingRules, item.product_type);
        const shipment = item.shipment_id ? shipmentById.get(item.shipment_id) ?? null : null;
        const finalPvp = getFinalPvp(item, rule, shipment);
        const totalUnits = Math.max(1, calculateTotalUnits(item));
        const unitCost = calculateTotalCost(item, shipment) / totalUnits;
        const costRef = Number.isFinite(unitCost) && unitCost > 0 ? Number(unitCost.toFixed(2)) : null;
        const costSource: CostSource = item.is_consignment ? "consignacion" : "abastecimiento";

        // 1) Producto destino: lote ya vinculado → SKU → nombre normalizado → nuevo.
        let productId = productByLotItem.get(item.id) ?? null;
        const sku = (item.sku_web ?? "").trim();
        if (!productId && sku) {
          const hit = variantBySku.get(sku.toLowerCase());
          if (hit) productId = hit.product_id;
        }
        const nameKey = `sublime|${normalizeName(item.name)}`;
        if (!productId) {
          const hit = productByName.get(nameKey);
          if (hit) {
            productId = hit.id;
            res.productsLinked++;
          }
        }
        if (!productId) {
          const { data, error } = await sb
            .from(T_PROD)
            .insert({
              name: item.name.trim(),
              brand: "sublime",
              category: null,
              product_type: item.product_type ?? null,
              main_image_url: mainPhoto(item),
              is_active: true,
            })
            .select()
            .single();
          if (error) throw error;
          productId = (data as SublimeInvProduct).id;
          products.push(data as SublimeInvProduct);
          productByName.set(nameKey, data as SublimeInvProduct);
          res.productsCreated++;
        }

        const entries = sizesOf(item);
        const singleVariant = entries.length === 1;

        for (const { size, qty } of entries) {
          let variant = variants.find(
            (v) => v.product_id === productId && (v.size ?? "") === size && !v.color
          );
          if (!variant) {
            // SKU solo si viene del origen y no está ocupado; jamás inventado.
            let assignSku: string | null = null;
            if (sku && singleVariant && !takenSkus.has(sku.toLowerCase())) {
              assignSku = sku;
              takenSkus.add(sku.toLowerCase());
              res.skusAssigned++;
            }
            const { data, error } = await sb
              .from(T_VAR)
              .insert({
                product_id: productId,
                size,
                color: null,
                sku: assignSku,
                full_price_ref: finalPvp,
                current_price_ref: finalPvp,
                is_active: true,
                pos_enabled: false,
                cost_ref: costRef,
                cost_source: costRef != null ? costSource : null,
              })
              .select()
              .single();
            if (error) throw error;
            variant = data as SublimeInvVariant;
            variants.push(variant);
            if (variant.sku) variantBySku.set(variant.sku.toLowerCase(), variant);
            res.variantsCreated++;
          } else {
            const patch: Record<string, unknown> = {};
            if (variant.current_price_ref == null && finalPvp != null) {
              patch.current_price_ref = finalPvp;
              patch.full_price_ref = finalPvp;
            }
            // Costo heredado del lote solo si la variante aún no tiene ninguno.
            if (variant.cost_ref == null && costRef != null) {
              patch.cost_ref = costRef;
              patch.cost_source = costSource;
            }
            if (Object.keys(patch).length) {
              const { error } = await sb.from(T_VAR).update(patch).eq("id", variant.id);
              if (error) throw error;
              Object.assign(variant, patch);
            }
          }

          // 2) Lote: costo, envío y consignación siempre conservados.
          const lotPayload = {
            variant_id: variant.id,
            merch_item_id: item.id,
            size,
            qty_from_lot: qty,
            unit_cost_ref: Number.isFinite(unitCost) ? Number(unitCost.toFixed(2)) : null,
            shipment_id: item.shipment_id ?? null,
            is_consignment: !!item.is_consignment,
            consignment_commission_pct: item.consignment_commission_pct ?? null,
            consignment_commission_amount: item.consignment_commission_amount ?? null,
          };
          const already = existingLots.find((l) => l.merch_item_id === item.id && l.variant_id === variant!.id);
          const { error } = await sb.from(T_LOT).upsert(lotPayload, { onConflict: "merch_item_id,variant_id" });
          if (error) throw error;
          if (already) res.lotsUpdated++;
          else res.lotsCreated++;
          productByLotItem.set(item.id, productId!);
        }
      }

      return res;
    },
    onSuccess: () => invalidate(qc),
  });
}

// ---------------------------------------------------------------
// B. Propuesta de STOCK INICIAL (nunca stock oficial)
// ---------------------------------------------------------------

export interface ProposeStockResult {
  proposalsCreated: number;
  proposalsUpdated: number;
  itemsConsidered: number;
  itemsSkippedNotReceived: number;
}

export function useProposeInitialStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (locationId: string): Promise<ProposeStockResult> => {
      const { items } = await loadMerchContext();
      const [lots, props] = await Promise.all([
        sb.from(T_LOT).select("*"),
        sb.from(T_PROP).select("*").eq("location_id", locationId),
      ]);
      for (const r of [lots, props]) if (r.error) throw r.error;
      const allLots = (lots.data ?? []) as SublimeInvLot[];
      const existing = (props.data ?? []) as SublimeInvProposal[];

      const received = items.filter((i) => RECEIVED_STATES.includes(String(i.estado ?? "")));
      const suggested = new Map<string, { qty: number; item: string }>();
      for (const item of received) {
        for (const l of allLots.filter((x) => x.merch_item_id === item.id)) {
          const prev = suggested.get(l.variant_id);
          suggested.set(l.variant_id, {
            qty: (prev?.qty ?? 0) + Number(l.qty_from_lot ?? 0),
            item: item.id,
          });
        }
      }

      const res: ProposeStockResult = {
        proposalsCreated: 0,
        proposalsUpdated: 0,
        itemsConsidered: received.length,
        itemsSkippedNotReceived: items.length - received.length,
      };

      for (const [variantId, info] of suggested) {
        const prev = existing.find((p) => p.variant_id === variantId);
        if (prev && prev.status === "confirmed") continue;
        const { error } = await sb.from(T_PROP).upsert(
          {
            variant_id: variantId,
            location_id: locationId,
            suggested_qty: info.qty,
            source_merch_item_id: info.item,
            status: "pending",
          },
          { onConflict: "variant_id,location_id" }
        );
        if (error) throw error;
        if (prev) res.proposalsUpdated++;
        else res.proposalsCreated++;
      }
      return res;
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Confirma el conteo físico: aquí (y solo aquí) nace el stock oficial. */
export function useConfirmProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      variantId,
      counts,
      note,
    }: {
      variantId: string;
      counts: { locationId: string; qty: number }[];
      note?: string;
    }) => {
      const now = new Date().toISOString();
      const { data: userRes } = await supabase.auth.getUser();
      for (const c of counts) {
        const qty = Math.max(0, Math.floor(c.qty));
        const { error: stockErr } = await sb.from(T_STOCK).upsert(
          {
            variant_id: variantId,
            location_id: c.locationId,
            quantity_on_hand: qty,
            last_counted_at: now,
          },
          { onConflict: "variant_id,location_id" }
        );
        if (stockErr) throw stockErr;
        const { error: propErr } = await sb.from(T_PROP).upsert(
          {
            variant_id: variantId,
            location_id: c.locationId,
            suggested_qty: 0,
            counted_qty: qty,
            status: "confirmed",
            note: note ?? null,
            confirmed_at: now,
            confirmed_by: userRes?.user?.id ?? null,
          },
          { onConflict: "variant_id,location_id", ignoreDuplicates: false }
        );
        if (propErr) throw propErr;
      }
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDiscardProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await sb.from(T_PROP).update({ status: "discarded", note }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Compras de Abastecimiento que todavía no alimentan ningún producto. */
export function useUnimportedMerchItems() {
  return useQuery({
    queryKey: ["sublime_inv_unimported"],
    queryFn: async () => {
      const [items, lots] = await Promise.all([
        sb.from("sublime_merch_items").select("id, name, estado, product_type, sku_web").eq("brand", "sublime"),
        sb.from(T_LOT).select("merch_item_id"),
      ]);
      for (const r of [items, lots]) if (r.error) throw r.error;
      const linked = new Set(((lots.data ?? []) as { merch_item_id: string }[]).map((l) => l.merch_item_id));
      return ((items.data ?? []) as { id: string; name: string; estado: string | null }[]).filter(
        (i) => !linked.has(i.id)
      );
    },
  });
}

// ---------------------------------------------------------------
// C. Mapeo Woo ↔ Hub (Woo NUNCA es fuente de verdad)
// ---------------------------------------------------------------

const T_WOO = "sublime_woo_catalog";
const T_MAP = "sublime_channel_mappings";

export function useSublimeWooCatalog() {
  return useQuery({
    queryKey: ["sublime_woo_catalog"],
    queryFn: async () => {
      const { data, error } = await sb.from(T_WOO).select("*").order("name").order("woo_variation_id", { nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as SublimeWooCatalogRow[];
    },
  });
}

export function useSublimeMappings() {
  return useQuery({
    queryKey: ["sublime_channel_mappings"],
    queryFn: async () => {
      const { data, error } = await sb.from(T_MAP).select("*").eq("channel", "woo");
      if (error) throw error;
      return (data ?? []) as SublimeChannelMapping[];
    },
  });
}

function invalidateWoo(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["sublime_woo_catalog"] });
  qc.invalidateQueries({ queryKey: ["sublime_channel_mappings"] });
  invalidate(qc);
}

export interface WooReadJob {
  id: string;
  status: "queued" | "fetching_woo" | "matching" | "completed" | "failed";
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
  total_items: number;
  processed_items: number;
  mapped_count: number;
  possible_match_count: number;
  unmapped_count: number;
  incomplete_count: number;
  ignored_count: number;
  error_message: string | null;
  cursor_page?: number;
  error_items?: unknown[];
}

export const WOO_JOB_ACTIVE: WooReadJob["status"][] = ["queued", "fetching_woo", "matching"];

/** Un job activo sin latido durante 3 minutos se considera interrumpido. */
export function isWooJobStalled(j: WooReadJob | null | undefined) {
  if (!j || !WOO_JOB_ACTIVE.includes(j.status)) return false;
  return Date.now() - new Date(j.updated_at).getTime() > 3 * 60 * 1000;
}


/** Último trabajo de lectura Woo. Se consulta en segundo plano mientras esté activo. */
export function useWooReadJob() {
  const qc = useQueryClient();
  const lastCompleted = useRef<string | null>(null);
  const query = useQuery({
    queryKey: ["sublime_woo_read_job"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("sublime_woo_read_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as WooReadJob | null;
    },
    refetchInterval: (q) => {
      const j = q.state.data as WooReadJob | null | undefined;
      return j && WOO_JOB_ACTIVE.includes(j.status) ? 3000 : false;
    },
  });

  useEffect(() => {
    const j = query.data;
    if (j && j.status === "completed" && lastCompleted.current !== j.id) {
      lastCompleted.current = j.id;
      invalidateWoo(qc);
    }
  }, [query.data, qc]);

  return query;
}

/** Inicia (o reanuda) el trabajo de lectura del catálogo Woo en el backend. */
export function useReadWooCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts?: { resume?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("sublime-woo-catalog-read", {
        body: { resume: opts?.resume === true },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx?.text) {
            const j = JSON.parse(await ctx.text());
            msg = j.message ?? j.error ?? msg;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      return data as { started?: boolean; already_running?: boolean; resumed?: boolean; job: WooReadJob };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sublime_woo_read_job"] }),
  });
}


async function upsertMapping(payload: Partial<SublimeChannelMapping> & { external_product_id: number; external_variation_id: number | null }) {
  const { data: userRes } = await supabase.auth.getUser();
  const q = sb.from(T_MAP).select("id").eq("channel", "woo").eq("external_product_id", payload.external_product_id);
  const { data: prev } = payload.external_variation_id
    ? await q.eq("external_variation_id", payload.external_variation_id).maybeSingle()
    : await q.is("external_variation_id", null).maybeSingle();
  const row = { channel: "woo", ...payload, mapped_by: userRes?.user?.id ?? null, mapped_at: new Date().toISOString() };
  const { error } = prev?.id
    ? await sb.from(T_MAP).update(row).eq("id", prev.id)
    : await sb.from(T_MAP).insert(row);
  if (error) throw error;
}

/** Vincula una fila Woo a una variante existente y guarda el ID como espejo. */
export function useLinkWooToVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      row,
      variantId,
      productId,
      method,
    }: {
      row: SublimeWooCatalogRow;
      variantId: string;
      productId: string;
      method: SublimeChannelMapping["match_method"];
    }) => {
      await upsertMapping({
        external_product_id: row.woo_product_id,
        external_variation_id: row.woo_variation_id,
        variant_id: variantId,
        product_id: productId,
        status: "mapped",
        match_method: method,
      });
      // Espejo de lectura para no romper V1 (nunca autoridad).
      const { error: pe } = await sb.from(T_PROD).update({ woo_product_id: row.woo_product_id }).eq("id", productId);
      if (pe) throw pe;
      if (row.woo_variation_id) {
        const { error: ve } = await sb.from(T_VAR).update({ woo_variation_id: row.woo_variation_id }).eq("id", variantId);
        if (ve) throw ve;
      }
    },
    onSuccess: () => invalidateWoo(qc),
  });
}

/**
 * Crea un producto maestro desde los datos Woo. Copia nombre, imagen, talla,
 * color, precio y SKU si Woo lo trae. Categoría y costo quedan pendientes.
 */
export function useCreateProductFromWoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rows }: { rows: SublimeWooCatalogRow[] }) => {
      if (!rows.length) return;
      const parent = rows.find((r) => !r.woo_variation_id) ?? rows[0];
      const variations = rows.filter((r) => r.woo_variation_id);
      const { data: existingVars } = await sb.from(T_VAR).select("sku");
      const taken = new Set(((existingVars ?? []) as { sku: string | null }[]).map((v) => v.sku?.trim().toLowerCase()).filter(Boolean));

      const { data: prod, error: pe } = await sb
        .from(T_PROD)
        .insert({
          name: parent.name.trim(),
          brand: "sublime",
          category: null,
          main_image_url: parent.image_url,
          is_active: true,
          woo_product_id: parent.woo_product_id,
        })
        .select()
        .single();
      if (pe) throw pe;
      const productId = (prod as SublimeInvProduct).id;

      const toCreate = variations.length ? variations : [parent];
      for (const r of toCreate) {
        const skuRaw = r.sku?.trim() ?? "";
        const sku = skuRaw && !taken.has(skuRaw.toLowerCase()) ? skuRaw : null;
        if (sku) taken.add(sku.toLowerCase());
        const price = r.price ?? r.regular_price ?? null;
        const full = r.regular_price ?? r.price ?? null;
        const { data: v, error: ve } = await sb
          .from(T_VAR)
          .insert({
            product_id: productId,
            size: r.size_label ?? (variations.length ? null : SIZE_UNIQUE),
            color: r.color_label ?? null,
            sku,
            full_price_ref: full,
            current_price_ref: price,
            is_active: true,
            pos_enabled: false,
            woo_variation_id: r.woo_variation_id,
          })
          .select()
          .single();
        if (ve) throw ve;
        await upsertMapping({
          external_product_id: r.woo_product_id,
          external_variation_id: r.woo_variation_id,
          variant_id: (v as SublimeInvVariant).id,
          product_id: productId,
          status: "mapped",
          match_method: "manual",
        });
      }
      if (variations.length) {
        await upsertMapping({
          external_product_id: parent.woo_product_id,
          external_variation_id: null,
          variant_id: null,
          product_id: productId,
          status: "mapped",
          match_method: "manual",
        });
      }
      return productId;
    },
    onSuccess: () => invalidateWoo(qc),
  });
}

export function useIgnoreWooItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ row, ignore }: { row: SublimeWooCatalogRow; ignore: boolean }) => {
      if (ignore) {
        await upsertMapping({
          external_product_id: row.woo_product_id,
          external_variation_id: row.woo_variation_id,
          variant_id: null,
          product_id: null,
          status: "ignored",
          match_method: "manual",
        });
      } else {
        const q = sb.from(T_MAP).delete().eq("channel", "woo").eq("external_product_id", row.woo_product_id).eq("status", "ignored");
        const { error } = row.woo_variation_id
          ? await q.eq("external_variation_id", row.woo_variation_id)
          : await q.is("external_variation_id", null);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateWoo(qc),
  });
}

export function useUpdateVariantCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cost_ref, cost_source, cost_note }: { id: string; cost_ref: number | null; cost_source: CostSource | null; cost_note?: string | null }) => {
      const { error } = await sb.from(T_VAR).update({ cost_ref, cost_source, cost_note: cost_note ?? null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}
