import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logCoreAudit } from "@/lib/coreAudit";

export interface CoreSettings {
  id: string;
  module_name: string;
  description: string;
  status: "activo" | "inactivo";
  main_location_id: string | null;
  allow_stock_in_transit: boolean;
  update_woocommerce_inventory: boolean;
  multi_location_mode: "preparado" | "no_activo" | "activo";
  sku_prefix: string;
  sku_digits: number;
  sku_last_number: number;
  qr_width_mm: number;
  qr_height_mm: number;
  qr_include_qr: boolean;
  qr_include_human_code: boolean;
  qr_include_sku: boolean;
  qr_include_size: boolean;
  qr_include_production_order: boolean;
  qr_include_unit_number: boolean;
  updated_at: string;
}

export function useCoreSettings() {
  return useQuery({
    queryKey: ["core_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CoreSettings | null;
    },
  });
}

export function useUpdateCoreSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; patch: Partial<CoreSettings>; previous: CoreSettings }) => {
      const { id, patch, previous } = payload;
      const { data, error } = await supabase
        .from("core_settings")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      // Log per-field
      for (const key of Object.keys(patch)) {
        const k = key as keyof CoreSettings;
        if ((previous as any)[k] !== (patch as any)[k]) {
          await logCoreAudit({
            table: "core_settings",
            recordId: id,
            action: "update",
            field: k as string,
            oldValue: (previous as any)[k],
            newValue: (patch as any)[k],
          });
        }
      }
      return data as unknown as CoreSettings;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["core_settings"] }),
  });
}
