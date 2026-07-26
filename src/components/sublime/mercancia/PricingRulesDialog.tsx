import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useSublimePricingRules, usePricingRulesMutations, type SublimePricingRule } from "@/hooks/useSublimeMerch";
import { slugifyProductType } from "@/lib/sublimeMerch";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PricingRulesDialog({ open, onOpenChange }: Props) {
  const { data: rules = [], isLoading } = useSublimePricingRules();
  const { createRule, updateRule } = usePricingRulesMutations();
  const [newLabel, setNewLabel] = useState("");
  const [newPct, setNewPct] = useState<number>(100);

  const create = async () => {
    if (!newLabel.trim()) return toast.error("Nombre requerido.");
    if (newPct < 0) return toast.error("Porcentaje no puede ser negativo.");
    try {
      await createRule.mutateAsync({
        label: newLabel.trim(),
        profit_percentage: newPct,
        product_type: slugifyProductType(newLabel),
      });
      toast.success("Tipo creado.");
      setNewLabel("");
      setNewPct(100);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al crear.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar precios</DialogTitle>
          <DialogDescription>
            Define tipos de artículo y el % de ganancia. El IVA 16% se aplica sobre el PVP sugerido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto pr-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tipos aún.</p>
          ) : (
            rules.map((r) => <RuleRow key={r.id} rule={r} onSave={(patch) => updateRule.mutateAsync({ id: r.id, patch })} />)
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm">Nuevo tipo</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Ej. Bolsos de diseñador"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              step="0.01"
              min={0}
              value={newPct}
              onChange={(e) => setNewPct(Number(e.target.value))}
              className="w-24"
              title="% ganancia"
            />
            <Button onClick={create} disabled={createRule.isPending}>Agregar</Button>
          </div>
          {newLabel.trim() ? (
            <p className="text-[11px] text-muted-foreground">
              Slug: <code>{slugifyProductType(newLabel)}</code>
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleRow({
  rule,
  onSave,
}: {
  rule: SublimePricingRule;
  onSave: (patch: Partial<Pick<SublimePricingRule, "label" | "profit_percentage" | "active">>) => Promise<any>;
}) {
  const [label, setLabel] = useState(rule.label);
  const [pct, setPct] = useState<number>(Number(rule.profit_percentage ?? 0));
  const [saving, setSaving] = useState(false);
  const dirty = label !== rule.label || pct !== Number(rule.profit_percentage ?? 0);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ label: label.trim(), profit_percentage: pct });
      toast.success("Actualizado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (v: boolean) => {
    try {
      await onSave({ active: v });
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 p-2">
      <Input value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1" />
      <Input
        type="number"
        step="0.01"
        min={0}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        className="w-20"
      />
      <span className="text-xs text-muted-foreground">%</span>
      <Switch checked={rule.active} onCheckedChange={toggle} />
      <Button size="sm" onClick={save} disabled={!dirty || saving}>
        Guardar
      </Button>
    </div>
  );
}
