import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Event = {
  id: string;
  created_at: string;
  source_type: string;
  action: string;
  severity: string;
  message: string | null;
  warning: string | null;
  status: string;
  quantity: number | null;
  unit_cost: number | null;
  amount: number | null;
  cost_source: string | null;
  core_product_id: string | null;
  core_variant_id: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  replacement_product_id: string | null;
  replacement_woo_product_id: number | null;
  external_supplier_name: string | null;
  external_supplier_unit_cost_usd: number | null;
};

const ACTION_LABELS: Record<string, string> = {
  allow_internal_factory: "Fabricación interna",
  manual_cost_review: "Costo manual · revisión",
  external_supplier_review: "Proveedor externo",
  block_no_restock: "No restock",
  block_exit: "En salida",
  block_ignored: "Ignorado",
  suggest_replacement: "Reemplazo sugerido",
};

const SEVERITY_STYLES: Record<string, string> = {
  allow: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-black",
  review: "bg-yellow-300 text-black",
  block: "bg-red-600 text-white",
};

export function PolicyReviewPanel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("open");
  const [action, setAction] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["policy_events", status, action],
    queryFn: async () => {
      let q = supabase
        .from("core_replenishment_policy_events" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (status !== "all") q = q.eq("status", status);
      if (action !== "all") q = q.eq("action", action);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Event[];
    },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.action] = (c[r.action] ?? 0) + 1;
    return c;
  }, [rows]);

  const setEventStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("core_replenishment_policy_events" as any)
      .update({ status: newStatus, resolved_at: newStatus === "resolved" || newStatus === "ignored" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Evento actualizado" });
    qc.invalidateQueries({ queryKey: ["policy_events"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Abiertos</SelectItem>
            <SelectItem value="reviewed">Revisados</SelectItem>
            <SelectItem value="resolved">Resueltos</SelectItem>
            <SelectItem value="ignored">Ignorados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v} {counts[k] ? `(${counts[k]})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground ml-auto">{rows.length} eventos</div>
      </div>

      <Card className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">Sin eventos.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Fecha</th>
                <th className="p-2">Origen</th>
                <th className="p-2">Producto</th>
                <th className="p-2">Acción</th>
                <th className="p-2">Cant.</th>
                <th className="p-2">Costo</th>
                <th className="p-2">Monto</th>
                <th className="p-2">Extra</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2">{r.source_type}</td>
                  <td className="p-2">
                    <div>Woo #{r.woo_product_id ?? "—"}{r.woo_variation_id ? ` / var ${r.woo_variation_id}` : ""}</div>
                    {r.core_product_id && <div className="text-xs text-muted-foreground">core: {r.core_product_id.slice(0, 8)}…</div>}
                  </td>
                  <td className="p-2">
                    <Badge className={SEVERITY_STYLES[r.severity] ?? ""}>{ACTION_LABELS[r.action] ?? r.action}</Badge>
                    {r.message && <div className="text-xs mt-1 text-muted-foreground">{r.message}</div>}
                  </td>
                  <td className="p-2">{r.quantity ?? "—"}</td>
                  <td className="p-2">{r.unit_cost != null ? Number(r.unit_cost).toFixed(2) : "—"}</td>
                  <td className="p-2">{r.amount != null ? Number(r.amount).toFixed(2) : "—"}</td>
                  <td className="p-2 text-xs">
                    {r.external_supplier_name && <div>Prov: {r.external_supplier_name} ({r.external_supplier_unit_cost_usd ?? "—"})</div>}
                    {(r.replacement_product_id || r.replacement_woo_product_id) && (
                      <div>Reemp: {r.replacement_woo_product_id ? `Woo #${r.replacement_woo_product_id}` : r.replacement_product_id?.slice(0, 8) + "…"}</div>
                    )}
                    {r.cost_source && <div className="text-muted-foreground">src: {r.cost_source}</div>}
                  </td>
                  <td className="p-2"><Badge variant="outline">{r.status}</Badge></td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      {r.status !== "reviewed" && <Button size="sm" variant="outline" onClick={() => setEventStatus(r.id, "reviewed")}>Revisado</Button>}
                      {r.status !== "resolved" && <Button size="sm" variant="outline" onClick={() => setEventStatus(r.id, "resolved")}>Resolver</Button>}
                      {r.status !== "ignored" && <Button size="sm" variant="ghost" onClick={() => setEventStatus(r.id, "ignored")}>Ignorar</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
