import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { toast as sonner } from "sonner";
import { Loader2, ExternalLink, Copy, Play, Wand2 } from "lucide-react";
import { POLICY_ACTION_LABELS, describePolicyAction } from "@/lib/policyBlocked";
import { ReplacementApplicationDialog } from "./ReplacementApplicationDialog";

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
  replacement_behavior?: string | null;
  resolution_data?: any;
};

const SEVERITY_STYLES: Record<string, string> = {
  allow: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-black",
  review: "bg-yellow-300 text-black",
  block: "bg-red-600 text-white",
};

type Preset = {
  key: string;
  label: string;
  status: string; // "all" | "open" | "reviewed" | "resolved" | "ignored"
  actions: string[]; // empty = any
};

const PRESETS: Preset[] = [
  { key: "all_open", label: "Todos abiertos", status: "open", actions: [] },
  { key: "external", label: "Proveedor externo", status: "open", actions: ["external_supplier_review"] },
  { key: "replacement", label: "Reemplazos", status: "open", actions: ["suggest_replacement"] },
  { key: "block", label: "No restock / salida", status: "open", actions: ["block_no_restock", "block_exit"] },
  { key: "manual", label: "Costo manual", status: "open", actions: ["manual_cost_review"] },
  { key: "ignored", label: "Ignorados", status: "ignored", actions: [] },
  { key: "resolved", label: "Resueltos", status: "resolved", actions: [] },
];

export function PolicyReviewPanel() {
  const qc = useQueryClient();
  const [presetKey, setPresetKey] = useState<string>("all_open");
  const [actionOverride, setActionOverride] = useState<string>("all");
  const [processOpen, setProcessOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];

  const runPreview = async () => {
    setProcessing(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("core-generate-production-needs", {
        body: { route_only: true, dry_run: true },
      });
      if (error) throw error;
      setPreview(data);
    } catch (e: any) {
      toast({ title: "Error en preview", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const openProcess = () => {
    setProcessOpen(true);
    runPreview();
  };

  const runConfirm = async () => {
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke("core-generate-production-needs", {
        body: { route_only: false, dry_run: false },
      });
      if (error) throw error;
      sonner.success(
        `Procesado. Necesidades creadas: ${data?.needs_created ?? 0}, actualizadas: ${data?.needs_updated ?? 0}.`,
      );
      setProcessOpen(false);
      qc.invalidateQueries({ queryKey: ["policy_events"] });
      qc.invalidateQueries({ queryKey: ["policy_events_summary"] });
    } catch (e: any) {
      toast({ title: "Error al procesar", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };


  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["policy_events", preset.key, actionOverride],
    queryFn: async () => {
      let q = supabase
        .from("core_replenishment_policy_events" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (preset.status !== "all") q = q.eq("status", preset.status);
      if (actionOverride !== "all") q = q.eq("action", actionOverride);
      else if (preset.actions.length === 1) q = q.eq("action", preset.actions[0]);
      else if (preset.actions.length > 1) q = q.in("action", preset.actions);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Event[];
    },
  });

  // Summary counts (siempre sobre "open", independientes del filtro actual)
  const { data: summary } = useQuery({
    queryKey: ["policy_events_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_replenishment_policy_events" as any)
        .select("action,status")
        .eq("status", "open")
        .limit(2000);
      if (error) throw error;
      const c: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) {
        c.total = (c.total ?? 0) + 1;
        c[r.action] = (c[r.action] ?? 0) + 1;
      }
      return c;
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
      .update({
        status: newStatus,
        resolved_at: newStatus === "resolved" || newStatus === "ignored" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Evento actualizado" });
    qc.invalidateQueries({ queryKey: ["policy_events"] });
    qc.invalidateQueries({ queryKey: ["policy_events_summary"] });
  };

  const copyRow = async (r: Event) => {
    const parts = [
      POLICY_ACTION_LABELS[r.action] ?? r.action,
      r.woo_product_id ? `Woo #${r.woo_product_id}` : "",
      r.woo_variation_id ? `var ${r.woo_variation_id}` : "",
      r.quantity != null ? `cant ${r.quantity}` : "",
      r.unit_cost != null ? `costo ${Number(r.unit_cost).toFixed(2)}` : "",
      r.external_supplier_name ? `prov ${r.external_supplier_name}` : "",
      r.replacement_woo_product_id ? `reemp Woo #${r.replacement_woo_product_id}` : "",
    ].filter(Boolean);
    const text = `${parts.join(" · ")}\n${r.message ?? describePolicyAction(r.action)}`;
    try {
      await navigator.clipboard.writeText(text);
      sonner.success("Resumen copiado");
    } catch {
      sonner.error("No se pudo copiar");
    }
  };

  const extraMessageFor = (action: string) => {
    if (action === "external_supplier_review") return "Pendiente para futura reposición externa.";
    if (action === "suggest_replacement") return "Reemplazo sugerido. No aplicado automáticamente.";
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Motor de enrutamiento: valida política antes de generar necesidades internas.
        </div>
        <Button size="sm" onClick={openProcess}>
          <Play className="w-3 h-3 mr-1" /> Procesar políticas de reposición
        </Button>
      </div>

      {/* Resumen superior */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <SummaryCard label="Eventos abiertos" value={summary?.total ?? 0} />
        <SummaryCard label="Proveedor externo" value={summary?.external_supplier_review ?? 0} />
        <SummaryCard label="Reemplazos sugeridos" value={summary?.suggest_replacement ?? 0} />
        <SummaryCard
          label="No restock / salida"
          value={(summary?.block_no_restock ?? 0) + (summary?.block_exit ?? 0)}
        />
        <SummaryCard label="Costo manual en revisión" value={summary?.manual_cost_review ?? 0} />
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={p.key === presetKey ? "default" : "outline"}
            onClick={() => {
              setPresetKey(p.key);
              setActionOverride("all");
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={actionOverride} onValueChange={setActionOverride}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            {Object.entries(POLICY_ACTION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v} {counts[k] ? `(${counts[k]})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground ml-auto">{rows.length} eventos</div>
      </div>

      <Card className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-6 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />Cargando…
          </div>
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
                <th className="p-2">Extra</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const extraMsg = extraMessageFor(r.action);
                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-2">{r.source_type}</td>
                    <td className="p-2">
                      <div>
                        Woo #{r.woo_product_id ?? "—"}
                        {r.woo_variation_id ? ` / var ${r.woo_variation_id}` : ""}
                      </div>
                      {r.core_product_id && (
                        <div className="text-xs text-muted-foreground">
                          core: {r.core_product_id.slice(0, 8)}…
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <Badge className={SEVERITY_STYLES[r.severity] ?? ""}>
                        {POLICY_ACTION_LABELS[r.action] ?? r.action}
                      </Badge>
                      <div className="text-xs mt-1">
                        {r.message || describePolicyAction(r.action)}
                      </div>
                      {extraMsg && (
                        <div className="text-xs mt-1 italic text-muted-foreground">{extraMsg}</div>
                      )}
                    </td>
                    <td className="p-2">{r.quantity ?? "—"}</td>
                    <td className="p-2">
                      {r.unit_cost != null ? Number(r.unit_cost).toFixed(2) : "—"}
                      {r.cost_source && (
                        <div className="text-[10px] text-muted-foreground">{r.cost_source}</div>
                      )}
                    </td>
                    <td className="p-2 text-xs space-y-0.5">
                      {r.external_supplier_name && (
                        <div>
                          Prov: {r.external_supplier_name}
                          {r.external_supplier_unit_cost_usd != null
                            ? ` (${Number(r.external_supplier_unit_cost_usd).toFixed(2)} USD)`
                            : ""}
                        </div>
                      )}
                      {(r.replacement_product_id || r.replacement_woo_product_id) && (
                        <div>
                          Reemp:{" "}
                          {r.replacement_woo_product_id
                            ? `Woo #${r.replacement_woo_product_id}`
                            : r.replacement_product_id?.slice(0, 8) + "…"}
                        </div>
                      )}
                    </td>
                    <td className="p-2"><Badge variant="outline">{r.status}</Badge></td>
                    <td className="p-2">
                      <div className="flex flex-col gap-1 min-w-[160px]">
                        {r.status !== "reviewed" && (
                          <Button size="sm" variant="outline" onClick={() => setEventStatus(r.id, "reviewed")}>
                            Revisado
                          </Button>
                        )}
                        {r.status !== "resolved" && (
                          <Button size="sm" variant="outline" onClick={() => setEventStatus(r.id, "resolved")}>
                            Resolver
                          </Button>
                        )}
                        {r.status !== "ignored" && (
                          <Button size="sm" variant="ghost" onClick={() => setEventStatus(r.id, "ignored")}>
                            Ignorar
                          </Button>
                        )}
                        {r.woo_product_id && (
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/core/mapa-woo-core?woo=${r.woo_product_id}`}>
                              <ExternalLink className="w-3 h-3 mr-1" />Abrir en Mapa
                            </Link>
                          </Button>
                        )}
                        {r.replacement_woo_product_id && (
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/core/mapa-woo-core?woo=${r.replacement_woo_product_id}`}>
                              <ExternalLink className="w-3 h-3 mr-1" />Abrir reemplazo
                            </Link>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => copyRow(r)}>
                          <Copy className="w-3 h-3 mr-1" />Copiar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={processOpen} onOpenChange={setProcessOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Procesar políticas de reposición</DialogTitle>
            <DialogDescription>
              Previsualización sin escritura. La confirmación crea necesidades internas y eventos según política.
            </DialogDescription>
          </DialogHeader>

          {processing || !preview ? (
            <div className="p-6 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Calculando preview…
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <PreviewLine label="Movimientos revisados" value={preview.movements_checked ?? 0} />
                <PreviewLine label="Grupos elegibles" value={preview.eligible_groups ?? 0} />
                <PreviewLine label="Enrutados a interna" value={preview.routed_allowed ?? 0} />
                <PreviewLine label="No restockeable" value={preview.non_restockable ?? 0} />
                <PreviewLine label="Reversiones" value={preview.reversals_detected ?? 0} />
                <PreviewLine label="Ya vinculados" value={preview.skipped_existing ?? 0} />
              </div>
              {preview.routing_buckets && Object.keys(preview.routing_buckets).length > 0 && (
                <div>
                  <div className="text-xs font-semibold mt-2 mb-1">Por acción de política</div>
                  <div className="space-y-1">
                    {Object.entries(preview.routing_buckets).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span>{POLICY_ACTION_LABELS[k] ?? k}</span>
                        <span className="font-mono">{v as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-2">
                No se creó nada aún. Confirmar procesará y creará necesidades internas + eventos según política.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessOpen(false)} disabled={confirming}>
              Cancelar
            </Button>
            <Button onClick={runConfirm} disabled={confirming || processing || !preview}>
              {confirming ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              Confirmar y procesar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border rounded px-2 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </Card>
  );
}
