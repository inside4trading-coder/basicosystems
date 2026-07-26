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
}

const TABLE = "sublime_merch_items";

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

  return {
    createItem,
    updateItem,
    addPhotoToItem,
    removePhotoFromItem,
    uploadPhotoToItem,
    addWebPhotoUrl,
  };
}
