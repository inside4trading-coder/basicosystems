// BLOQUE 13 — Sección "Inventario" embebida en Escaneo.
// Usa el mismo QR / misma unidad. No crea nada nuevo.
// Solo invoca core-woo-stock-write (modo según core_settings.woo_write_mode).
// En dry_run NO escribe en WooCommerce y NO cambia unidad a entered_inventory.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Package, AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Unit = {
  id: string;
  unit_code: string;
  status: string;
  core_product_id: string | null;
  core_variant_id: string | null;
};

type UnitProcess = { status: string };

type Props = {
  unit: Unit;
  processes: UnitProcess[];
};

export function UnitInventorySection({ unit, processes }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<string>("dry_run");
  const [wooProductId, setWooProductId] = useState<number | null>(null);
  const [wooVariationId, setWooVariationId] = useState<number | null>(null);
  const [hasVariants, setHasVariants] = useState<boolean>(false);
  const [latestLog, setLatestLog] = useState<any | null>(null);
  const [activeLog, setActiveLog] = useState<any | null>(null); // confirmed/success
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function reload() {
    setLoading(true);
    const [{ data: settings }, productResp, variantResp, { data: logs }] = await Promise.all([
      supabase.from("core_settings").select("woo_write_mode").limit(1).maybeSingle(),
      unit.core_product_id
        ? supabase.from("core_products").select("woo_product_id, has_variants").eq("id", unit.core_product_id).maybeSingle()
        : Promise.resolve({ data: null }),
      unit.core_variant_id
        ? supabase.from("core_product_variants").select("woo_variation_id").eq("id", unit.core_variant_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("core_woo_write_logs")
        .select("*")
        .eq("production_unit_id", unit.id)
        .eq("action_type", "stock_increase")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setMode((settings as any)?.woo_write_mode ?? "dry_run");
    setWooProductId((productResp as any)?.data?.woo_product_id ?? null);
    setHasVariants(!!(productResp as any)?.data?.has_variants);
    setWooVariationId((variantResp as any)?.data?.woo_variation_id ?? null);
    const logsArr = (logs as any[]) || [];
    setLatestLog(logsArr[0] ?? null);
    setActiveLog(logsArr.find((l) => l.status === "confirmed" || l.status === "success") ?? null);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id]);

  // Validaciones
  const allComplete =
    processes.length > 0 &&
    processes.every((p) => p.status === "completed" || p.status === "skipped");
  const enteredInventory = unit.status === "entered_inventory";
  const invalidStatus = unit.status === "cancelled" || unit.status === "lost";
  const missingVariant = !unit.core_variant_id;
  const missingWooProduct = !wooProductId;
  const missingWooVariation = hasVariants && !wooVariationId;

  const blockers: string[] = [];
  if (invalidStatus) blockers.push("Unidad cancelada/no válida.");
  if (!allComplete) blockers.push("Aún hay procesos pendientes.");
  if (missingVariant) blockers.push("Falta variante asociada.");
  if (missingWooProduct) blockers.push("Falta Woo Product ID.");
  if (missingWooVariation) blockers.push("Falta Woo Variation ID.");

  const canEnter = blockers.length === 0 && !enteredInventory;

  async function handleAddToInventory() {
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-stock-write", {
        body: {
          production_unit_id: unit.id,
          action_type: "stock_increase",
          quantity: 1,
        },
      });
      if (error) throw error;
      const resp: any = data;
      if (resp?.skipped) {
        toast({ title: "Bloqueado", description: resp.message || "Esta unidad ya fue ingresada.", variant: "destructive" });
      } else if (resp?.reused_preview) {
        toast({ title: "Preview reutilizado", description: "Se está usando un preview existente." });
      } else if (resp?.ok) {
        toast({
          title: mode === "dry_run" ? "Preview dry_run generado" : "Acción ejecutada",
          description: resp.warning || "Revisa el preview en Inventario.",
        });
      } else if (resp?.error) {
        toast({ title: "Error", description: resp.error, variant: "destructive" });
      }
      await reload();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Package className="h-4 w-4" /> Inventario
        </p>
        <Badge variant="outline" className="text-[10px]">
          woo_write_mode: {mode}
        </Badge>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : enteredInventory ? (
        <div className="space-y-2">
          <p className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="font-medium">Ingresada a inventario</span>
          </p>
          {activeLog && (
            <p className="text-xs text-muted-foreground">
              {new Date(activeLog.created_at).toLocaleString()} · stock {activeLog.stock_before} → {activeLog.stock_after_expected}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm">
            <span className="font-medium">Estado: </span>
            {canEnter ? (
              <span className="text-green-700">Lista para inventario</span>
            ) : (
              <span className="text-amber-700">No lista para inventario</span>
            )}
          </div>

          {blockers.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {blockers.map((b, i) => (
                <li key={i} className="flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-600" /> {b}
                </li>
              ))}
            </ul>
          )}

          {latestLog && (
            <Card className="p-3 text-xs space-y-1 bg-background">
              <div className="flex items-center justify-between">
                <span className="font-medium">Preview existente</span>
                <Badge variant="secondary" className="text-[10px]">{latestLog.status}</Badge>
              </div>
              <div className="text-muted-foreground">
                stock {latestLog.stock_before} → {latestLog.stock_after_expected}
                {latestLog.quantity_delta != null && ` (Δ ${latestLog.quantity_delta > 0 ? "+" : ""}${latestLog.quantity_delta})`}
              </div>
              <div className="text-muted-foreground">
                SKU: {latestLog.variant_sku || latestLog.sku || "—"}
                {latestLog.woo_variation_id && ` · variation_id: ${latestLog.woo_variation_id}`}
              </div>
              <div className="text-muted-foreground truncate">key: {latestLog.idempotency_key}</div>
            </Card>
          )}

          {canEnter && mode !== "off" && (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleAddToInventory} disabled={working}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                {latestLog && latestLog.status === "preview"
                  ? "Regenerar preview"
                  : "Agregar a inventario"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/core/inventario")}>
                <ExternalLink className="h-4 w-4" /> Abrir Inventario
              </Button>
            </div>
          )}

          {mode === "off" && (
            <p className="text-xs text-destructive">
              La escritura WooCommerce está desactivada.
            </p>
          )}

          {mode === "dry_run" && canEnter && (
            <p className="text-[11px] text-muted-foreground">
              Modo dry_run: se generará un preview. No se escribirá en WooCommerce. La unidad seguirá en estado “{unit.status}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
