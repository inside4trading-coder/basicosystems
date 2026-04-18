import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as UserIcon, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Entry {
  id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  created_at: string;
}

const ACTION_VERBS: Record<string, string> = {
  create: "Creó el contacto",
  update: "Actualizó",
  archive: "Archivó",
  reactivate: "Reactivó",
  delete: "Eliminó",
  status_change: "Cambió estado",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "hace unos segundos";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `hace ${mo} mes${mo > 1 ? "es" : ""}`;
  return `hace ${Math.floor(mo / 12)} año(s)`;
}

export function RRPPAuditTrail({ contactId }: { contactId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || entries.length > 0) return;
    setLoading(true);
    (supabase as any)
      .from("rrpp_audit_log")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }: any) => {
        setEntries(data ?? []);
        setLoading(false);
      });
  }, [open, contactId, entries.length]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="kpi-card !p-0">
      <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/30 rounded-lg transition-colors">
        <span className="text-sm font-semibold">Historial de cambios</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 pt-0 space-y-2">
          {loading && <p className="text-xs text-muted-foreground">Cargando…</p>}
          {!loading && entries.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin actividad registrada.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="text-xs border-l-2 border-border pl-3 py-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{ACTION_VERBS[e.action] ?? e.action}</span>
                {e.field_changed && <span className="text-muted-foreground">{e.field_changed}</span>}
                {e.old_value != null && e.new_value != null && (
                  <span className="text-muted-foreground">
                    <span className="line-through">{e.old_value}</span>
                    {" → "}
                    <span className="text-foreground">{e.new_value}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <UserIcon className="h-3 w-3" /> {e.performed_by ?? "sistema"}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">{relativeTime(e.created_at)}</span>
                  </TooltipTrigger>
                  <TooltipContent>{new Date(e.created_at).toLocaleString()}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
