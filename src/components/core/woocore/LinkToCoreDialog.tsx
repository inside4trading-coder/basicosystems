import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logStrategyDecision, type CoreProductLite } from "@/hooks/useWooCoreMap";

interface Props { open: boolean; onClose: () => void; onDone: () => void; ctx: any; coreProducts: CoreProductLite[]; }

export function LinkToCoreDialog({ open, onClose, onDone, ctx, coreProducts }: Props) {
  const [coreId, setCoreId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!coreId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("core_woo_product_map")
        .update({ core_product_id: coreId, mapping_status: "mapped" })
        .eq("id", ctx.map.id);
      if (error) throw error;
      await logStrategyDecision({
        woo_product_id: ctx.map.woo_product_id,
        core_product_id: coreId,
        decision_type: "map_to_core",
        previous_values: { core_product_id: ctx.map.core_product_id },
        new_values: { core_product_id: coreId },
      });
      toast({ title: "Vinculado" });
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
        <DialogHeader><DialogTitle>Vincular a producto Core existente</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <div><b>Woo:</b> {ctx.map.woo_product_name} <span className="text-muted-foreground">#{ctx.map.woo_product_id}</span></div>
          <Label>Producto Core</Label>
          <Select value={coreId} onValueChange={setCoreId}>
            <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
            <SelectContent>
              {coreProducts.map(c => <SelectItem key={c.id} value={c.id}>{c.core_sku} · {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!coreId || saving}>Vincular</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
