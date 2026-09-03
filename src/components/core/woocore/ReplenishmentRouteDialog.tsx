import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logStrategyDecision, upsertPolicy } from "@/hooks/useWooCoreMap";
import { ROUTE_LABELS } from "@/lib/coreReplenishment";

interface Props { open: boolean; onClose: () => void; onDone: () => void; ctx: any; }

export function ReplenishmentRouteDialog({ open, onClose, onDone, ctx }: Props) {
  const m = ctx.map; const p = ctx.policy;
  const [route, setRoute] = useState<string>(p?.replenishment_route ?? "internal_factory");
  const [supplier, setSupplier] = useState(p?.external_supplier_name ?? "");
  const [sCost, setSCost] = useState(String(p?.external_supplier_unit_cost_usd ?? ""));
  const [sMin, setSMin] = useState(String(p?.external_supplier_min_qty ?? ""));
  const [sLead, setSLead] = useState(String(p?.external_supplier_lead_time_days ?? ""));
  const [sNotes, setSNotes] = useState(p?.external_supplier_notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const patch: any = {
        woo_product_id: m.woo_product_id,
        core_product_id: ctx.core?.id ?? null,
        product_name_snapshot: m.woo_product_name,
        sku_snapshot: m.woo_product_sku,
        replenishment_route: route,
        // La ruta de reposición es independiente del estado comercial.
        restock_enabled: ["internal_factory", "external_supplier", "manual_cost_only"].includes(route),
        external_supplier_name: route === "external_supplier" ? supplier || null : null,
        external_supplier_unit_cost_usd: route === "external_supplier" && sCost ? Number(sCost) : null,
        external_supplier_min_qty: route === "external_supplier" && sMin ? Number(sMin) : null,
        external_supplier_lead_time_days: route === "external_supplier" && sLead ? Number(sLead) : null,
        external_supplier_notes: route === "external_supplier" ? sNotes || null : null,
        updated_by: uid,
      };
      const { previous } = await upsertPolicy(patch);
      await logStrategyDecision({
        woo_product_id: m.woo_product_id,
        core_product_id: ctx.core?.id ?? null,
        decision_type: route === "external_supplier" ? "set_external_supplier" : "set_replenishment_route",
        previous_values: { replenishment_route: previous?.replenishment_route ?? null },
        new_values: patch,
      });
      toast({ title: "Ruta guardada" });
      onDone(); onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ruta de reposición</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Ruta</Label>
            <Select value={route} onValueChange={setRoute}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROUTE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {route === "external_supplier" && (
            <div className="space-y-2 border rounded p-3 bg-muted/30">
              <div><Label>Proveedor</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Costo USD</Label><Input type="number" step="0.01" value={sCost} onChange={e => setSCost(e.target.value)} /></div>
                <div><Label>Mín. compra</Label><Input type="number" value={sMin} onChange={e => setSMin(e.target.value)} /></div>
                <div><Label>Lead (días)</Label><Input type="number" value={sLead} onChange={e => setSLead(e.target.value)} /></div>
              </div>
              <div><Label>Notas</Label><Textarea rows={2} value={sNotes} onChange={e => setSNotes(e.target.value)} /></div>
              <p className="text-[10px] text-muted-foreground">En esta fase solo se guarda la decisión. No genera compras ni OP.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
