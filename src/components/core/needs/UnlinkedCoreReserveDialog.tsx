import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Ban, MapPin, Repeat, Search } from "lucide-react";
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

type Step = "action" | "picker" | "apply";

export function UnlinkedCoreReserveDialog({ row, open, onOpenChange }: Props) {
  const { resolveUnlinkedCoreMovement, invalidateAll } = useReplenishmentPolicyEvents();
  const navigate = useNavigate();
  const refreshNeeds = () => window.dispatchEvent(new Event("core-needs-refresh"));

  const [step, setStep] = useState<Step>("action");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [bridgeEvent, setBridgeEvent] = useState<any | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("action");
      setSearch("");
      setSaving(false);
      setBridgeEvent(null);
    }
  }, [open]);

  const movementId = row?.sourceMovementId ?? null;
  const qty = row?.quantity && row.quantity > 0 ? Number(row.quantity) : 1;
  const unitCost = row?.unit_cost_snapshot ?? row?.unit_cost ?? null;
  const amount = row?.amount != null ? Number(row.amount) : null;
  const snapName = (row?.resolution_data as any)?.product_name ?? "—";
  const snapSku = (row?.resolution_data as any)?.woo_sku ?? "—";

  const candidatesQuery = useQuery({
    queryKey: ["fabricable-candidates-for-unlinked-core"],
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

  function handleOpenMap() {
    const params = new URLSearchParams();
    if (row?.woo_product_id) params.set("woo_product_id", String(row.woo_product_id));
    else if (snapSku && snapSku !== "—") params.set("search", snapSku);
    if (row?.woo_variation_id) params.set("woo_variation_id", String(row.woo_variation_id));
    params.set("action", "map");
    onOpenChange(false);
    navigate(`/core/mapa-woo-core?${params.toString()}`);
  }

  async function handleNoRestock() {
    if (!movementId) return;
    setSaving(true);
    const res = await resolveUnlinkedCoreMovement({ movementId, action: "no_restock" });
    setSaving(false);
    if (res) {
      toast({
        title: (res as any).already_resolved ? "Ya resuelto" : "Marcado como no restock",
        description:
          amount != null
            ? `Reserva de ${amount.toFixed(2)} USD movida a Partida no restockable.`
            : undefined,
      });
      refreshNeeds();
      onOpenChange(false);
    }
  }

  async function handlePickCandidate(candidate: FabricableCandidate) {
    if (!movementId || !row) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("core_replenishment_policy_events" as any)
        .select("*")
        .eq("source_type", "fabrication_fund_movement")
        .eq("source_id", movementId)
        .eq("action", "suggest_replacement")
        .in("status", ["open", "reviewed", "resolved"])
        .order("created_at", { ascending: false })
        .limit(1);

      let ev: any = (existing ?? [])[0] ?? null;

      if (ev && ev.status === "resolved") {
        await resolveUnlinkedCoreMovement({
          movementId,
          action: "mark_replaced",
          replacementEventId: ev.id,
        });
        toast({
          title: "Ya reemplazado",
          description: "Esta reserva ya tenía un reemplazo aplicado.",
        });
        invalidateAll();
        refreshNeeds();
        onOpenChange(false);
        setSaving(false);
        return;
      }

      if (ev) {
        // Evento puente reutilizado: forzar comportamiento aplicable sin tocar
        // la política global del producto.
        const rd = { ...(ev.resolution_data ?? {}) };
        const needsFix =
          ev.replacement_behavior !== "use_on_restock_with_confirmation" ||
          rd.forced_behavior !== "use_on_restock_with_confirmation" ||
          ev.replacement_product_id !== candidate.id;
        if (needsFix) {
          const nextRd = {
            ...rd,
            bridge_source: rd.bridge_source ?? "unlinked_core_reserve",
            origin_movement_id: movementId,
            forced_behavior: "use_on_restock_with_confirmation",
          };
          const { data: updated, error: updErr } = await supabase
            .from("core_replenishment_policy_events" as any)
            .update({
              replacement_behavior: "use_on_restock_with_confirmation",
              replacement_product_id: candidate.id,
              replacement_woo_product_id: candidate.woo_product_id ?? null,
              resolution_data: nextRd,
            })
            .eq("id", ev.id)
            .select("*")
            .maybeSingle();
          if (updErr) throw updErr;
          ev = updated ?? { ...ev, resolution_data: nextRd };
        }
      }

      if (!ev) {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id ?? null;
        const payload: any = {
          action: "suggest_replacement",
          status: "open",
          severity: "warning",
          source_type: "fabrication_fund_movement",
          source_id: movementId,
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
            product_name: snapName,
            sku: snapSku,
            bridge_source: "unlinked_core_reserve",
            origin_movement_id: movementId,
            forced_behavior: "use_on_restock_with_confirmation",
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
    if (!bridgeEvent || !movementId) {
      setStep("action");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("core_replenishment_policy_events" as any)
        .select("id, status")
        .eq("id", bridgeEvent.id)
        .maybeSingle();
      if (error) throw error;
      if ((data as any)?.status === "resolved") {
        await resolveUnlinkedCoreMovement({
          movementId,
          action: "mark_replaced",
          replacementEventId: bridgeEvent.id,
        });
        toast({
          title: "Resuelto",
          description: "Reserva sin vínculo Core resuelta por reemplazo.",
        });
        invalidateAll();
        refreshNeeds();
        onOpenChange(false);
        return;
      }
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
            <DialogTitle>Decidir reserva sin vínculo Core</DialogTitle>
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
                <div className="text-muted-foreground">Item</div>
                <div className="font-medium">{row.woo_order_item_id ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Woo product / variation</div>
                <div className="font-medium">
                  {row.woo_product_id ?? "—"}
                  {row.woo_variation_id ? ` / ${row.woo_variation_id}` : ""}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Cantidad</div>
                <div className="font-medium">{qty}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Costo reservado</div>
                <div className="font-medium">
                  {unitCost != null ? `${Number(unitCost).toFixed(2)} USD` : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Monto reservado</div>
                <div className="font-medium">
                  {amount != null ? `${amount.toFixed(2)} USD` : "—"}
                </div>
              </div>
            </div>

            {step === "action" && (
              <div className="space-y-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={handleOpenMap}
                  disabled={saving}
                >
                  <MapPin className="w-4 h-4 mr-2 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">Vincular en Mapa Woo/Core</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      Usa esta opción si esta venta corresponde a un producto fabricable
                      existente.
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={handleNoRestock}
                  disabled={saving || !movementId}
                >
                  <Ban className="w-4 h-4 mr-2 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">No restock</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      No se fabricará ni se reemplazará. El dinero pasa a Partida no
                      restockable.
                    </div>
                  </div>
                </Button>
                <Button
                  className="w-full justify-start h-auto py-3"
                  onClick={() => setStep("picker")}
                  disabled={saving || !movementId}
                >
                  <Repeat className="w-4 h-4 mr-2 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">Reemplazar por otra prenda</div>
                    <div className="text-xs opacity-80 font-normal">
                      Usar esta reserva para fabricar otra prenda del Catálogo de
                      Fabricación.
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
            {step === "action" ? (
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setStep("action")} disabled={saving}>
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
