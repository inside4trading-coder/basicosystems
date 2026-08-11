// BLOQUE 13 — Sección "Inventario" embebida en Escaneo.
// Usa el mismo QR / misma unidad. No crea nada nuevo.
// Solo invoca core-woo-stock-write (modo según core_settings.woo_write_mode).
// En dry_run NO escribe en WooCommerce y NO cambia unidad a entered_inventory.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Package, AlertTriangle, CheckCircle2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { isPreviewStale, previewAgeLabel, INVENTORY_PREVIEW_TTL_MINUTES } from "@/lib/coreInventoryPreview";

const PREVIEW_STALE_TEXT_SCAN =
  `Esta entrada fue preparada hace más de ${INVENTORY_PREVIEW_TTL_MINUTES} minutos. ` +
  `Actualiza el stock esperado antes de ingresar a inventario.`;

const UNIT_STATE_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_production: "En producción",
  completed: "Lista para inventario",
  in_dispatch: "En despacho",
  sent_to_store: "Enviada a tienda",
  received_in_store: "Recibida en tienda",
  entered_inventory: "Ingresada a inventario",
};

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
        ? supabase.from("core_products").select("woo_product_id").eq("id", unit.core_product_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      unit.core_variant_id
        ? supabase.from("core_product_variants").select("woo_variation_id").eq("id", unit.core_variant_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
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
    // Si la unidad tiene core_variant_id, asumimos producto variable y exigimos woo_variation_id.
    setHasVariants(!!unit.core_variant_id);
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
  if (processes.length === 0) {
    blockers.push("Esta unidad no tiene procesos generados — requiere reparación.");
  } else if (!allComplete) {
    blockers.push("Aún hay procesos pendientes.");
  }
  if (missingVariant) blockers.push("Falta variante asociada.");
  if (missingWooProduct) blockers.push("Falta Woo Product ID.");
  if (missingWooVariation) blockers.push("Falta Woo Variation ID.");

  const canEnter = blockers.length === 0 && !enteredInventory;

  const activePreview = latestLog && latestLog.status === "preview" ? latestLog : null;
  const previewStale = activePreview ? isPreviewStale(activePreview) : false;

  async function parseEdgeError(error: any): Promise<any | null> {
    try {
      const ctx = error?.context;
      if (ctx && typeof ctx.text === "function") {
        const t = await ctx.clone().text();
        try { return JSON.parse(t); } catch { return { message: t }; }
      }
    } catch { /* ignore */ }
    return null;
  }

  async function handleRegenerate() {
    if (!activePreview) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-stock-write", {
        body: { action: "regenerate", preview_log_id: activePreview.id },
      });
      if (error) {
        const b = await parseEdgeError(error);
        throw new Error(b?.message ?? b?.error ?? error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const p = (data as any)?.preview;
      toast({
        title: "Stock esperado actualizado",
        description: `Stock Woo actual: ${p?.stock_before ?? "?"} → esperado ${p?.stock_after_expected ?? "?"}`,
      });
      await reload();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setWorking(false);
    }
  }

  async function handleAddToInventory() {
    if (activePreview && previewStale) {
      toast({
        title: "Entrada desactualizada",
        description: PREVIEW_STALE_TEXT_SCAN,
        variant: "destructive",
      });
      return;
    }
    setWorking(true);
    try {
      // 1) Reutilizar entrada preparada si existe; si no, crearla.
      let previewId: string | null = activePreview && !previewStale ? activePreview.id : null;

      if (!previewId) {

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
          await reload();
          return;
        }
        if (resp?.error) {
          toast({ title: "Error", description: resp.error, variant: "destructive" });
          await reload();
          return;
        }
        previewId = resp?.preview?.id ?? null;
      }

      // 2) Ingresar la unidad al inventario cuando el modo lo permite.
      if (mode === "manual_confirm" && previewId) {
        const { data, error } = await supabase.functions.invoke("core-woo-stock-write", {
          body: { action: "confirm", preview_log_id: previewId },
        });
        if (error) throw error;
        const resp: any = data;
        if (resp?.ok) {
          toast({ title: "Unidad agregada a inventario" });
        } else {
          toast({
            title: "No se pudo ingresar",
            description: resp?.message || resp?.error || "Revisa la entrada preparada.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Entrada preparada lista",
          description:
            mode === "dry_run"
              ? "Modo dry_run: la unidad no se ingresa todavía. Revisa la entrada en Inventario."
              : "Revisa la entrada preparada en Inventario.",
        });
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
          <div className="text-sm flex items-center gap-2 flex-wrap">
            <span className="font-medium">Estado unidad: </span>
            <Badge variant="outline" className="text-[10px]">
              {UNIT_STATE_LABEL[unit.status] ?? unit.status}
            </Badge>
            {canEnter ? (
              <span className="text-green-700 text-xs">Lista para inventario</span>
            ) : (
              <span className="text-amber-700 text-xs">No lista para inventario</span>
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
                <span className="font-medium">Entrada preparada</span>
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
            <div className="space-y-2">
              {activePreview && (
                <p className={`text-[11px] ${previewStale ? "text-amber-700" : "text-muted-foreground"}`}>
                  Entrada preparada {previewAgeLabel(activePreview)} ·{" "}
                  {previewStale ? "Desactualizada" : "Vigente"}
                  {previewStale &&
                    " — Antes de ingresar a inventario, actualiza el preview para usar el stock Woo actual."}
                </p>
              )}
              <div className="flex gap-2 flex-wrap items-center">
                {!activePreview && (
                  <Button onClick={handleAddToInventory} disabled={working}>
                    {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                    Agregar a inventario
                  </Button>
                )}
                {activePreview && !previewStale && (
                  <Button onClick={handleAddToInventory} disabled={working}>
                    {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Confirmar entrada a inventario
                  </Button>
                )}
                {activePreview && (
                  <Button
                    variant={previewStale ? "default" : "outline"}
                    onClick={handleRegenerate}
                    disabled={working}
                    title="Consulta WooCommerce ahora y recalcula el stock esperado antes de confirmar."
                  >
                    {working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Actualizar stock esperado
                  </Button>
                )}
                <Button variant="link" size="sm" className="text-xs px-1" onClick={() => navigate("/core/inventario")}>
                  <ExternalLink className="h-3 w-3 mr-1" /> Ver entrada preparada
                </Button>
              </div>
            </div>
          )}


          {mode === "off" && (
            <p className="text-xs text-destructive">
              La escritura WooCommerce está desactivada.
            </p>
          )}

          {mode === "dry_run" && canEnter && (
            <p className="text-[11px] text-muted-foreground">
              Modo dry_run: se prepara la entrada sin escribir en WooCommerce. La unidad seguirá en estado “{unit.status}”.
            </p>
          )}
        </div>

      )}
    </div>
  );
}
