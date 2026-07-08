import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logStrategyDecision } from "@/hooks/useWooCoreMap";

interface Props { open: boolean; onClose: () => void; onDone: () => void; ctx: any; }

export function CreateCoreFromWooDialog({ open, onClose, onDone, ctx }: Props) {
  const m = ctx.map;
  const [name, setName] = useState<string>(m.woo_product_name ?? "");
  const [sku, setSku] = useState<string>(m.woo_product_sku ?? `WOO-${m.woo_product_id}`);
  const [manualCost, setManualCost] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const cost = manualCost ? Number(manualCost) : 0;
      const insertPayload: any = {
        core_sku: sku,
        name,
        woo_product_id: m.woo_product_id,
        woo_product_name: m.woo_product_name,
        woo_sku: m.woo_product_sku,
        woo_permalink: m.woo_permalink,
        woo_status: m.woo_status,
        unit_cost: cost,
        currency: "USD",
        commercial_status: "active",
        is_restockable: true,
        suggested_fabrication_fund: 0,
        sku_source: "manual",
        sync_status: "pending",
        product_priority: "normal",
        replenishment_mode: "internal_factory",
        manual_unit_cost_usd: manualCost ? Number(manualCost) : null,
        created_by: uid,
        updated_by: uid,
      };
      const { data: newProd, error } = await supabase.from("core_products").insert(insertPayload).select("id").maybeSingle();
      if (error) throw error;
      const coreId = newProd?.id;
      await supabase.from("core_woo_product_map")
        .update({ core_product_id: coreId, mapping_status: "mapped" })
        .eq("id", m.id);
      // Initial policy
      await supabase.from("core_replenishment_policies").insert({
        woo_product_id: m.woo_product_id,
        core_product_id: coreId,
        product_name_snapshot: name,
        sku_snapshot: sku,
        brand_role: "regular",
        lifecycle_status: "active",
        replenishment_route: "internal_factory",
        restock_enabled: true,
        manual_unit_cost_usd: manualCost ? Number(manualCost) : null,
        created_by: uid,
        updated_by: uid,
      });
      await logStrategyDecision({
        woo_product_id: m.woo_product_id,
        core_product_id: coreId,
        decision_type: "create_core_from_woo",
        new_values: { name, sku, manual_unit_cost_usd: manualCost ? Number(manualCost) : null },
      });
      toast({ title: "Producto Core creado" });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear producto Core desde Woo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>SKU Core</Label><Input value={sku} onChange={e => setSku(e.target.value)} /></div>
          <div>
            <Label>Costo manual USD (opcional)</Label>
            <Input type="number" step="0.01" value={manualCost} onChange={e => setManualCost(e.target.value)} placeholder="Deja vacío para 0 con advertencia" />
            <p className="text-[10px] text-muted-foreground mt-1">Sirve como fallback estratégico. No aplica automáticamente a partidas/OP en esta fase.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!name || !sku || saving}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
