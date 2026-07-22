import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ExternalLink,
  Wand2,
  AlertTriangle,
  Copy,
  MapPin,
  DollarSign,
  Layers,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { POLICY_ACTION_LABELS, describePolicyAction } from "@/lib/policyBlocked";
import { ReplacementApplicationDialog } from "./ReplacementApplicationDialog";
import { PendingClassificationResolveDialog } from "@/components/core/needs/PendingClassificationResolveDialog";
import { useReplenishmentPolicyEvents, PolicyEvent } from "@/hooks/useReplenishmentPolicyEvents";

const FILTERS: { key: string; label: string; actions: string[] }[] = [
  { key: "all", label: "Todos", actions: [] },
  { key: "replacement", label: "Reemplazos", actions: ["suggest_replacement"] },
  { key: "external", label: "Proveedor externo", actions: ["external_supplier_review"] },
  { key: "manual", label: "Costo manual", actions: ["manual_cost_review"] },
  { key: "block", label: "No restock / En salida", actions: ["block_no_restock", "block_exit"] },
  { key: "ignored", label: "Ignorados", actions: ["block_ignored"] },
  { key: "missing_map", label: "Sin mapeo", actions: ["missing_map"] },
  { key: "missing_cost", label: "Sin costo", actions: ["missing_cost", "financial_review"] },
  { key: "unclassified", label: "Sin clasificar", actions: ["unclassified_fund"] },
];

const EXTRA_ACTION_LABELS: Record<string, string> = {
  missing_map: "Sin mapeo",
  missing_cost: "Sin costo",
  financial_review: "Revisión financiera",
  unclassified_fund: "Partida sin clasificar",
};

const SEVERITY_STYLES: Record<string, string> = {
  allow: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-black",
  review: "bg-yellow-300 text-black",
  block: "bg-red-600 text-white",
};

function actionLabel(action: string) {
  return POLICY_ACTION_LABELS[action] ?? EXTRA_ACTION_LABELS[action] ?? action;
}

function mapaWooLink(
  wooId: number | null | undefined,
  sku: string | null | undefined,
  action: "cost" | "policy" | "map",
) {
  const params = new URLSearchParams();
  if (wooId) params.set("woo_product_id", String(wooId));
  else if (sku) params.set("search", sku);
  params.set("action", action);
  return `/core/mapa-woo-core?${params.toString()}`;
}

export function PolicyEventsAttentionPanel({ initialFilter }: { initialFilter?: string } = {}) {
  const {
    rows,
    isLoading,
    resolveProductLabel,
    resolveVariantLabel,
    resolveReplacementLabel,
    setEventStatus,
    closePendingClassification,
  } = useReplenishmentPolicyEvents();

  const [filter, setFilter] = useState<string>(initialFilter ?? "all");
  const [search, setSearch] = useState("");
  const [replacementEvent, setReplacementEvent] = useState<PolicyEvent | null>(null);
  const [resolveRow, setResolveRow] = useState<PolicyEvent | null>(null);

  const filtered = useMemo(() => {
    const preset = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
    let list = rows;
    if (preset.actions.length) list = list.filter((r) => preset.actions.includes(r.action));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const p = resolveProductLabel(r);
        const v = resolveVariantLabel(r);
        return (
          (p.name ?? "").toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q) ||
          String(p.wooId ?? "").includes(q) ||
          (typeof v === "string" ? v.toLowerCase().includes(q) : false)
        );
      });
    }
    return list;
  }, [rows, filter, search, resolveProductLabel, resolveVariantLabel]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={f.key === filter ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <Input
          placeholder="Buscar por producto, SKU, Woo ID o variante…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 ml-auto"
        />
        <Button size="sm" variant="ghost" asChild>
          <Link to="/core/mapa-woo-core?tab=policy-review">
            Ver historial completo <ExternalLink className="w-3 h-3 ml-1" />
          </Link>
        </Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-6 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No hay ventas ni reposiciones que requieran atención.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Fecha</th>
                <th className="p-2">Producto</th>
                <th className="p-2">Variante</th>
                <th className="p-2 text-right">Cantidad</th>
                <th className="p-2">Ruta / Motivo</th>
                <th className="p-2">Reemplazo o proveedor</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const p = resolveProductLabel(r);
                const rep = resolveReplacementLabel(r);
                const isSynthetic = !!r._synthetic;
                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap text-xs">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[
                          p.sku,
                          p.wooId
                            ? `Woo #${p.wooId}${p.variationId ? ` / var ${p.variationId}` : ""}`
                            : null,
                          p.orderId ? `Pedido #${p.orderId}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="p-2 text-xs">{resolveVariantLabel(r)}</td>
                    <td className="p-2 text-right">{r.quantity ?? "—"}</td>
                    <td className="p-2">
                      <Badge className={SEVERITY_STYLES[r.severity] ?? ""}>
                        {actionLabel(r.action)}
                      </Badge>
                      <div className="text-xs mt-1">
                        {r.message || describePolicyAction(r.action)}
                      </div>
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
                      {rep && <div>Reemp: {rep}</div>}
                      {r.unit_cost != null && (
                        <div className="text-muted-foreground">
                          Costo: {Number(r.unit_cost).toFixed(2)}
                        </div>
                      )}
                      {r.amount != null && (
                        <div className="text-muted-foreground">
                          Reservado: {Number(r.amount).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {r.isCorrected ? (
                        <Badge className="bg-emerald-600 text-white">Corregido</Badge>
                      ) : (
                        <Badge variant="outline">{r.status}</Badge>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-col gap-1 min-w-[170px]">
                        {r.action === "suggest_replacement" && (
                          <Button size="sm" onClick={() => setReplacementEvent(r)}>
                            <Wand2 className="w-3 h-3 mr-1" /> Aplicar reemplazo
                          </Button>
                        )}
                        {r.action === "external_supplier_review" && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/core/mapa-woo-core?tab=external">
                              Abrir Reposición externa
                            </Link>
                          </Button>
                        )}
                        {r.action === "manual_cost_review" && (
                          <>
                            <Button size="sm" variant="outline" asChild>
                              <Link to={mapaWooLink(r.woo_product_id, p.sku, "policy")}>Ver política</Link>
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <Link to="/core/mapa-woo-core?tab=policy-review">
                                Abrir revisión
                              </Link>
                            </Button>
                          </>
                        )}
                        {(r.action === "block_no_restock" ||
                          r.action === "block_exit" ||
                          r.action === "block_ignored") && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={mapaWooLink(r.woo_product_id, p.sku, "policy")}>Ver política</Link>
                          </Button>
                        )}
                        {r.action === "missing_map" && (
                          <>
                            <Button size="sm" variant="outline" asChild>
                              <Link to={mapaWooLink(r.woo_product_id, p.sku, "map")}>
                                <MapPin className="w-3 h-3 mr-1" /> Abrir Mapa Woo/Core
                              </Link>
                            </Button>
                            {r.woo_product_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  navigator.clipboard.writeText(String(r.woo_product_id));
                                  toast({ title: "Woo ID copiado" });
                                }}
                              >
                                <Copy className="w-3 h-3 mr-1" /> Copiar Woo ID
                              </Button>
                            )}
                          </>
                        )}
                        {(r.action === "missing_cost" || r.action === "financial_review") && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={mapaWooLink(r.woo_product_id, p.sku, "cost")}>
                              <DollarSign className="w-3 h-3 mr-1" /> Configurar costo
                            </Link>
                          </Button>
                        )}
                        {r.action === "unclassified_fund" && (
                          r.isCorrected ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (!r.sourceMovementId) return;
                                await closePendingClassification(r.sourceMovementId);
                              }}
                            >
                              Cerrar
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setResolveRow(r)}>
                              <Layers className="w-3 h-3 mr-1" /> Definir política
                            </Button>
                          )
                        )}
                        {!isSynthetic && r.status !== "reviewed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEventStatus(r.id, "reviewed")}
                          >
                            Marcar revisado
                          </Button>
                        )}
                        {!isSynthetic &&
                          r.status !== "resolved" &&
                          r.action !== "suggest_replacement" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEventStatus(r.id, "resolved")}
                            >
                              Resolver
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Los eventos de política no se pueden seleccionar para crear una Orden de Producción.
      </div>

      <ReplacementApplicationDialog
        event={replacementEvent as any}
        open={!!replacementEvent}
        onOpenChange={(v) => !v && setReplacementEvent(null)}
      />

      <PendingClassificationResolveDialog
        row={resolveRow}
        open={!!resolveRow}
        onOpenChange={(v) => !v && setResolveRow(null)}
      />
    </div>
  );
}
