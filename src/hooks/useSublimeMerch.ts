import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  uploadSublimeMerchPhoto,
  deleteSublimeMerchPhotoFromStorage,
  type PhotoType,
} from "@/lib/sublimeMerch";

export interface SublimeMerchItem {
  id: string;
  name: string;
  precio_compra: number;
  codigo_fabricante: string | null;
  peso_kg: number;
  pvp: number | null;
  sku_web: string | null;
  fotos_origen: string[];
  fotos_web: string[];
  shipment_id: string | null;
  box_id: string | null;
  estado: string;
  subido_al_sistema: boolean;
  uploaded_at: string | null;
  uploaded_by: string | null;
  received_at: string | null;
  received_by: string | null;
  tax_enabled: boolean;
  tax_amount: number;
  tax_note: string | null;
  notas: string | null;
  size_group: string;
  no_size: boolean;
  unit_count: number;
  size_quantities: Record<string, number>;
  product_type: string;
  use_manual_pvp: boolean;
  pvp_manual: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface MerchItemInput {
  id?: string;
  name: string;
  precio_compra: number;
  codigo_fabricante: string | null;
  peso_kg: number;
  pvp: number | null;
  sku_web: string | null;
  notas: string | null;
  subido_al_sistema: boolean;
  size_group: string;
  no_size: boolean;
  unit_count: number;
  size_quantities: Record<string, number>;
  product_type: string;
  use_manual_pvp: boolean;
  pvp_manual: number | null;
}

export interface SublimePricingRule {
  id: string;
  product_type: string;
  label: string;
  profit_percentage: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingRuleInput {
  product_type?: string;
  label: string;
  profit_percentage: number;
  active?: boolean;
}


export interface SublimeMerchShipment {
  id: string;
  shipment_number: string;
  sent_at: string | null;
  received_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  cost_per_kg_eur: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShipmentInput {
  shipment_number: string;
  sent_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  cost_per_kg_eur: number;
  status: string;
  notes: string | null;
}

export interface SublimeMerchBox {
  id: string;
  shipment_id: string;
  box_number: string;
  weight_kg: number;
  status: string;
  received_at: string | null;
  received_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoxInput {
  shipment_id: string;
  box_number: string;
  weight_kg: number;
  status: string;
  notes: string | null;
}

const TABLE = "sublime_merch_items";
const T_SHIP = "sublime_merch_shipments";
const T_BOX = "sublime_merch_boxes";

export function useUnassignedItems() {
  return useQuery({
    queryKey: ["sublime-merch", "unassigned"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .or("shipment_id.is.null,box_id.is.null")
        .neq("estado", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SublimeMerchItem[];
    },
  });
}

export function useSublimeItem(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ["sublime-merch", "item", itemId ?? "none"],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .eq("id", itemId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SublimeMerchItem | null;
    },
  });
}



export function useInTransitItems() {
  return useQuery({
    queryKey: ["sublime-merch", "in-transit"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .not("shipment_id", "is", null)
        .not("box_id", "is", null)
        .not("estado", "in", "(available,cancelled)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SublimeMerchItem[];
    },
  });
}

export function useItemsCounts() {
  return useQuery({
    queryKey: ["sublime-merch", "counts"],
    queryFn: async () => {
      const inTransit = await (supabase as any)
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .eq("estado", "in_transit");
      const available = await (supabase as any)
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .in("estado", ["received", "available"]);
      return {
        in_transit: inTransit.count ?? 0,
        available: available.count ?? 0,
      };
    },
  });
}

export function useSublimeShipments() {
  return useQuery({
    queryKey: ["sublime-merch", "shipments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(T_SHIP)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SublimeMerchShipment[];
    },
  });
}

export function useSublimeBoxes(shipmentId?: string | null) {
  return useQuery({
    queryKey: ["sublime-merch", "boxes", shipmentId ?? "all"],
    enabled: shipmentId !== undefined,
    queryFn: async () => {
      let q = (supabase as any)
        .from(T_BOX)
        .select("*")
        .order("created_at", { ascending: true });
      if (shipmentId) q = q.eq("shipment_id", shipmentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SublimeMerchBox[];
    },
  });
}

export function useShipmentBoxCounts() {
  return useQuery({
    queryKey: ["sublime-merch", "box-counts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(T_BOX)
        .select("shipment_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as { shipment_id: string }[]) {
        map[row.shipment_id] = (map[row.shipment_id] ?? 0) + 1;
      }
      return map;
    },
  });
}

export async function getNextShipmentNumber(): Promise<string> {
  const { data, error } = await (supabase as any)
    .from(T_SHIP)
    .select("shipment_number");
  if (error) throw error;
  let max = 0;
  for (const row of (data ?? []) as { shipment_number: string }[]) {
    const m = /^S(\d{3,})$/.exec(row.shipment_number ?? "");
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `S${String(max + 1).padStart(3, "0")}`;
}

export function useMerchMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sublime-merch"] });
  };

  const createItem = useMutation({
    mutationFn: async (input: MerchItemInput) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      const payload: Record<string, unknown> = {
        name: input.name.trim(),
        precio_compra: input.precio_compra,
        codigo_fabricante: input.codigo_fabricante,
        peso_kg: input.peso_kg,
        pvp: input.pvp,
        sku_web: input.sku_web,
        notas: input.notas,
        subido_al_sistema: input.subido_al_sistema,
        uploaded_at: input.subido_al_sistema ? new Date().toISOString() : null,
        uploaded_by: input.subido_al_sistema ? uid : null,
        size_group: input.size_group,
        no_size: input.no_size,
        unit_count: input.unit_count,
        size_quantities: input.size_quantities,
        product_type: input.product_type,
        use_manual_pvp: input.use_manual_pvp,
        pvp_manual: input.pvp_manual,
        created_by: uid,

      };
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as SublimeMerchItem;
    },
    onSuccess: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      input,
      wasUploaded,
    }: {
      id: string;
      input: MerchItemInput;
      wasUploaded: boolean;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      const payload: Record<string, unknown> = {
        name: input.name.trim(),
        precio_compra: input.precio_compra,
        codigo_fabricante: input.codigo_fabricante,
        peso_kg: input.peso_kg,
        pvp: input.pvp,
        sku_web: input.sku_web,
        notas: input.notas,
        subido_al_sistema: input.subido_al_sistema,
        size_group: input.size_group,
        no_size: input.no_size,
        unit_count: input.unit_count,
        size_quantities: input.size_quantities,
        product_type: input.product_type,
        use_manual_pvp: input.use_manual_pvp,
        pvp_manual: input.pvp_manual,
      };

      if (input.subido_al_sistema && !wasUploaded) {
        payload.uploaded_at = new Date().toISOString();
        payload.uploaded_by = uid;
      }
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SublimeMerchItem;
    },
    onSuccess: invalidate,
  });

  const addPhotoToItem = useMutation({
    mutationFn: async ({
      itemId,
      type,
      url,
    }: {
      itemId: string;
      type: PhotoType;
      url: string;
    }) => {
      const col = type === "origen" ? "fotos_origen" : "fotos_web";
      const { data: current, error: readErr } = await (supabase as any)
        .from(TABLE)
        .select(col)
        .eq("id", itemId)
        .single();
      if (readErr) throw readErr;
      const existing: string[] = (current?.[col] as string[]) ?? [];
      if (existing.includes(url)) return existing;
      const next = [...existing, url];
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ [col]: next })
        .eq("id", itemId);
      if (error) throw error;
      return next;
    },
    onSuccess: invalidate,
  });

  const removePhotoFromItem = useMutation({
    mutationFn: async ({
      itemId,
      type,
      url,
    }: {
      itemId: string;
      type: PhotoType;
      url: string;
    }) => {
      const col = type === "origen" ? "fotos_origen" : "fotos_web";
      const { data: current, error: readErr } = await (supabase as any)
        .from(TABLE)
        .select(col)
        .eq("id", itemId)
        .single();
      if (readErr) throw readErr;
      const existing: string[] = (current?.[col] as string[]) ?? [];
      const next = existing.filter((u) => u !== url);
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ [col]: next })
        .eq("id", itemId);
      if (error) throw error;
      await deleteSublimeMerchPhotoFromStorage(url).catch(() => undefined);
      return next;
    },
    onSuccess: invalidate,
  });

  const uploadPhotoToItem = useMutation({
    mutationFn: async ({
      itemId,
      type,
      file,
    }: {
      itemId: string;
      type: PhotoType;
      file: File;
    }) => {
      const url = await uploadSublimeMerchPhoto(itemId, type, file);
      await addPhotoToItem.mutateAsync({ itemId, type, url });
      return url;
    },
  });

  const addWebPhotoUrl = useMutation({
    mutationFn: async ({ itemId, url }: { itemId: string; url: string }) => {
      await addPhotoToItem.mutateAsync({ itemId, type: "web", url });
      return url;
    },
  });

  const createShipment = useMutation({
    mutationFn: async (input: ShipmentInput) => {
      const payload: Record<string, unknown> = {
        shipment_number: input.shipment_number.trim(),
        sent_at: input.sent_at,
        carrier: input.carrier,
        tracking_number: input.tracking_number,
        cost_per_kg_eur: input.cost_per_kg_eur,
        status: input.status,
        notes: input.notes,
      };
      const { data, error } = await (supabase as any)
        .from(T_SHIP)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as SublimeMerchShipment;
    },
    onSuccess: invalidate,
  });

  const updateShipment = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ShipmentInput }) => {
      const payload: Record<string, unknown> = {
        shipment_number: input.shipment_number.trim(),
        sent_at: input.sent_at,
        carrier: input.carrier,
        tracking_number: input.tracking_number,
        cost_per_kg_eur: input.cost_per_kg_eur,
        status: input.status,
        notes: input.notes,
      };
      const { data, error } = await (supabase as any)
        .from(T_SHIP)
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SublimeMerchShipment;
    },
    onSuccess: invalidate,
  });

  const createBox = useMutation({
    mutationFn: async (input: BoxInput) => {
      const payload: Record<string, unknown> = {
        shipment_id: input.shipment_id,
        box_number: input.box_number.trim(),
        weight_kg: input.weight_kg,
        status: input.status,
        notes: input.notes,
      };
      const { data, error } = await (supabase as any)
        .from(T_BOX)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as SublimeMerchBox;
    },
    onSuccess: invalidate,
  });

  const updateBox = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: BoxInput }) => {
      const payload: Record<string, unknown> = {
        shipment_id: input.shipment_id,
        box_number: input.box_number.trim(),
        weight_kg: input.weight_kg,
        status: input.status,
        notes: input.notes,
      };
      const { data, error } = await (supabase as any)
        .from(T_BOX)
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SublimeMerchBox;
    },
    onSuccess: invalidate,
  });

  const assignItemToShipmentBox = useMutation({
    mutationFn: async ({
      itemId,
      shipmentId,
      boxId,
    }: {
      itemId: string;
      shipmentId: string;
      boxId: string;
    }) => {
      if (!shipmentId || !boxId) {
        throw new Error("Selecciona una caja válida para este envío.");
      }
      const { data: box, error: boxErr } = await (supabase as any)
        .from(T_BOX)
        .select("id, shipment_id")
        .eq("id", boxId)
        .single();
      if (boxErr || !box || box.shipment_id !== shipmentId) {
        throw new Error("Selecciona una caja válida para este envío.");
      }
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({
          shipment_id: shipmentId,
          box_id: boxId,
          estado: "in_transit",
        })
        .eq("id", itemId)
        .select()
        .single();
      if (error) throw error;
      return data as SublimeMerchItem;
    },
    onSuccess: invalidate,
  });

  const markItemReceived = useMutation({
    mutationFn: async (itemId: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({
          estado: "received",
          received_at: new Date().toISOString(),
          received_by: uid,
        })
        .eq("id", itemId)
        .select()
        .single();
      if (error) throw error;
      return data as SublimeMerchItem;
    },
    onSuccess: invalidate,
  });

  const markBoxReceived = useMutation({
    mutationFn: async (boxId: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      const now = new Date().toISOString();

      const { data: box, error: boxErr } = await (supabase as any)
        .from(T_BOX)
        .select("id, shipment_id")
        .eq("id", boxId)
        .single();
      if (boxErr || !box) throw boxErr ?? new Error("Caja no encontrada");

      const { error: itemsErr } = await (supabase as any)
        .from(TABLE)
        .update({ estado: "received", received_at: now, received_by: uid })
        .eq("box_id", boxId)
        .neq("estado", "cancelled");
      if (itemsErr) throw itemsErr;

      const { error: bErr } = await (supabase as any)
        .from(T_BOX)
        .update({ status: "received", received_at: now, received_by: uid })
        .eq("id", boxId);
      if (bErr) throw bErr;

      const shipmentId = box.shipment_id as string;
      const { data: siblings, error: sibErr } = await (supabase as any)
        .from(T_BOX)
        .select("status")
        .eq("shipment_id", shipmentId);
      if (sibErr) throw sibErr;
      const list = (siblings ?? []) as { status: string }[];
      const allReceived = list.length > 0 && list.every((b) => b.status === "received");
      const someReceived = list.some((b) => b.status === "received");
      const shipStatus = allReceived
        ? "received"
        : someReceived
          ? "partially_received"
          : null;
      if (shipStatus) {
        const payload: Record<string, unknown> = { status: shipStatus };
        if (allReceived) payload.received_at = now;
        const { error: shipErr } = await (supabase as any)
          .from(T_SHIP)
          .update(payload)
          .eq("id", shipmentId);
        if (shipErr) throw shipErr;
      }

      return { boxId, shipmentId, shipStatus };
    },
    onSuccess: invalidate,
  });

  const markItemAvailable = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({ estado: "available" })
        .eq("id", itemId)
        .select()
        .single();
      if (error) throw error;
      return data as SublimeMerchItem;
    },
    onSuccess: invalidate,
  });

  const toggleItemUploaded = useMutation({
    mutationFn: async ({ itemId, value }: { itemId: string; value: boolean }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      const payload: Record<string, unknown> = { subido_al_sistema: value };
      if (value) {
        payload.uploaded_at = new Date().toISOString();
        payload.uploaded_by = uid;
      }
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update(payload)
        .eq("id", itemId)
        .select()
        .single();
      if (error) throw error;
      return data as SublimeMerchItem;
    },
    onSuccess: invalidate,
  });

  return {
    createItem,
    updateItem,
    addPhotoToItem,
    removePhotoFromItem,
    uploadPhotoToItem,
    addWebPhotoUrl,
    createShipment,
    updateShipment,
    createBox,
    updateBox,
    assignItemToShipmentBox,
    markItemReceived,
    markBoxReceived,
    markItemAvailable,
    toggleItemUploaded,
  };
}

export function useAvailableItems() {
  return useQuery({
    queryKey: ["sublime-merch", "available"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .in("estado", ["received", "available"])
        .order("received_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as SublimeMerchItem[];
    },
  });
}

export async function fetchAllSublimeMerchItemsForCsv(): Promise<SublimeMerchItem[]> {
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .select("*")
    .neq("estado", "cancelled")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SublimeMerchItem[];
}

export function useSublimeMerchSummary() {
  return useQuery({
    queryKey: ["sublime-merch", "summary"],
    queryFn: async () => {
      const [itemsRes, shipRes] = await Promise.all([
        (supabase as any)
          .from(TABLE)
          .select("*")
          .neq("estado", "cancelled"),
        (supabase as any).from(T_SHIP).select("id,cost_per_kg_eur"),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (shipRes.error) throw shipRes.error;
      return {
        items: (itemsRes.data ?? []) as SublimeMerchItem[],
        shipments: (shipRes.data ?? []) as { id: string; cost_per_kg_eur: number }[],
      };
    },
  });
}


const T_RULES = "sublime_merch_pricing_rules";

export function useSublimePricingRules() {
  return useQuery({
    queryKey: ["sublime-merch", "pricing-rules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(T_RULES)
        .select("*")
        .order("label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SublimePricingRule[];
    },
  });
}

export function usePricingRulesMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sublime-merch", "pricing-rules"] });

  const createRule = useMutation({
    mutationFn: async (input: PricingRuleInput) => {
      const { slugifyProductType } = await import("@/lib/sublimeMerch");
      const slug = (input.product_type?.trim() || slugifyProductType(input.label));
      if (!slug) throw new Error("El nombre del tipo es requerido.");
      if (!input.label.trim()) throw new Error("El nombre del tipo es requerido.");
      if (input.profit_percentage < 0) throw new Error("El porcentaje no puede ser negativo.");
      const payload = {
        product_type: slug,
        label: input.label.trim(),
        profit_percentage: input.profit_percentage,
        active: input.active ?? true,
      };
      const { data, error } = await (supabase as any)
        .from(T_RULES)
        .insert(payload)
        .select()
        .single();
      if (error) {
        if (String(error.message ?? "").includes("duplicate") || (error as any).code === "23505") {
          throw new Error("Ya existe un tipo de artículo con ese nombre.");
        }
        throw error;
      }
      return data as SublimePricingRule;
    },
    onSuccess: invalidate,
  });

  const updateRule = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<SublimePricingRule, "label" | "profit_percentage" | "active">>;
    }) => {
      if (patch.profit_percentage != null && patch.profit_percentage < 0) {
        throw new Error("El porcentaje no puede ser negativo.");
      }
      if (patch.label != null && !patch.label.trim()) {
        throw new Error("El nombre no puede estar vacío.");
      }
      const { data, error } = await (supabase as any)
        .from(T_RULES)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SublimePricingRule;
    },
    onSuccess: invalidate,
  });

  return { createRule, updateRule };
}
