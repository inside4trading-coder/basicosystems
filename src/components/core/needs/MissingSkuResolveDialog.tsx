import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Ban, Repeat, Search, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  useReplenishmentPolicyEvents,
  type PolicyEvent,
} from "@/hooks/useReplenishmentPolicyEvents";
import { ReplacementApplicationDialog } from "@/components/core/woocore/ReplacementApplicationDialog";

type FabricableCandidate = {
  id: string;
  core_sku: string;
  name: string;
  woo_product_id: number | null;
};

type Props = {
  row: PolicyEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type Step = "cost" | "action" | "picker" | "apply";

export function MissingSkuResolveDialog({ row, open, onOpenChange }: Props) {
  const {
    resolveMissingSkuPendingItem,
    closeMissingSkuPendingItem,
    invalidateAll,
  } = useReplenishmentPolicyEvents();

  const [step, setStep] = useState<Step>("cost");
  const [unitCostStr, setUnitCostStr] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [movementId, setMovementId] = useState<string | null>(null);
  const [bridgeEvent, setBridgeEvent] = useState<any | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("cost");
      setUnitCostStr("");
      setSearch("");
      setSaving(false);
      setMovementId(null);
      setBridgeEvent(null);
    }
  }, [open]);

  const pendingItemId = row?.sourcePendingItemId ?? null;
  const unitCost = Number(unitCostStr);
  const validCost = Number.isFinite(unitCost) && unitCost > 0;
  const qty = row?.quantity && row.quantity > 0 ? Number(row.quantity) : 1;
  const amount = validCost ? unitCost * qty : 0;

  const snapName =
    (row?.resolution_data as any)?.product_name ??
    (row as any)?.message ??
    "—";
  const snapSku = (row?.resolution_data as any)?.woo_sku ?? "—";

  const candidatesQuery = useQuery({
    queryKey: ["fabricable-candidates-for-missing-sku"],
    enabled: open && step === "picker",
    queryFn: async () => {
      const { data: products, error } = await (supabase as any)
        .from("core_products")
        .select("id, core_sku, name, woo_product_id, commercial_status, is_restockable")
        .eq("commercial_status", "active")
        .eq("is_restockable", true)
        .order("name", { ascending: true })
        .limit(2000);
      if (error) throw error;
      const rows = (products ?? []) as any[];
      const coreIds = rows.map((r) => r.id).filter(Boolean);
      const wooIds = Array.from(
        new Set(rows.map((r) => r.woo_product_id).filter((x: any) => !!x)),
      );
      const [polByCore, polByWoo] = await Promise.all([
        coreIds.length
          ? (supabase as any)
              .from("core_replenishment_policies")
              .select(
                "core_product_id, woo_product_id, lifecycle_status, replenishment_route, restock_enabled, updated_at",
              )
              .in("core_product_id", coreIds)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        wooIds.length
          ? (supabase as any)
              .from("core_replenishment_policies")
              .select(
                "core_product_id, woo_product_id, lifecycle_status, replenishment_route, restock_enabled, updated_at",
              )
              .in("woo_product_id", wooIds as any)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      const byCore = new Map<string, any>();
      for (const p of (polByCore as any).data ?? []) {
        if (p.core_product_id && !byCore.has(p.core_product_id))
          byCore.set(p.core_product_id, p);
      }
      const byWoo = new Map<number, any>();
      for (const p of (polByWoo as any).data ?? []) {
        if (p.woo_product_id && !byWoo.has(p.woo_product_id))
          byWoo.set(p.woo_product_id, p);
      }
      return rows
        .map((r) => {
          const pol =
            byCore.get(r.id) ?? (r.woo_product_id ? byWoo.get(r.woo_product_id) : null);
          return { ...r, _policy: pol };
        })
        .filter((r) => {
          const p = r._policy;
          if (!p) return true;
          if (["replaced", "no_restock", "exit", "ignored"].includes(p.lifecycle_status))
            return false;
          if (p.replenishment_route === "external_supplier") return false;
          if (p.restock_enabled === false) return false;
          return true;
        });
    },
  });

  const candidates: FabricableCandidate[] = useMemo(() => {
    const list = (candidatesQuery.data ?? []) as any[];
    const s = search.trim().toLowerCase();
    return list
      .filter(
        (c) =>
          !s ||
          (c.core_sku ?? "").toLowerCase().includes(s) ||
          (c.name ?? "").toLowerCase().includes(s),
      )
      .slice(0, 100);
  }, [candidatesQuery.data, search]);

  async function handleNoRestock() {
    if (!pendingItemId || !validCost) return;
    setSaving(true);
    const res = await resolveMissingSkuPendingItem({
      pendingItemId,
      unitCost,
      action: "no_restock",
    });
    setSaving(false);
    if (res) {
      toast({
        title: "Marcado como no restock",
        description: `Reserva de ${amount.toFixed(2)} USD en Partida no restockable.`,
      });
      onOpenChange(false);
    }
  }

  async function handlePickCandidate(candidate: FabricableCandidate) {
    if (!pendingItemId || !row || !validCost) return;
    setSaving(true);
    try {
      // Prepare fund reservation (idempotent server-side)
      const res = await resolveMissingSkuPendingItem({
        pendingItemId,
        unitCost,
        action: "replacement_prepare",
      });
      if (!res) {
        setSaving(false);
        return;
      }
      // If pending was already resolved server-side, just close and exit.
      if ((res as any).already_resolved) {
        toast({
          title: "Ya resuelto",
          description: "Esta venta sin mapeo ya estaba resuelta.",
        });
        invalidateAll();
        onOpenChange(false);
        setSaving(false);
        return;
      }
      const movId = (res.movement_id as string) ?? null;
      if (!movId) {
        toast({
          title: "Error",
          description: "No se pudo obtener el movimiento base.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      setMovementId(movId);

      // Reuse any existing bridge event for this movement (open/reviewed/resolved)
      const { data: existing } = await supabase
        .from("core_replenishment_policy_events" as any)
        .select("*")
        .eq("source_type", "fabrication_fund_movement")
        .eq("source_id", movId)
        .eq("action", "suggest_replacement")
        .in("status", ["open", "reviewed", "resolved"])
        .order("created_at", { ascending: false })
        .limit(1);

      let ev: any = (existing ?? [])[0] ?? null;

      // If a resolved event already exists → replacement was already applied.
      // Close the pending item if still open, notify, and exit. Do NOT create a duplicate.
      if (ev && ev.status === "resolved") {
        await closeMissingSkuPendingItem({
          pendingItemId,
          replacementEventId: ev.id,
        });
        toast({
          title: "Ya reemplazado",
          description: "Esta venta sin mapeo ya tenía un reemplazo aplicado.",
        });
        invalidateAll();
        onOpenChange(false);
        setSaving(false);
        return;
      }

      if (!ev) {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id ?? null;
        const payload: any = {
          action: "suggest_replacement",
          status: "open",
          severity: "warning",
          source_type: "fabrication_fund_movement",
          source_id: movId,
          quantity: qty,
          unit_cost: unitCost,
          amount,
          core_product_id: row.core_product_id,
          woo_product_id: row.woo_product_id,
          woo_variation_id: row.woo_variation_id,
          woo_order_id: row.woo_order_id ?? null,
          woo_order_item_id: row.woo_order_item_id ?? null,
          replacement_product_id: candidate.id,
          replacement_woo_product_id: candidate.woo_product_id ?? null,
          replacement_behavior: "use_on_restock_with_confirmation",
          created_by: uid,
          resolution_data: {
            product_name: (row.resolution_data as any)?.product_name ?? null,
            sku: (row.resolution_data as any)?.woo_sku ?? null,
            bridge_source: "missing_sku_manual_resolution",
            origin_movement_id: movId,
            origin_pending_item_id: pendingItemId,
          },
        };
        const { data: inserted, error } = await supabase
          .from("core_replenishment_policy_events" as any)
          .insert(payload)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        ev = inserted;
      }

      setBridgeEvent(ev);
      setStep("apply");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }


  async function handleApplyClose(v: boolean) {
    if (v) return;
    if (!bridgeEvent || !pendingItemId) {
      setStep("action");
      return;
    }
    try {
      // Fresh read of bridge event status
      const { data, error } = await supabase
        .from("core_replenishment_policy_events" as any)
        .select("id, status")
        .eq("id", bridgeEvent.id)
        .maybeSingle();
      if (error) throw error;
      const status = (data as any)?.status;
      if (status === "resolved") {
        await closeMissingSkuPendingItem({
          pendingItemId,
          replacementEventId: bridgeEvent.id,
        });
        toast({
          title: "Resuelto",
          description: "Venta sin mapeo resuelta por reemplazo.",
        });
        invalidateAll();
        onOpenChange(false);
        return;
      }
      // Not resolved yet; keep the bridge for reuse next time
      setBridgeEvent(null);
      setStep("action");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setBridgeEvent(null);
      setStep("action");
    }
  }


  if (!row) return null;

  return (
    <>
      <Dialog open={open && step !== "apply"} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Resolver venta sin mapeo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 border rounded p-3 bg-muted/30 text-xs">
              <div>
                <div className="text-muted-foreground">Producto</div>
                <div className="font-medium">{snapName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">SKU</div>
                <div className="font-medium">{snapSku}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Pedido</div>
                <div className="font-medium">{row.woo_order_id ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Cantidad</div>
                <div className="font-medium">{qty}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Monto vendido</div>
                <div className="font-medium">
                  {row.amount != null ? Number(row.amount).toFixed(2) : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Woo product</div>
                <div className="font-medium">{row.woo_product_id ?? "—"}</div>
              </div>
            </div>

            {step === "cost" && (
              <div className="space-y-3 pt-2">
                <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Primero debes configurar un costo para decidir qué hacer con este
                    producto.
                  </span>
                </div>
                <label className="text-xs font-medium flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Costo unitario (USD)
                </label>
                <Input
                  autoFocus
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitCostStr}
                  onChange={(e) => setUnitCostStr(e.target.value)}
                  placeholder="0.00"
                />
                {validCost && (
                  <p className="text-xs text-muted-foreground">
                    Reserva total: <strong>{amount.toFixed(2)} USD</strong> ({qty} ×{" "}
                    {unitCost.toFixed(2)})
                  </p>
                )}
                <Button
                  className="w-full"
                  disabled={!validCost || !pendingItemId}
                  onClick={() => setStep("action")}
                >
                  Continuar
                </Button>
              </div>
            )}

            {step === "action" && (
              <div className="space-y-2 pt-2">
                <div className="text-xs text-muted-foreground">
                  Costo unitario: <strong>{unitCost.toFixed(2)} USD</strong> · Reserva
                  total: <strong>{amount.toFixed(2)} USD</strong>
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={handleNoRestock}
                  disabled={saving}
                >
                  <Ban className="w-4 h-4 mr-2 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">No restock</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      No se fabricará ni se reemplazará. El costo se guarda en Partida no
                      restockable.
                    </div>
                  </div>
                </Button>
                <Button
                  className="w-full justify-start h-auto py-3"
                  onClick={() => setStep("picker")}
                  disabled={saving}
                >
                  <Repeat className="w-4 h-4 mr-2 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">Reemplazar por otra prenda</div>
                    <div className="text-xs opacity-80 font-normal">
                      Usar este costo como reserva y reemplazarlo por una prenda del
                      Catálogo de Fabricación.
                    </div>
                  </div>
                </Button>
              </div>
            )}

            {step === "picker" && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto del Catálogo de Fabricación…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-64 overflow-y-auto border rounded">
                  {candidatesQuery.isLoading ? (
                    <p className="p-3 text-xs text-muted-foreground">Cargando…</p>
                  ) : candidates.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">Sin resultados</p>
                  ) : (
                    candidates.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handlePickCandidate(c)}
                        disabled={saving}
                        className="w-full text-left p-2 hover:bg-muted border-b text-xs disabled:opacity-50"
                      >
                        <div className="font-medium">
                          {c.core_sku} · {c.name}
                        </div>
                        <div className="text-muted-foreground">
                          {c.woo_product_id ? `Woo #${c.woo_product_id}` : "sin Woo"}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Sólo prendas activas y restockeables del catálogo de fabricación
                </Badge>
              </div>
            )}
          </div>

          <DialogFooter>
            {step === "cost" ? (
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
            ) : step === "action" ? (
              <Button variant="ghost" onClick={() => setStep("cost")} disabled={saving}>
                Volver
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setStep("action")}
                disabled={saving}
              >
                Volver
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === "apply" && bridgeEvent && (
        <ReplacementApplicationDialog
          event={bridgeEvent as any}
          open={true}
          onOpenChange={handleApplyClose}
        />
      )}
    </>
  );
}
