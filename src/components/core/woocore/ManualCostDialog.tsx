import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logStrategyDecision, upsertPolicy } from "@/hooks/useWooCoreMap";

interface Props { open: boolean; onClose: () => void; onDone: () => void; ctx: any; }

export function ManualCostDialog({ open, onClose, onDone, ctx }: Props) {
  const m = ctx.map; const p = ctx.policy;
  const [cost, setCost] = useState<string>(String(p?.manual_unit_cost_usd ?? ""));
  const [reason, setReason] = useState<string>(p?.manual_cost_reason ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const numeric = cost ? Number(cost) : null;
      const { previous } = await upsertPolicy({
        woo_product_id: m.woo_product_id,
        core_product_id: ctx.core?.id ?? null,
        product_name_snapshot: m.woo_product_name,
        sku_snapshot: m.woo_product_sku,
        manual_unit_cost_usd: numeric,
        manual_cost_reason: reason || null,
        manual_cost_updated_at: new Date().toISOString(),
        manual_cost_updated_by: uid,
        updated_by: uid,
      } as any);
      // Mirror to core_products for compatibility
      if (ctx.core?.id) {
        await supabase.from("core_products").update({
          manual_unit_cost_usd: numeric,
          manual_cost_reason: reason || null,
        }).eq("id", ctx.core.id);
      }
      await logStrategyDecision({
        woo_product_id: m.woo_product_id,
        core_product_id: ctx.core?.id ?? null,
        decision_type: "set_manual_cost",
        previous_values: { manual_unit_cost_usd: previous?.manual_unit_cost_usd ?? null, manual_cost_reason: previous?.manual_cost_reason ?? null },
        new_values: { manual_unit_cost_usd: numeric, manual_cost_reason: reason || null },
      });
      toast({ title: "Costo manual guardado" });
      onDone(); onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Costo manual fallback (USD)</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">Estratégico y visual. No aplica automáticamente a partidas/OP en esta fase.</p>
          <div><Label>Costo USD</Label><Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></div>
          <div><Label>Razón / nota</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
