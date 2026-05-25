import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoreRoleDefinition {
  id: string;
  key: string;
  display_name: string;
  description: string;
  permissions: Record<string, unknown>;
  sort_order: number;
}

export function useCoreRoles() {
  return useQuery({
    queryKey: ["core_role_definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_role_definitions")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as CoreRoleDefinition[];
    },
  });
}
