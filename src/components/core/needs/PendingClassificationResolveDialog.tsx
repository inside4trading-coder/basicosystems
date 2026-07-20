import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Ban, Repeat, Search } from "lucide-react";
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

type Mode = "menu" | "picker" | "apply";

export function PendingClassificationResolveDialog({ row, open, onOpenChange }: Props) {
  const {
    resolvePendingClassificationNoRestock,
    markPendingClassificationReplaced,
    setPendingClassificationBridgeEventId,
    invalidateAll,
  } = useReplenishmentPolicyEvents();
  const candidatesQuery = useQuery({
    queryKey: ["fabricable-candidates-for-pending-classification"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("core_products")
        .select("id, core_sku, name, woo_product_id, commercial_status, is_restockable, replenishment_route")
        .eq("commercial_status", "active")
        .eq("is_restockable", true)
        .eq("replenishment_route", "internal_factory")
        .order("name", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const coreProducts: FabricableCandidate[] = candidatesQuery.data ?? [];

  const [mode, setMode] = useState<Mode>("menu");
  const [search, setSearch] = useState("");
  const [pickedCore, setPickedCore] = useState<FabricableCandidate | null>(null);
  const [bridgeEvent, setBridgeEvent] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("menu");
      setSearch("");
      setPickedCore(null);
      setBridgeEvent(null);
      setSaving(false);
    }
  }, [open]);

  const movementId = row?.sourceMovementId ?? null;
  const existingEventId =
    row?.pendingClassificationResolution?.replacement_event_id ?? null;

  // Derived qty/cost/amount
  const derived = useMemo(() => {
    if (!row) return { qty: 0, unitCost: null as number | null, amount: null as number | null };
    const qty = Number(row.quantity ?? (row as any).qty ?? 1);
    const unitCost =
      row.unit_cost_snapshot ??
      row.unit_cost ??
      (row as any).cost ??
      null;
    const amount =
      row.amount ?? (unitCost != null ? Number(qty) * Number(unitCost) : null);
    return { qty, unitCost, amount };
  }, [row]);

  const canReplace = derived.unitCost != null && derived.amount != null;

  const candidates = useMemo(() => {
    if (!row) return [] as FabricableCandidate[];
    const s = search.trim().toLowerCase();
    return coreProducts
      .filter((c: any) => c.commercial_status === "active")
      .filter((c: any) => c.is_restockable === true)
      .filter((c: any) => c.replenishment_route === "internal_factory")
      .filter((c) => c.id !== row.core_product_id)
      .filter((c) => !row.woo_product_id || c.woo_product_id !== row.woo_product_id)
      .filter((c) => !s || c.core_sku.toLowerCase().includes(s) || c.name.toLowerCase().includes(s))
      .slice(0, 100);
  }, [coreProducts, search, row]);

  async function handleNoRestock() {
    if (!movementId) return;
    setSaving(true);
    const ok = await resolvePendingClassificationNoRestock(movementId);
    setSaving(false);
    if (ok) {
      toast({ title: "Marcado como no restock" });
      onOpenChange(false);
    }
  }

  async function handleReplace() {
    if (!canReplace) {
      toast({
        title: "No se puede reemplazar",
        description:
          "El movimiento no tiene costo reservado válido.",
        variant: "destructive",
      });
      return;
    }
    setMode("picker");
  }

  async function handlePickCandidate(candidate: FabricableCandidate) {
    if (!row || !movementId) return;
    setPickedCore(candidate);
    setSaving(true);
    try {
      // Idempotency: try to reuse an existing bridge event
      if (existingEventId) {
        const { data: existing, error: exErr } = await supabase
          .from("core_replenishment_policy_events" as any)
          .select("*")
          .eq("id", existingEventId)
          .maybeSingle();
        if (exErr) throw exErr;
        const ev = existing as any;
        if (ev) {
          if (ev.status === "open" || ev.status === "reviewed") {
            setBridgeEvent(ev);
            setMode("apply");
            setSaving(false);
            return;
          }
          if (ev.status === "resolved") {
            await markPendingClassificationReplaced(movementId, ev.id);
            toast({ title: "Reemplazo ya aplicado", description: "Se marcó como corregido." });
            setSaving(false);
            onOpenChange(false);
            return;
          }
          // ignored (or other) → create a new bridge event below
        }
      }

      // Create new bridge event
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const payload: any = {
        action: "suggest_replacement",
        status: "open",
        severity: "warning",
        source_type: "fabrication_fund_movement",
        source_id: movementId,
        quantity: derived.qty,
        unit_cost: derived.unitCost,
        amount: derived.amount,
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
          bridge_source: "pending_classification",
          origin_movement_id: movementId,
        },
      };
      const { data: inserted, error } = await supabase
        .from("core_replenishment_policy_events" as any)
        .insert(payload)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      const ev = inserted as any;
      // Persist replacement_event_id in the movement so re-openings are idempotent
      await setPendingClassificationBridgeEventId(movementId, ev.id);
      setBridgeEvent(ev);
      setMode("apply");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyClose(v: boolean) {
    if (v) return; // still open
    if (!bridgeEvent || !movementId) {
      setMode("menu");
      return;
    }
    // Fresh SELECT of the event status
    try {
      const { data, error } = await supabase
        .from("core_replenishment_policy_events" as any)
        .select("id, status")
        .eq("id", bridgeEvent.id)
        .maybeSingle();
      if (error) throw error;
      const status = (data as any)?.status;
      if (status === "resolved") {
        await markPendingClassificationReplaced(movementId, bridgeEvent.id);
        toast({ title: "Reemplazo aplicado", description: "Fila marcada como corregida." });
        invalidateAll();
        onOpenChange(false);
        return;
      }
      // open/reviewed/error → bridge remains reusable
      setBridgeEvent(null);
      setMode("menu");
    } catch (e: any) {
      toast({ title: "Error al verificar evento", description: e.message, variant: "destructive" });
      setBridgeEvent(null);
      setMode("menu");
    }
  }

  if (!row) return null;

  const snapName = (row.resolution_data as any)?.product_name ?? "—";
  const snapSku = (row.resolution_data as any)?.woo_sku ?? "—";

  return (
    <>
      <Dialog open={open && mode !== "apply"} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Resolver partida sin clasificar</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Esta venta ya reservó dinero en Partidas, pero falta decidir si debe reponerse o cerrarse sin restock.
            </p>

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
                <div className="font-medium">{derived.qty}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Costo unit.</div>
                <div className="font-medium">
                  {derived.unitCost != null ? Number(derived.unitCost).toFixed(2) : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Monto reservado</div>
                <div className="font-medium">
                  {derived.amount != null ? Number(derived.amount).toFixed(2) : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Woo product</div>
                <div className="font-medium">{row.woo_product_id ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Woo variation</div>
                <div className="font-medium">{row.woo_variation_id ?? "—"}</div>
              </div>
            </div>

            {mode === "menu" && (
              <div className="space-y-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleNoRestock}
                  disabled={saving}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  No hacer restock
                </Button>
                <Button
                  className="w-full justify-start"
                  onClick={handleReplace}
                  disabled={saving || !canReplace}
                  title={
                    !canReplace
                      ? "No se puede reemplazar porque el movimiento no tiene costo reservado válido."
                      : undefined
                  }
                >
                  <Repeat className="w-4 h-4 mr-2" />
                  Reemplazar por otra prenda
                </Button>
                {!canReplace && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    No se puede reemplazar porque el movimiento no tiene costo reservado válido.
                  </p>
                )}
              </div>
            )}

            {mode === "picker" && (
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
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handlePickCandidate(c)}
                      disabled={saving}
                      className={`w-full text-left p-2 hover:bg-muted border-b text-xs disabled:opacity-50 ${
                        pickedCore?.id === c.id ? "bg-primary/10 font-semibold" : ""
                      }`}
                    >
                      <div className="font-medium">
                        {c.core_sku} · {c.name}
                      </div>
                      <div className="text-muted-foreground">
                        {c.woo_product_id ? `Woo #${c.woo_product_id}` : "sin Woo"}
                      </div>
                    </button>
                  ))}
                  {candidates.length === 0 && (
                    <p className="p-3 text-xs text-muted-foreground">Sin resultados</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Sólo productos activos, restockeables y ruta fábrica interna
                </Badge>
              </div>
            )}
          </div>

          <DialogFooter>
            {mode === "picker" ? (
              <Button variant="ghost" onClick={() => setMode("menu")} disabled={saving}>
                Volver
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mode === "apply" && bridgeEvent && (
        <ReplacementApplicationDialog
          event={bridgeEvent as any}
          open={true}
          onOpenChange={handleApplyClose}
        />
      )}
    </>
  );
}
