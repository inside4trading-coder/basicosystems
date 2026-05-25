import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useCoreSettings, useUpdateCoreSettings, type CoreSettings } from "@/hooks/useCoreSettings";
import { toast } from "@/hooks/use-toast";

const flags: { key: keyof CoreSettings; label: string }[] = [
  { key: "qr_include_qr", label: "Incluir QR" },
  { key: "qr_include_human_code", label: "Incluir código legible" },
  { key: "qr_include_sku", label: "Incluir SKU" },
  { key: "qr_include_size", label: "Incluir talla" },
  { key: "qr_include_production_order", label: "Incluir orden de producción" },
  { key: "qr_include_unit_number", label: "Incluir número individual de prenda" },
];

export default function QrLabelTab() {
  const { data: settings, isLoading } = useCoreSettings();
  const update = useUpdateCoreSettings();
  const [form, setForm] = useState<CoreSettings | null>(null);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  if (isLoading || !form) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const onSave = async () => {
    if (!settings || !form) return;
    const patch: Partial<CoreSettings> = {
      qr_width_mm: form.qr_width_mm,
      qr_height_mm: form.qr_height_mm,
      qr_include_qr: form.qr_include_qr,
      qr_include_human_code: form.qr_include_human_code,
      qr_include_sku: form.qr_include_sku,
      qr_include_size: form.qr_include_size,
      qr_include_production_order: form.qr_include_production_order,
      qr_include_unit_number: form.qr_include_unit_number,
    };
    try {
      await update.mutateAsync({ id: settings.id, patch, previous: settings });
      toast({ title: "Configuración de etiqueta guardada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 rounded-2xl space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Ancho de etiqueta (mm)</Label>
          <Input type="number" step="0.1" value={form.qr_width_mm} onChange={(e) => setForm({ ...form, qr_width_mm: parseFloat(e.target.value || "0") })} />
        </div>
        <div className="space-y-2">
          <Label>Alto de etiqueta (mm)</Label>
          <Input type="number" step="0.1" value={form.qr_height_mm} onChange={(e) => setForm({ ...form, qr_height_mm: parseFloat(e.target.value || "0") })} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {flags.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-border/60">
            <Label className="text-sm">{label}</Label>
            <Switch
              checked={Boolean(form[key])}
              onCheckedChange={(v) => setForm({ ...form, [key]: v } as CoreSettings)}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={update.isPending} variant="brand">
          {update.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </Card>
  );
}
