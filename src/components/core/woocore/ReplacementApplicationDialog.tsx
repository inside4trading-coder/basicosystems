import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Pencil, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { toast as sonner } from "sonner";
import { NoRestockConfigDialog } from "./NoRestockConfigDialog";
import { SyncVariantsDialog } from "./SyncVariantsDialog";
import { REPLACEMENT_BEHAVIOR_LABELS } from "@/lib/coreReplenishment";

type Event = {
  id: string;
  status: string;
  action: string;
  quantity: number | null;
  core_product_id: string | null;
  core_variant_id: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  replacement_product_id: string | null;
  replacement_woo_product_id: number | null;
  replacement_behavior: string | null;
  message: string | null;
  source_type?: string | null;
  source_id?: string | null;
  resolution_data?: any;
};

type Allocation = {
  core_variant_id: string | null;
  woo_variation_id: number | null;
  quantity: number;
  notes?: string;
};

const APPLY_BEHAVIORS = new Set(["use_on_restock_with_confirmation", "block_and_suggest"]);

export function ReplacementApplicationDialog({
  event, open, onOpenChange,
}: {
  event: Event | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [qtyByVariantId, setQtyByVariantId] = useState<Record<string, number>>({});
  const [simpleQty, setSimpleQty] = useState<number>(0);
  const [confirmedQty, setConfirmedQty] = useState<number>(0);
  const [reason, setReason] = useState<string>("");
  const [preview, setPreview] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [editorCtx, setEditorCtx] = useState<any | null>(null);
  const [syncingVariants, setSyncingVariants] = useState(false);

  const suggested = Number(event?.quantity ?? 0);
  const isResolved = event?.status === "resolved";

  // 1) Efective policy: source of truth (not the event snapshot)
  const { data: effectivePolicy, refetch: refetchPolicy } = useQuery({
    queryKey: ["effective-policy", event?.core_product_id ?? null, event?.woo_product_id ?? null],
    enabled: !!event && (!!event.core_product_id || !!event.woo_product_id),
    queryFn: async () => {
      if (event?.core_product_id) {
        const { data } = await supabase
          .from("core_replenishment_policies")
          .select("*")
          .eq("core_product_id", event.core_product_id)
          .maybeSingle();
        if (data) return data;
      }
      if (event?.woo_product_id) {
        const { data } = await supabase
          .from("core_replenishment_policies")
          .select("*")
          .eq("woo_product_id", event.woo_product_id)
          .maybeSingle();
        return data;
      }
      return null;
    },
  });

  const effectiveBehavior =
    effectivePolicy?.replacement_behavior ?? event?.replacement_behavior ?? null;
  const effectiveReplacementCoreId =
    effectivePolicy?.replacement_product_id ?? event?.replacement_product_id ?? null;
  const effectiveReplacementWooId =
    effectivePolicy?.replacement_woo_product_id ?? event?.replacement_woo_product_id ?? null;

  const behaviorBlocked = !effectiveBehavior || !APPLY_BEHAVIORS.has(effectiveBehavior);

  // 2) Replacement product (Core)
  const { data: replacementProduct, refetch: refetchReplacement } = useQuery({
    queryKey: ["replacement_product", effectiveReplacementCoreId, effectiveReplacementWooId],
    enabled: open && (!!effectiveReplacementCoreId || !!effectiveReplacementWooId),
    queryFn: async () => {
      if (effectiveReplacementCoreId) {
        const { data } = await supabase
          .from("core_products")
          .select("id,name,woo_product_id,core_sku")
          .eq("id", effectiveReplacementCoreId)
          .maybeSingle();
        return data;
      }
      if (effectiveReplacementWooId) {
        const { data } = await supabase
          .from("core_products")
          .select("id,name,woo_product_id,core_sku")
          .eq("woo_product_id", effectiveReplacementWooId)
          .maybeSingle();
        return data;
      }
      return null;
    },
  });

  const replacementWooId = replacementProduct?.woo_product_id ?? effectiveReplacementWooId ?? null;

  // 3) Woo map row for replacement (to decide simple vs variable)
  const { data: replacementWooMap } = useQuery({
    queryKey: ["replacement_woo_map", replacementWooId],
    enabled: !!replacementWooId,
    queryFn: async () => {
      const { data } = await supabase
        .from("core_woo_product_map")
        .select("id, woo_product_id, woo_product_name, woo_product_sku, woo_product_type, woo_variations_count, variants_sync_status")
        .eq("woo_product_id", replacementWooId as number)
        .maybeSingle();
      return data;
    },
  });

  // 4) Core variants for replacement (with stock)
  const { data: replacementVariants = [], refetch: refetchVariants } = useQuery({
    queryKey: ["replacement_variants", replacementProduct?.id],
    enabled: !!replacementProduct?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("core_product_variants")
        .select("id, size, variant_label, color, woo_variation_id, variant_sku, woo_stock_quantity")
        .eq("core_product_id", replacementProduct!.id)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
  });

  const variantIds = useMemo(
    () => (replacementVariants as any[]).map((v: any) => v.id).sort(),
    [replacementVariants],
  );

  // Production units currently in fabrication — same source as CoreInventory, excludes cancelled/lost/entered_inventory
  const { data: unitsInFabByVariant = {}, refetch: refetchUnits } = useQuery({
    queryKey: ["replacement_variants_units", variantIds],
    enabled: variantIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("core_production_units")
        .select("core_variant_id")
        .in("core_variant_id", variantIds)
        .not("status", "in", "(cancelled,lost,entered_inventory)");
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (!r.core_variant_id) return;
        map[r.core_variant_id] = (map[r.core_variant_id] ?? 0) + 1;
      });
      return map;
    },
  });

  // Open production needs — quantity_pending = needed - already converted to OP, evita doble conteo con unidades
  const { data: needsPendingByVariant = {}, refetch: refetchNeeds } = useQuery({
    queryKey: ["replacement_variants_needs", variantIds],
    enabled: variantIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("core_production_needs")
        .select("core_variant_id, quantity_pending, status")
        .in("core_variant_id", variantIds)
        .not("status", "in", "(cancelled,completed,resolved,rejected)");
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (!r.core_variant_id) return;
        const q = Number(r.quantity_pending ?? 0);
        if (q > 0) map[r.core_variant_id] = (map[r.core_variant_id] ?? 0) + q;
      });
      return map;
    },
  });

  // 5) Original reserved cost from fabrication fund movement
  const { data: originalMovement } = useQuery({
    queryKey: ["original_movement", event?.source_type, event?.source_id],
    enabled: !!event && event.source_type === "fabrication_fund_movement" && !!event.source_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("core_fabrication_fund_movements")
        .select("id, amount, unit_cost_snapshot")
        .eq("id", event!.source_id as string)
        .maybeSingle();
      return data;
    },
  });

  const expectsVariants =
    (replacementWooMap?.woo_product_type === "variable") ||
    ((replacementWooMap?.woo_variations_count ?? 0) > 0) ||
    replacementVariants.length > 0;

  const hasVariants = replacementVariants.length > 0;

  // Self-replacement guard: a product cannot replace itself
  const selfReplacement =
    (!!event?.core_product_id && !!effectiveReplacementCoreId && event.core_product_id === effectiveReplacementCoreId) ||
    (!!event?.woo_product_id && !!effectiveReplacementWooId && event.woo_product_id === effectiveReplacementWooId);

  // Per-variant projections (stock + en fabricación + por producir)
  const variantProjections = useMemo(() => {
    return (replacementVariants as any[]).map((v: any) => {
      const stock = Number(v.woo_stock_quantity ?? 0);
      const inFab = Number((unitsInFabByVariant as any)[v.id] ?? 0);
      const toProduce = Number((needsPendingByVariant as any)[v.id] ?? 0);
      const projected = stock + inFab + toProduce;
      return { id: v.id as string, stock, inFab, toProduce, projected };
    });
  }, [replacementVariants, unitsInFabByVariant, needsPendingByVariant]);

  const mostNeededId = useMemo(() => {
    if (variantProjections.length === 0) return null;
    const min = Math.min(...variantProjections.map((p) => p.projected));
    const winners = variantProjections.filter((p) => p.projected === min);
    return winners.length === 1 ? winners[0].id : null;
  }, [variantProjections]);


  // Reset when opened / event changes / replacement changes
  useEffect(() => {
    if (!open || !event) return;
    if (isResolved && event.resolution_data) {
      setPreview(event.resolution_data);
      return;
    }
    setQtyByVariantId({});
    setSimpleQty(suggested);
    setConfirmedQty(suggested);
    setReason("");
    setPreview(null);
  }, [open, event?.id]);

  // Invalidate preview whenever any effective input changes
  useEffect(() => { setPreview(null); }, [
    effectiveBehavior, effectiveReplacementCoreId, effectiveReplacementWooId,
    replacementVariants.length, replacementProduct?.id,
  ]);

  const invalidatePreview = () => setPreview(null);

  // Build allocations from UI state
  const allocations: Allocation[] = useMemo(() => {
    if (!hasVariants) {
      if (!simpleQty || simpleQty <= 0) return [];
      return [{ core_variant_id: null, woo_variation_id: null, quantity: simpleQty }];
    }
    return replacementVariants
      .map((v: any) => {
        const q = Number(qtyByVariantId[v.id] ?? 0);
        if (!q || q <= 0) return null;
        return {
          core_variant_id: v.id as string,
          woo_variation_id: (v.woo_variation_id as number) ?? null,
          quantity: q,
        } as Allocation;
      })
      .filter(Boolean) as Allocation[];
  }, [hasVariants, simpleQty, replacementVariants, qtyByVariantId]);

  const totalAllocated = useMemo(
    () => allocations.reduce((s, a) => s + (Number(a.quantity) || 0), 0),
    [allocations]
  );

  const needReason = confirmedQty !== suggested && (!reason || !reason.trim());
  const totalsMatch = totalAllocated === confirmedQty && confirmedQty > 0;
  const canPreview = !behaviorBlocked && !isResolved && allocations.length > 0 && totalsMatch && !needReason;
  const canConfirm = !!preview && !preview.error && canPreview;

  const buildPayload = () => ({
    p_event_id: event!.id,
    p_allocations: allocations.map((a) => ({
      core_variant_id: a.core_variant_id,
      woo_variation_id: a.woo_variation_id,
      quantity: Number(a.quantity),
      notes: a.notes ?? null,
    })),
    p_confirmed_quantity: confirmedQty,
    p_adjustment_reason: reason || null,
  });

  const runPreview = async () => {
    if (!event) return;
    setRunning(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.rpc("core_apply_replacement_event" as any, {
        ...buildPayload(),
        p_dry_run: true,
      } as any);
      if (error) throw error;
      setPreview(data);
      if ((data as any)?.error) {
        toast({ title: "No se puede aplicar", description: String((data as any).error), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error en preview", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const runConfirm = async () => {
    if (!event || !preview) return;
    setConfirming(true);
    try {
      const { data, error } = await supabase.rpc("core_apply_replacement_event" as any, {
        ...buildPayload(),
        p_dry_run: false,
      } as any);
      if (error) throw error;
      if ((data as any)?.error) {
        toast({ title: "Confirmación bloqueada", description: String((data as any).error), variant: "destructive" });
        return;
      }
      sonner.success("Reemplazo aplicado");
      qc.invalidateQueries({ queryKey: ["policy_events"] });
      qc.invalidateQueries({ queryKey: ["policy_events_summary"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error al confirmar", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };

  // Open policy editor: build ctx (map, core, policy) for the ORIGINAL product
  const openPolicyEditor = async () => {
    if (!event?.woo_product_id) {
      toast({ title: "Falta identidad Woo", description: "El evento no tiene woo_product_id.", variant: "destructive" });
      return;
    }
    try {
      const { data: map } = await supabase
        .from("core_woo_product_map")
        .select("*")
        .eq("woo_product_id", event.woo_product_id)
        .maybeSingle();
      if (!map) {
        toast({ title: "Producto no está en Mapa Woo", variant: "destructive" });
        return;
      }
      let core = null;
      if (map.core_product_id) {
        const { data } = await supabase
          .from("core_products")
          .select("id, core_sku, name, unit_cost, manual_unit_cost_usd, cost_structure_id, woo_product_id")
          .eq("id", map.core_product_id)
          .maybeSingle();
        core = data ?? null;
      }
      setEditorCtx({ map, core, policy: effectivePolicy ?? null });
      setEditingPolicy(true);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const onPolicyEditorDone = async () => {
    qc.invalidateQueries({ queryKey: ["replenishment-policies"] });
    qc.invalidateQueries({ queryKey: ["effective-policy"] });
    qc.invalidateQueries({ queryKey: ["replacement_product"] });
    qc.invalidateQueries({ queryKey: ["replacement_variants"] });
    qc.invalidateQueries({ queryKey: ["replacement_woo_map"] });
    qc.invalidateQueries({ queryKey: ["replacement_variants_units"] });
    qc.invalidateQueries({ queryKey: ["replacement_variants_needs"] });
    await Promise.all([
      refetchPolicy(), refetchReplacement(), refetchVariants(), refetchUnits(), refetchNeeds(),
    ]);
    setPreview(null);
  };

  // Build ctx for SyncVariantsDialog: needs replacement's Woo map
  const syncCtx = useMemo(() => {
    if (!replacementWooMap) return null;
    return { map: replacementWooMap };
  }, [replacementWooMap]);

  if (!event) return null;

  const reservedAmount = originalMovement?.amount != null ? Number(originalMovement.amount) : null;
  const estimatedTotal = preview?.estimated_total != null ? Number(preview.estimated_total) : null;
  const difference = reservedAmount != null && estimatedTotal != null ? estimatedTotal - reservedAmount : null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aplicar reemplazo</DialogTitle>
          <DialogDescription>
            Preview obligatorio antes de confirmar. Cualquier edición invalida el preview.
          </DialogDescription>
        </DialogHeader>

        {/* Original / Reemplazo */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="border rounded p-3">
            <div className="text-xs text-muted-foreground mb-1">Original</div>
            <div>Woo #{event.woo_product_id ?? "—"}{event.woo_variation_id ? ` / var ${event.woo_variation_id}` : ""}</div>
            <div className="text-xs text-muted-foreground mt-1">Cantidad sugerida: {suggested}</div>
            {reservedAmount != null && (
              <div className="text-xs mt-1">Costo reservado: <b>${reservedAmount.toFixed(2)}</b></div>
            )}
          </div>
          <div className="border rounded p-3">
            <div className="text-xs text-muted-foreground mb-1">Reemplazo</div>
            <div>{replacementProduct?.name ?? (effectiveReplacementWooId ? `Woo #${effectiveReplacementWooId}` : "—")}</div>
            <div className="text-xs mt-1">
              Comportamiento:{" "}
              <Badge variant="outline">
                {effectiveBehavior ? (REPLACEMENT_BEHAVIOR_LABELS[effectiveBehavior] ?? effectiveBehavior) : "—"}
              </Badge>
            </div>
          </div>
        </div>

        {behaviorBlocked && !isResolved && (
          <div className="p-3 rounded border border-amber-500 bg-amber-500/10 text-sm flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              {effectiveBehavior === "ignore"
                ? "El comportamiento del reemplazo es 'Ignorar'. No aplicable."
                : "Este reemplazo está configurado como Solo sugerir. Para seleccionar tallas y generar la necesidad del producto sustituto, cambia el comportamiento a Usar en reposición con confirmación."}
            </div>
          </div>
        )}

        {isResolved && preview && (
          <div className="border rounded p-3 text-sm space-y-1">
            <div className="font-medium">Evento resuelto</div>
            <div className="text-xs">Ruta final: <Badge>{preview.final_route_action}</Badge></div>
            <div className="text-xs">Cantidad confirmada: {preview.confirmed_quantity}</div>
          </div>
        )}

        {!isResolved && !behaviorBlocked && (
          <>
            {/* Cantidad confirmada + razón */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Cantidad confirmada</label>
                <Input
                  type="number"
                  value={confirmedQty}
                  onChange={(e) => { setConfirmedQty(Number(e.target.value)); invalidatePreview(); }}
                  min={0.0001}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Razón de ajuste {confirmedQty !== suggested && <span className="text-red-500">*</span>}
                </label>
                <Input
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); invalidatePreview(); }}
                  placeholder={confirmedQty === suggested ? "Opcional" : "Obligatorio si difiere"}
                />
              </div>
            </div>

            {/* Selector de variantes */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Asignación</div>

              {/* Simple product */}
              {!expectsVariants && (
                <div className="border rounded p-3 text-sm">
                  <div className="text-xs text-muted-foreground mb-1">Producto sin variantes</div>
                  <div className="grid grid-cols-[1fr_140px] gap-2 items-center">
                    <div className="text-xs">
                      {replacementProduct?.name ?? "—"}
                      {replacementProduct?.core_sku ? ` · ${replacementProduct.core_sku}` : ""}
                    </div>
                    <Input
                      type="number"
                      value={simpleQty}
                      onChange={(e) => { setSimpleQty(Number(e.target.value)); invalidatePreview(); }}
                      min={0}
                    />
                  </div>
                </div>
              )}

              {/* Variable with Core variants available */}
              {expectsVariants && hasVariants && (
                <div className="border rounded divide-y">
                  {replacementVariants.map((v: any) => {
                    const label = [v.size, v.variant_label].filter(Boolean).join(" · ") || v.variant_sku || v.id.slice(0, 8);
                    return (
                      <div key={v.id} className="grid grid-cols-[1fr_140px] gap-2 items-center p-2">
                        <div className="text-xs">
                          <div className="font-medium">{label}</div>
                          <div className="text-muted-foreground">{v.variant_sku ?? "—"}</div>
                        </div>
                        <Input
                          type="number"
                          value={qtyByVariantId[v.id] ?? 0}
                          onChange={(e) => {
                            setQtyByVariantId((prev) => ({ ...prev, [v.id]: Number(e.target.value) }));
                            invalidatePreview();
                          }}
                          min={0}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Variable without Core variants */}
              {expectsVariants && !hasVariants && (
                <div className="border border-amber-500/60 rounded p-3 text-sm space-y-2 bg-amber-500/5">
                  <div className="flex gap-2 items-start">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>No se encontraron variantes fabricables para el producto reemplazo.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {replacementWooId ? (
                      <Button size="sm" variant="outline" onClick={() => setSyncingVariants(true)}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Sincronizar variantes
                      </Button>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Este producto no tiene un producto Woo vinculado. Revisa su conexión en Mapa Woo/Core.
                      </div>
                    )}
                    {replacementProduct?.id && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/core/productos/${replacementProduct.id}`)}>
                        <ExternalLink className="w-3 h-3 mr-1" /> Abrir producto
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={openPolicyEditor}>
                      <Pencil className="w-3 h-3 mr-1" /> Editar política
                    </Button>
                  </div>
                </div>
              )}

              <div className="text-xs flex justify-between">
                <span>Total asignado: <span className="font-mono">{totalAllocated}</span> / {confirmedQty}</span>
                {!totalsMatch && confirmedQty > 0 && (
                  <span className="text-red-500">La suma debe coincidir con la cantidad confirmada.</span>
                )}
              </div>

              <div>
                <Button size="sm" variant="ghost" onClick={openPolicyEditor}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar política / cambiar producto reemplazo
                </Button>
              </div>
            </div>

            {/* Preview */}
            {preview && !preview.error && (
              <div className="border rounded p-3 text-sm space-y-2">
                <div className="text-xs font-semibold">Preview</div>
                <div className="text-xs">Ruta final: <Badge>{preview.final_route_action}</Badge></div>
                <div className="border rounded divide-y">
                  {(preview.allocations ?? []).map((a: any, i: number) => {
                    const v = replacementVariants.find((rv: any) => rv.id === a.core_variant_id);
                    const label = v
                      ? ([v.size, v.variant_label].filter(Boolean).join(" · ") || v.variant_sku || "—")
                      : (a.woo_variation_id ? `var ${a.woo_variation_id}` : "Sin variante");
                    const sku = v?.variant_sku ?? "—";
                    return (
                      <div key={i} className="grid grid-cols-[1fr_60px_90px_90px] gap-2 p-2 text-xs items-center">
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-muted-foreground">{sku} · {a.cost_source ?? "—"}</div>
                        </div>
                        <div className="text-right">{a.quantity}</div>
                        <div className="text-right">${Number(a.unit_cost ?? 0).toFixed(2)}</div>
                        <div className="text-right">${Number(a.subtotal ?? 0).toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs flex justify-between pt-1">
                  <span>Total destino: <b>${Number(preview.estimated_total ?? 0).toFixed(2)}</b></span>
                  {reservedAmount != null && difference != null && (
                    <span>Diferencia estimada: <b className={difference > 0 ? "text-red-500" : difference < 0 ? "text-emerald-600" : ""}>
                      {difference >= 0 ? "+" : ""}${difference.toFixed(2)}
                    </b> <span className="text-muted-foreground">(informativa)</span></span>
                  )}
                </div>
                {preview.warnings && Array.isArray(preview.warnings) && preview.warnings.length > 0 && (
                  <div className="text-xs text-amber-600">Advertencias: {preview.warnings.join(", ")}</div>
                )}
              </div>
            )}

            {preview?.error && (
              <div className="p-3 rounded border border-red-500 bg-red-500/10 text-sm">
                {preview.error} {preview.message ? `— ${preview.message}` : ""}
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          {!isResolved && behaviorBlocked && (
            <Button onClick={openPolicyEditor}>
              <Pencil className="w-3 h-3 mr-1" /> Editar política
            </Button>
          )}
          {!isResolved && !behaviorBlocked && (
            <>
              <Button variant="outline" onClick={runPreview} disabled={running || !canPreview}>
                {running && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Generar preview
              </Button>
              <Button onClick={runConfirm} disabled={!canConfirm || confirming}>
                {confirming && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Confirmar reemplazo
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {editingPolicy && editorCtx && (
      <NoRestockConfigDialog
        open={editingPolicy}
        onClose={() => setEditingPolicy(false)}
        onDone={onPolicyEditorDone}
        rowsCtx={[editorCtx]}
        initialCtx={editorCtx}
        initialStatus="replaced"
      />
    )}

    {syncingVariants && syncCtx && (
      <SyncVariantsDialog
        open={syncingVariants}
        onClose={() => setSyncingVariants(false)}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["replacement_variants"] });
          qc.invalidateQueries({ queryKey: ["replacement_woo_map"] });
          refetchVariants();
        }}
        ctx={syncCtx}
      />
    )}
    </>
  );
}
