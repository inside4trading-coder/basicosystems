import { User, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditEntry {
  id: string;
  employee_id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? "es" : ""}`;
}

export function CrewAuditLog({ employeeId }: { employeeId: string }) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["crew_audit_log", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crew_audit_log")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AuditEntry[];
    },
  });

  return (
    <Collapsible>
      <CollapsibleTrigger className="w-full">
        <div className="kpi-card flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Trazabilidad
            {entries.length > 0 && (
              <span className="ml-2 text-[10px] bg-muted rounded-full px-1.5 py-0.5 font-mono">{entries.length}</span>
            )}
          </h3>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="kpi-card mt-1 p-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin actividad registrada</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 text-xs">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p>
                      <span className="font-bold">{entry.action}</span>
                      {entry.field_changed && (
                        <span className="text-muted-foreground ml-1">{entry.field_changed}</span>
                      )}
                    </p>
                    {(entry.old_value || entry.new_value) && (
                      <p className="text-muted-foreground">
                        {entry.old_value && <span>{entry.old_value}</span>}
                        {entry.old_value && entry.new_value && <span className="mx-1">→</span>}
                        {entry.new_value && <span className="font-medium text-foreground">{entry.new_value}</span>}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {entry.performed_by && (
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{entry.performed_by}</span>
                      )}
                      <span>{timeAgo(entry.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
