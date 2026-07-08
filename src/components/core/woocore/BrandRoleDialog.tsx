import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logStrategyDecision, upsertPolicy } from "@/hooks/useWooCoreMap";
import { BRAND_ROLE_LABELS } from "@/lib/coreReplenishment";

interface Props { open: boolean; onClose: () => void; onDone: () => void; ctx: any; }

export function BrandRoleDialog({ open, onClose, onDone, ctx }: Props) {
  const m = ctx.map; const p = ctx.policy;
  const [role, setRole] = useState<string>(p?.brand_role ?? "regular");
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
        brand_role: role,
        updated_by: uid,
      };
      const { previous } = await upsertPolicy(patch);
      await logStrategyDecision({
        woo_product_id: m.woo_product_id,
        core_product_id: ctx.core?.id ?? null,
        decision_type: "set_brand_role",
        previous_values: { brand_role: previous?.brand_role ?? null },
        new_values: { brand_role: role },
      });
      toast({ title: "Rol guardado" });
      onDone(); onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rol de marca</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Rol</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(BRAND_ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
