import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logStrategyDecision, upsertPolicy, type CoreProductLite } from "@/hooks/useWooCoreMap";
import { REPLACEMENT_BEHAVIOR_LABELS } from "@/lib/coreReplenishment";

interface Props { open: boolean; onClose: () => void; onDone: () => void; ctx: any; coreProducts: CoreProductLite[]; }

export function ReplacementPickerDialog({ open, onClose, onDone, ctx, coreProducts }: Props) {
  const m = ctx.map; const p = ctx.policy;
  const [search, setSearch] = useState("");
  const [replacementId, setReplacementId] = useState<string>(p?.replacement_product_id ?? "");
  const [behavior, setBehavior] = useState(p?.replacement_behavior ?? "suggest_only");
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    const s = search.trim().toLowerCase();
    return coreProducts
      .filter(c => c.id !== ctx.core?.id)
      .filter(c => !s || c.core_sku.toLowerCase().includes(s) || c.name.toLowerCase().includes(s))
      .slice(0, 100);
  }, [coreProducts, search, ctx.core?.id]);

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
        replacement_product_id: replacementId || null,
        replacement_behavior: behavior,
        updated_by: uid,
      };
      const { previous } = await upsertPolicy(patch);
      await logStrategyDecision({
        woo_product_id: m.woo_product_id,
        core_product_id: ctx.core?.id ?? null,
        decision_type: "set_replacement",
        previous_values: { replacement_product_id: previous?.replacement_product_id ?? null, replacement_behavior: previous?.replacement_behavior ?? null },
        new_values: { replacement_product_id: replacementId || null, replacement_behavior: behavior },
      });
      toast({ title: "Reemplazo guardado" });
      onDone(); onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Producto reemplazo</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div><b>Saliente:</b> {ctx.core?.name ?? m.woo_product_name}</div>
          <Input placeholder="Buscar reemplazo…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="max-h-60 overflow-y-auto border rounded">
            {candidates.map(c => (
              <button
                key={c.id}
                onClick={() => setReplacementId(c.id)}
                className={`w-full text-left p-2 hover:bg-muted border-b text-xs ${replacementId === c.id ? "bg-primary/10 font-semibold" : ""}`}
              >
                {c.core_sku} · {c.name}
              </button>
            ))}
            {candidates.length === 0 && <p className="p-3 text-xs text-muted-foreground">Sin resultados</p>}
          </div>
          <div>
            <Label>Comportamiento</Label>
            <Select value={behavior} onValueChange={setBehavior}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REPLACEMENT_BEHAVIOR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">En esta fase se guarda la decisión. No se conecta automáticamente a generación de OP/necesidades.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
