import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { toast as sonner } from "sonner";

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
  resolution_data?: any;
};

type Allocation = {
  core_variant_id: string | null;
  woo_variation_id: number | null;
  quantity: number;
  notes?: string;
  _label?: string;
};

export function ReplacementApplicationDialog({
  event, open, onOpenChange,
}: {
  event: Event | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [confirmedQty, setConfirmedQty] = useState<number>(0);
  const [reason, setReason] = useState<string>("");
  const [preview, setPreview] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const suggested = Number(event?.quantity ?? 0);
  const isResolved = event?.status === "resolved";
  const behavior = event?.replacement_behavior ?? null;
  const behaviorBlocked = !behavior || behavior === "suggest_only" || behavior === "ignore";

  // Resolve replacement product ID (from event first, fall back to core_products.woo_product_id)
  const { data: replacementProduct } = useQuery({
    queryKey: ["replacement_product", event?.replacement_product_id, event?.replacement_woo_product_id],
    enabled: !!event && (!!event.replacement_product_id || !!event.replacement_woo_product_id),
    queryFn: async () => {
      if (event?.replacement_product_id) {
        const { data } = await supabase.from("core_products").select("id,name,woo_product_id").eq("id", event.replacement_product_id).maybeSingle();
        return data;
      }
      if (event?.replacement_woo_product_id) {
        const { data } = await supabase.from("core_products").select("id,name,woo_product_id").eq("woo_product_id", event.replacement_woo_product_id).maybeSingle();
        return data;
      }
      return null;
    },
  });

  const { data: replacementVariants = [] } = useQuery({
    queryKey: ["replacement_variants", replacementProduct?.id],
    enabled: !!replacementProduct?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("core_product_variants")
        .select("id, size, variant_label, woo_variation_id, variant_sku")
        .eq("core_product_id", replacementProduct!.id)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
  });

  // Reset when opened / event changes
  useEffect(() => {
    if (!open || !event) return;
    if (isResolved && event.resolution_data) {
      setPreview(event.resolution_data);
      return;
    }
    setAllocations([]);
    setConfirmedQty(suggested);
    setReason("");
    setPreview(null);
  }, [open, event?.id]);

  const invalidatePreview = () => setPreview(null);

  const addAllocation = () => {
    setAllocations((prev) => [...prev, { core_variant_id: null, woo_variation_id: null, quantity: 0 }]);
    invalidatePreview();
  };

  const removeAllocation = (i: number) => {
    setAllocations((prev) => prev.filter((_, idx) => idx !== i));
    invalidatePreview();
  };

  const updateAllocation = (i: number, patch: Partial<Allocation>) => {
    setAllocations((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
    invalidatePreview();
  };

  const totalAllocated = useMemo(
    () => allocations.reduce((s, a) => s + (Number(a.quantity) || 0), 0),
    [allocations]
  );

  const needReason = confirmedQty !== suggested && (!reason || !reason.trim());
  const totalsMatch = totalAllocated === confirmedQty && confirmedQty > 0;
  const canPreview =
    !behaviorBlocked && !isResolved && allocations.length > 0 && totalsMatch && !needReason;
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

  if (!event) return null;

  return (
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
          </div>
          <div className="border rounded p-3">
            <div className="text-xs text-muted-foreground mb-1">Reemplazo</div>
            <div>{replacementProduct?.name ?? (event.replacement_woo_product_id ? `Woo #${event.replacement_woo_product_id}` : "—")}</div>
            <div className="text-xs mt-1">
              Comportamiento: <Badge variant="outline">{behavior ?? "—"}</Badge>
            </div>
          </div>
        </div>

        {behaviorBlocked && !isResolved && (
          <div className="p-3 rounded border border-amber-500 bg-amber-500/10 text-sm flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            {behavior === "ignore"
              ? "El comportamiento del reemplazo es 'ignore'. No aplicable."
              : "El comportamiento es 'suggest_only' o no está definido. Edite la política para permitir la aplicación."}
          </div>
        )}

        {isResolved && preview && (
          <div className="border rounded p-3 text-sm space-y-1">
            <div className="font-medium">Evento resuelto</div>
            <div className="text-xs">Ruta final: <Badge>{preview.final_route_action}</Badge></div>
            <div className="text-xs">Cantidad confirmada: {preview.confirmed_quantity}</div>
            <div className="text-xs">Necesidades creadas: {(preview.created_need_ids ?? []).length}</div>
            <div className="text-xs">Eventos downstream: {(preview.created_policy_event_ids ?? []).length}</div>
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

            {/* Asignaciones */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Asignación por variante</div>
                <Button size="sm" variant="outline" onClick={addAllocation}>
                  <Plus className="w-3 h-3 mr-1" /> Añadir
                </Button>
              </div>

              {allocations.length === 0 && (
                <div className="text-xs text-muted-foreground border rounded p-3">
                  Sin asignaciones. Añade al menos una y distribuye la cantidad confirmada.
                </div>
              )}

              {allocations.map((a, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                  <select
                    className="border rounded px-2 py-1 text-sm bg-background"
                    value={a.core_variant_id ?? ""}
                    onChange={(e) => {
                      const cv = e.target.value || null;
                      const found = replacementVariants.find((v: any) => v.id === cv);
                      updateAllocation(i, {
                        core_variant_id: cv,
                        woo_variation_id: (found as any)?.woo_variation_id ?? null,
                      });
                    }}
                  >
                    <option value="">— Sin variante (producto sin variantes) —</option>
                    {replacementVariants.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.size ?? v.variant_label ?? v.variant_sku ?? v.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    value={a.quantity}
                    onChange={(e) => updateAllocation(i, { quantity: Number(e.target.value) })}
                    min={0.0001}
                  />
                  <Button size="sm" variant="ghost" onClick={() => removeAllocation(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}

              <div className="text-xs flex justify-between">
                <span>Total asignado: <span className="font-mono">{totalAllocated}</span> / {confirmedQty}</span>
                {!totalsMatch && confirmedQty > 0 && (
                  <span className="text-red-500">La suma debe coincidir con la cantidad confirmada.</span>
                )}
              </div>
            </div>

            {/* Preview */}
            {preview && !preview.error && (
              <div className="border rounded p-3 text-sm space-y-1">
                <div className="text-xs font-semibold">Preview</div>
                <div className="text-xs">Ruta: <Badge>{preview.final_route_action}</Badge></div>
                <div className="text-xs">Total estimado: {Number(preview.estimated_total ?? 0).toFixed(2)}</div>
                <div className="text-xs">Resumen: {JSON.stringify(preview.route_summary)}</div>
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
  );
}
