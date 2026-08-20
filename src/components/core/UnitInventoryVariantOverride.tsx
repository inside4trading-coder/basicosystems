// Corrección de variante para inventario (solo admin/partner).
// Aditivo: NO modifica core_variant_id, QR, procesos, work entries ni nómina.
// Guardar la corrección NO escribe en WooCommerce.
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { AlertTriangle, Loader2, Palette, Save, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logCoreAudit } from "@/lib/coreAudit";

export type OverrideUnit = {
  id: string;
  unit_code: string;
  status: string;
  production_order_id: string;
  production_order_line_id?: string | null;
  core_product_id: string | null;
  core_variant_id: string | null;
  sku?: string | null;
  variant_sku?: string | null;
  variant_label?: string | null;
  size?: string | null;
  inventory_variant_override_enabled?: boolean | null;
  inventory_override_variant_id?: string | null;
  inventory_override_variant_sku?: string | null;
  inventory_override_color?: string | null;
  inventory_override_size?: string | null;
  inventory_override_woo_variation_id?: number | null;
  inventory_override_reason?: string | null;
  inventory_override_by?: string | null;
  inventory_override_at?: string | null;
};

type VariantRow = {
  id: string;
  size: string | null;
  color: string | null;
  variant_label: string | null;
  variant_sku: string | null;
  woo_sku: string | null;
  woo_variation_id: number | null;
  status: string | null;
};

function variantText(v: VariantRow | null | undefined): string {
  if (!v) return "—";
  const base = v.variant_label || [v.size, v.color].filter(Boolean).join(" / ") || v.id.slice(0, 8);
  const sku = v.variant_sku || v.woo_sku;
  return sku ? `${base} · ${sku}` : base;
}

export function UnitInventoryVariantOverride({
  unit,
  canEdit,
  onSaved,
}: {
  unit: OverrideUnit;
  canEdit: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(!!unit.inventory_variant_override_enabled);
  const [selectedId, setSelectedId] = useState<string>(unit.inventory_override_variant_id ?? "");
  const [reason, setReason] = useState<string>(unit.inventory_override_reason ?? "");
  const [orderCancelled, setOrderCancelled] = useState(false);
  const [byLabel, setByLabel] = useState<string | null>(null);

  const active = !!unit.inventory_variant_override_enabled && !!unit.inventory_override_variant_id;
  const enteredInventory = unit.status === "entered_inventory";
  const unitCancelled = unit.status === "cancelled" || unit.status === "lost";

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [{ data: vs }, { data: ord }, { data: prof }] = await Promise.all([
        unit.core_product_id
          ? supabase
            .from("core_product_variants")
            .select("id, size, color, variant_label, variant_sku, woo_sku, woo_variation_id, status")
            .eq("core_product_id", unit.core_product_id)
            .order("size")
          : Promise.resolve({ data: [] } as any),
        supabase
          .from("core_production_orders")
          .select("status")
          .eq("id", unit.production_order_id)
          .maybeSingle(),
        unit.inventory_override_by
          ? supabase.from("profiles").select("full_name, email").eq("id", unit.inventory_override_by).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (cancel) return;
      const rows = ((vs as any[]) ?? []).filter((v) => !v.status || v.status === "active") as VariantRow[];
      setVariants(rows);
      setOrderCancelled(((ord as any)?.status ?? "") === "cancelled");
      setByLabel(((prof as any)?.full_name || (prof as any)?.email) ?? null);
      setEnabled(!!unit.inventory_variant_override_enabled);
      setSelectedId(unit.inventory_override_variant_id ?? "");
      setReason(unit.inventory_override_reason ?? "");
      setLoading(false);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id, unit.inventory_override_variant_id, unit.inventory_variant_override_enabled]);

  const originalVariant = useMemo(
    () => variants.find((v) => v.id === unit.core_variant_id) ?? null,
    [variants, unit.core_variant_id],
  );
  const overrideVariant = useMemo(
    () => variants.find((v) => v.id === unit.inventory_override_variant_id) ?? null,
    [variants, unit.inventory_override_variant_id],
  );
  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedId) ?? null,
    [variants, selectedId],
  );

  const originalText = originalVariant
    ? variantText(originalVariant)
    : (unit.variant_label || [unit.size, unit.variant_sku].filter(Boolean).join(" / ") || "—");

  const blockedReason = enteredInventory
    ? "Esta unidad ya ingresó a inventario. Debe corregirse mediante ajuste de inventario."
    : unitCancelled
      ? "Unidad cancelada o perdida: no admite corrección de variante."
      : orderCancelled
        ? "La orden de producción está cancelada: no admite corrección de variante."
        : variants.length === 0
          ? "El producto no tiene variantes disponibles."
          : null;

  async function logEvent(eventType: string, payload: Record<string, unknown>) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("core_production_scan_events").insert({
      production_unit_id: unit.id,
      production_order_id: unit.production_order_id,
      production_order_line_id: unit.production_order_line_id ?? null,
      core_product_id: unit.core_product_id,
      core_variant_id: unit.core_variant_id,
      unit_code: unit.unit_code,
      sku: unit.sku ?? null,
      variant_sku: unit.variant_sku ?? null,
      variant_label: unit.variant_label ?? null,
      size: unit.size ?? null,
      process_name: "Corrección de variante para inventario",
      event_type: eventType,
      status: "valid",
      source: "admin",
      scanned_by_user_id: user?.id ?? null,
      notes: JSON.stringify({ ...payload, no_woo_write: true }),
    } as any);
    await logCoreAudit({
      table: "core_production_units",
      recordId: unit.id,
      action: eventType,
      newValue: { unit: unit.unit_code, ...payload },
    });
  }

  async function handleSave() {
    if (!selectedVariant) {
      toast({ title: "Selecciona la variante real", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "El motivo es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("core_production_units")
        .update({
          inventory_variant_override_enabled: true,
          inventory_override_variant_id: selectedVariant.id,
          inventory_override_variant_sku: selectedVariant.variant_sku ?? selectedVariant.woo_sku ?? null,
          inventory_override_color: selectedVariant.color ?? null,
          inventory_override_size: selectedVariant.size ?? null,
          inventory_override_woo_variation_id: selectedVariant.woo_variation_id ?? null,
          inventory_override_reason: reason.trim(),
          inventory_override_by: user?.id ?? null,
          inventory_override_at: new Date().toISOString(),
        } as any)
        .eq("id", unit.id);
      if (error) throw error;
      await logEvent(active ? "inventory_variant_override_updated" : "inventory_variant_override_set", {
        message: "Variante de inventario corregida manualmente.",
        original_variant: originalText,
        original_variant_id: unit.core_variant_id,
        override_variant: variantText(selectedVariant),
        override_variant_id: selectedVariant.id,
        override_woo_variation_id: selectedVariant.woo_variation_id,
        reason: reason.trim(),
      });
      toast({ title: "Corrección guardada", description: `Inventario entrará como ${variantText(selectedVariant)}.` });
      await onSaved();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("core_production_units")
        .update({
          inventory_variant_override_enabled: false,
          inventory_override_variant_id: null,
          inventory_override_variant_sku: null,
          inventory_override_color: null,
          inventory_override_size: null,
          inventory_override_woo_variation_id: null,
          inventory_override_reason: null,
          inventory_override_by: null,
          inventory_override_at: null,
        } as any)
        .eq("id", unit.id);
      if (error) throw error;
      await logEvent("inventory_variant_override_removed", {
        message: "Corrección de variante para inventario eliminada.",
        original_variant: originalText,
        removed_variant: overrideVariant ? variantText(overrideVariant) : unit.inventory_override_variant_sku,
      });
      setEnabled(false);
      setSelectedId("");
      setReason("");
      toast({ title: "Corrección eliminada", description: "Inventario usará la variante original." });
      await onSaved();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Palette className="h-4 w-4" /> Corrección de variante para inventario
        </p>
        {active && <Badge variant="destructive" className="text-[10px]">Variante corregida</Badge>}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : (
        <>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Variante original: </span>
              <span className="font-medium">{originalText}</span>
            </p>
            {active && (
              <p>
                <span className="text-muted-foreground">Variante para inventario: </span>
                <span className="font-medium">
                  {overrideVariant
                    ? variantText(overrideVariant)
                    : [unit.inventory_override_size, unit.inventory_override_color].filter(Boolean).join(" / ")}
                </span>
              </p>
            )}
          </div>

          {active && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Motivo: {unit.inventory_override_reason || "—"}</p>
              <p>
                Corregido por: {byLabel ?? "—"}
                {unit.inventory_override_at && ` · ${new Date(unit.inventory_override_at).toLocaleString()}`}
              </p>
            </div>
          )}

          {!canEdit ? (
            <p className="text-xs text-muted-foreground">
              Solo un administrador o socio puede corregir la variante de inventario.
            </p>
          ) : blockedReason ? (
            <p className="text-xs text-amber-700 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5" /> {blockedReason}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Switch
                  id="variant-override"
                  checked={enabled}
                  onCheckedChange={(v) => {
                    setEnabled(v);
                    if (!v && active) return;
                  }}
                />
                <Label htmlFor="variant-override" className="text-sm">
                  La variante física de esta prenda es diferente
                </Label>
              </div>

              {enabled && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Seleccionar variante real para inventario</Label>
                    <Select value={selectedId} onValueChange={setSelectedId}>
                      <SelectTrigger><SelectValue placeholder="Variante real…" /></SelectTrigger>
                      <SelectContent>
                        {variants.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {variantText(v)}{v.id === unit.core_variant_id ? " (original)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Motivo (obligatorio)</Label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                      placeholder="Ej: Error de color en producción. La prenda salió beige claro, no gris."
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={handleSave} disabled={saving || !selectedId || !reason.trim()}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar corrección
                    </Button>
                    {active && (
                      <Button variant="outline" onClick={handleRemove} disabled={saving}>
                        <Undo2 className="h-4 w-4" /> Quitar corrección
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
