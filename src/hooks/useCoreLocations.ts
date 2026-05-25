import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logCoreAudit } from "@/lib/coreAudit";

export interface CoreLocation {
  id: string;
  name: string;
  type: "sede" | "transito" | "futura";
  is_main: boolean;
  status: "activa" | "inactiva";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCoreLocations() {
  return useQuery({
    queryKey: ["core_locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_locations")
        .select("*")
        .order("is_main", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CoreLocation[];
    },
  });
}

export function useUpsertLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loc: Partial<CoreLocation> & { name: string }) => {
      if (loc.id) {
        const { data, error } = await supabase
          .from("core_locations")
          .update(loc as any)
          .eq("id", loc.id)
          .select()
          .single();
        if (error) throw error;
        await logCoreAudit({ table: "core_locations", recordId: loc.id, action: "update", newValue: loc });
        return data;
      }
      const { data, error } = await supabase
        .from("core_locations")
        .insert(loc as any)
        .select()
        .single();
      if (error) throw error;
      await logCoreAudit({ table: "core_locations", recordId: data.id, action: "insert", newValue: loc });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["core_locations"] }),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("core_locations").delete().eq("id", id);
      if (error) throw error;
      await logCoreAudit({ table: "core_locations", recordId: id, action: "delete" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["core_locations"] }),
  });
}
