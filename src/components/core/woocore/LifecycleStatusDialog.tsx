import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logStrategyDecision, upsertPolicy } from "@/hooks/useWooCoreMap";
import { LIFECYCLE_LABELS } from "@/lib/coreReplenishment";

interface Props { open: boolean; onClose: () => void; onDone: () => void; ctx: any; }

export function LifecycleStatusDialog({ open, onClose, onDone, ctx }: Props) {
  const m = ctx.map; const p = ctx.policy;
  const [status, setStatus] = useState<string>(p?.lifecycle_status ?? "active");
  const [reason, setReason] = useState(p?.decision_reason ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const restock = status === "active";
      const patch: any = {
        woo_product_id: m.woo_product_id,
        core_product_id: ctx.core?.id ?? null,
        product_name_snapshot: m.woo_product_name,
        sku_snapshot: m.woo_product_sku,
        lifecycle_status: status,
        restock_enabled: restock,
        decision_reason: reason || null,
        last_reviewed_at: new Date().toISOString(),
        reviewed_by: uid,
        updated_by: uid,
      };
      const { previous } = await upsertPolicy(patch);
      await logStrategyDecision({
        woo_product_id: m.woo_product_id,
        core_product_id: ctx.core?.id ?? null,
        decision_type: "set_lifecycle_status",
        previous_values: { lifecycle_status: previous?.lifecycle_status ?? null },
        new_values: { lifecycle_status: status, restock_enabled: restock },
        reason: reason || null,
      });
      toast({ title: "Estado guardado" });
      onDone(); onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Estado comercial / Lifecycle</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LIFECYCLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Razón / nota</Label><Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} /></div>
          {(status === "no_restock" || status === "exit") && (
            <p className="text-[10px] text-muted-foreground">Recuerda elegir un producto reemplazo desde la acción <b>Reemplazo</b>.</p>
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
