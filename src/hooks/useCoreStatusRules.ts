import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logCoreAudit } from "@/lib/coreAudit";

export interface CoreStatusRule {
  id: string;
  slug: string;
  canonical_name: string;
  status_group: "confirmado" | "pendiente" | "excluido";
  enters_production: boolean;
  monitored: boolean;
  excluded: boolean;
  active: boolean;
}

export function useCoreStatusRules() {
  return useQuery({
    queryKey: ["core_woocommerce_status_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_woocommerce_status_rules")
        .select("*")
        .order("status_group")
        .order("canonical_name");
      if (error) throw error;
      return (data ?? []) as unknown as CoreStatusRule[];
    },
  });
}

export function useUpdateStatusRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Partial<CoreStatusRule> & { id: string }) => {
      const { data, error } = await supabase
        .from("core_woocommerce_status_rules")
        .update(rule as any)
        .eq("id", rule.id)
        .select()
        .single();
      if (error) throw error;
      await logCoreAudit({
        table: "core_woocommerce_status_rules",
        recordId: rule.id,
        action: "update",
        newValue: rule,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["core_woocommerce_status_rules"] }),
  });
}
