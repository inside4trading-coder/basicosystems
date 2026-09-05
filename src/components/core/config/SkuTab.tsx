import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCoreSettings, useUpdateCoreSettings, type CoreSettings } from "@/hooks/useCoreSettings";
import { previewSku } from "@/lib/coreSku";
import { toast } from "@/hooks/use-toast";
import { Eye } from "lucide-react";

export default function SkuTab() {
  const { data: settings, isLoading } = useCoreSettings();
  const update = useUpdateCoreSettings();
  const [form, setForm] = useState<CoreSettings | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  if (isLoading || !form) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const onSave = async () => {
    if (!settings || !form) return;
    try {
      await update.mutateAsync({
        id: settings.id,
        patch: {
          sku_prefix: form.sku_prefix,
          sku_digits: form.sku_digits,
          sku_last_number: form.sku_last_number,
        },
        previous: settings,
      });
      toast({ title: "Configuración SKU guardada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const preview = previewSku(form.sku_prefix, form.sku_digits, form.sku_last_number);

  return (
    <Card className="p-6 rounded-2xl space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="space-y-2">
          <Label>Prefijo SKU</Label>
          <Input value={form.sku_prefix} onChange={(e) => setForm({ ...form, sku_prefix: e.target.value.toUpperCase() })} />
        </div>
        <div className="space-y-2">
          <Label>Cantidad de dígitos</Label>
          <Input type="number" min={1} max={12} value={form.sku_digits} onChange={(e) => setForm({ ...form, sku_digits: parseInt(e.target.value || "0", 10) })} />
        </div>
        <div className="space-y-2">
          <Label>Último número usado</Label>
          <Input type="number" min={0} value={form.sku_last_number} onChange={(e) => setForm({ ...form, sku_last_number: parseInt(e.target.value || "0", 10) })} />
        </div>
      </div>

      <div className="p-5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Próximo SKU</p>
          <p className="num text-2xl font-black font-mono mt-1">
            {showPreview ? preview : "•".repeat(form.sku_prefix.length + form.sku_digits)}
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowPreview((s) => !s)}>
          <Eye className="h-4 w-4 mr-2" />
          {showPreview ? "Ocultar" : "Previsualizar"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        El SKU se genera secuencialmente al crear productos. Formato actual: <code>{form.sku_prefix}{"0".repeat(form.sku_digits - 1)}1</code>.
      </p>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={update.isPending} variant="brand">
          {update.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </Card>
  );
}
