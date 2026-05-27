import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCoreSettings, useUpdateCoreSettings, type CoreSettings } from "@/hooks/useCoreSettings";
import { useCoreLocations } from "@/hooks/useCoreLocations";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

export default function GeneralTab() {
  const { data: settings, isLoading } = useCoreSettings();
  const { data: locations = [] } = useCoreLocations();
  const update = useUpdateCoreSettings();
  const [form, setForm] = useState<CoreSettings | null>(null);
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [wooMode, setWooMode] = useState<string>("dry_run");
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
    (async () => {
      const { data } = await supabase.from("core_settings").select("woo_write_mode").limit(1).maybeSingle();
      setWooMode((data as any)?.woo_write_mode ?? "dry_run");
    })();
  }, [settings]);

  if (isLoading || !form) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const set = <K extends keyof CoreSettings>(k: K, v: CoreSettings[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const onSave = async () => {
    if (!settings || !form) return;
    const patch: Partial<CoreSettings> = {
      module_name: form.module_name,
      description: form.description,
      status: form.status,
      main_location_id: form.main_location_id,
      allow_stock_in_transit: form.allow_stock_in_transit,
      update_woocommerce_inventory: form.update_woocommerce_inventory,
      multi_location_mode: form.multi_location_mode,
    };
    try {
      await update.mutateAsync({ id: settings.id, patch, previous: settings });
      toast({ title: "Configuración guardada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 rounded-2xl space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Nombre del módulo</Label>
          <Input value={form.module_name} onChange={(e) => set("module_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Estado del módulo</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descripción</Label>
        <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Sede principal actual</Label>
          <Select
            value={form.main_location_id ?? ""}
            onValueChange={(v) => set("main_location_id", v)}
          >
            <SelectTrigger><SelectValue placeholder="Selecciona sede" /></SelectTrigger>
            <SelectContent>
              {locations.filter(l => l.type === "sede").map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Modo multi-sede futuro</Label>
          <Select value={form.multi_location_mode} onValueChange={(v) => set("multi_location_mode", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="preparado">Preparado</SelectItem>
              <SelectItem value="no_activo">No activo</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex items-center justify-between p-4 rounded-lg border border-border/60">
          <div>
            <Label className="text-base">Permitir stock en tránsito</Label>
            <p className="text-xs text-muted-foreground mt-1">Habilita inventario en movimiento entre sedes.</p>
          </div>
          <Switch checked={form.allow_stock_in_transit} onCheckedChange={(v) => set("allow_stock_in_transit", v)} />
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border/60">
          <div>
            <Label className="text-base">Actualizar inventario WooCommerce</Label>
            <p className="text-xs text-muted-foreground mt-1">Sincroniza stock desde BASICO CORE hacia Woo.</p>
          </div>
          <Switch checked={form.update_woocommerce_inventory} onCheckedChange={(v) => set("update_woocommerce_inventory", v)} />
        </div>
      </div>

      <div className="space-y-2 p-4 rounded-lg border border-border/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Label className="text-base">Modo de escritura WooCommerce (stock)</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Controla cómo BASICO CORE actualiza stock en WooCommerce. Solo admin.
            </p>
          </div>
          <Select
            value={wooMode}
            onValueChange={async (v) => {
              if (!isAdmin || !settings) return;
              if (v === "enabled") {
                toast({ title: "No permitido", description: "enabled aún no está habilitado.", variant: "destructive" });
                return;
              }
              setSavingMode(true);
              const { error } = await supabase
                .from("core_settings")
                .update({ woo_write_mode: v })
                .eq("id", settings.id);
              setSavingMode(false);
              if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
              } else {
                setWooMode(v);
                toast({ title: "Modo actualizado", description: `woo_write_mode = ${v}` });
              }
            }}
            disabled={!isAdmin || savingMode}
          >
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">off — no escribir</SelectItem>
              <SelectItem value="dry_run">dry_run — solo preview</SelectItem>
              <SelectItem value="manual_confirm">manual_confirm — confirmación manual</SelectItem>
              <SelectItem value="enabled" disabled>enabled — (no disponible)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {wooMode === "manual_confirm" && (
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-500/10 border border-amber-300/40 rounded p-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>
              <strong>manual_confirm</strong> permite escribir stock real en WooCommerce solo después de
              confirmación manual. No activa escritura automática.
            </span>
          </div>
        )}
        {!isAdmin && (
          <p className="text-xs text-muted-foreground">Solo un admin puede cambiar este valor.</p>
        )}
      </div>



      <div className="flex justify-end">
        <Button onClick={onSave} disabled={update.isPending} variant="brand">
          {update.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </Card>
  );
}
