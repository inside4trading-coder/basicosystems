// BLOQUE 13 — Inventario (fase dry_run).
// Solo lectura + llamada a core-woo-stock-write (dry_run).
// NO escribe en WooCommerce, NO cambia stock, NO cambia estado de unidad.
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  isPreviewStale,
  previewAgeLabel,
  previewGeneratedAt,
  PREVIEW_STALE_TEXT,
} from "@/lib/coreInventoryPreview";
import {
  InventoryWriteResult,
  type InventoryVerification,
} from "@/components/core/InventoryWriteResult";
import { pickVariant, VARIANT_SELECT } from "@/lib/coreVariantResolve";



import {
  Warehouse,
  PlayCircle,
  RefreshCw,
  Eye,
  AlertTriangle,
  XCircle,
  History,
  Package,
  ShieldCheck,
} from "lucide-react";

type Unit = {
  id: string;
  unit_code: string;
  status: string;
  production_order_id: string;
  core_product_id: string | null;
  core_variant_id: string | null;
  sku: string | null;
  variant_sku: string | null;
  variant_label: string | null;
  size: string | null;
  created_at: string;
  // joined
  order_code?: string | null;
  product_name?: string | null;
  woo_product_id?: number | null;
  woo_variation_id?: number | null;
  woo_stock_quantity?: number | null;
};

type WooLog = {
  id: string;
  action_type: string;
  mode: string;
  status: string;
  production_unit_id: string | null;
  production_order_id: string | null;
  core_product_id: string | null;
  core_variant_id: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  sku: string | null;
  variant_sku: string | null;
  stock_before: number | null;
  quantity_delta: number | null;
  stock_after_expected: number | null;
  stock_after_confirmed?: number | null;

  request_payload: any;
  idempotency_key: string | null;
  error_message: string | null;
  created_at: string;
  // joined
  unit_code?: string | null;
  size?: string | null;
};

type EntryState = "none" | "valid" | "stale" | "error";

type ReadyRow = {
  unit: Unit;
  preview: WooLog | null;
  failed: WooLog | null;
  entryState: EntryState;
};

const tone = (status: string) => {

  switch (status) {
    case "preview":
      return "bg-blue-500/15 text-blue-700 border-blue-300";
    case "confirmed":
      return "bg-amber-500/15 text-amber-700 border-amber-300";
    case "success":
      return "bg-emerald-500/15 text-emerald-700 border-emerald-300";
    case "failed":
      return "bg-destructive/15 text-destructive border-destructive/40";
    case "skipped":
      return "bg-muted text-muted-foreground border-border";
    case "reverted":
      return "bg-purple-500/15 text-purple-700 border-purple-300";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export default function CoreInventory() {
  const [tab, setTab] = useState("ready");
  const [loading, setLoading] = useState(false);
  const [busyUnit, setBusyUnit] = useState<string | null>(null);

  const [units, setUnits] = useState<Unit[]>([]);
  const [logs, setLogs] = useState<WooLog[]>([]);
  const [writeMode, setWriteMode] = useState<string>("dry_run");

  const [detail, setDetail] = useState<WooLog | null>(null);
  const [discarding, setDiscarding] = useState<WooLog | null>(null);
  const [confirming, setConfirming] = useState<WooLog | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [lastResult, setLastResult] = useState<InventoryVerification | null>(null);


  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 0) modo actual
      const { data: settings } = await supabase
        .from("core_settings")
        .select("woo_write_mode")
        .limit(1)
        .maybeSingle();
      setWriteMode((settings as any)?.woo_write_mode ?? "dry_run");

      // 1) unidades candidatas (status != cancelled / lost)
      const { data: uData, error: uErr } = await supabase
        .from("core_production_units")
        .select(
          "id, unit_code, status, production_order_id, core_product_id, core_variant_id, sku, variant_sku, variant_label, size, created_at",
        )
        .not("status", "in", "(cancelled,lost)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (uErr) throw uErr;

      const rows = (uData ?? []) as Unit[];
      const orderIds = Array.from(new Set(rows.map((r) => r.production_order_id).filter(Boolean)));
      const productIds = Array.from(new Set(rows.map((r) => r.core_product_id).filter(Boolean) as string[]));

      const [{ data: orders }, { data: products }, { data: variants }] = await Promise.all([
        orderIds.length
          ? supabase.from("core_production_orders").select("id, order_code").in("id", orderIds)
          : Promise.resolve({ data: [] as any[] }),
        productIds.length
          ? supabase
              .from("core_products")
              .select("id, name, woo_product_id, woo_stock_quantity")
              .in("id", productIds)
          : Promise.resolve({ data: [] as any[] }),
        productIds.length
          ? supabase
              .from("core_product_variants")
              .select(`${VARIANT_SELECT}, woo_stock_quantity`)
              .in("core_product_id", productIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const oMap = new Map((orders ?? []).map((o: any) => [o.id, o]));
      const pMap = new Map((products ?? []).map((p: any) => [p.id, p]));
      const variantsByProduct = new Map<string, any[]>();
      for (const v of (variants ?? []) as any[]) {
        const arr = variantsByProduct.get(v.core_product_id) ?? [];
        arr.push(v);
        variantsByProduct.set(v.core_product_id, arr);
      }

      const enriched: Unit[] = rows.map((u) => {
        const p = u.core_product_id ? pMap.get(u.core_product_id) : null;
        const list = u.core_product_id ? variantsByProduct.get(u.core_product_id) ?? [] : [];
        // Resolución tolerante: si el core_variant_id quedó huérfano, se recupera por SKU/talla.
        const resolved = pickVariant(u as any, list as any);
        const v = resolved.variant as any;
        const o = u.production_order_id ? oMap.get(u.production_order_id) : null;
        return {
          ...u,
          order_code: o?.order_code ?? null,
          product_name: p?.name ?? null,
          woo_product_id: p?.woo_product_id ?? null,
          woo_variation_id: v?.woo_variation_id ?? null,
          woo_stock_quantity: v?.woo_stock_quantity ?? p?.woo_stock_quantity ?? null,
          _variant_issue: resolved.status === "resolved" ? null : resolved.reason ?? null,
          _variant_recovered: resolved.recovered,
        } as Unit;
      });

      setUnits(enriched);

      // 2) logs woo
      const { data: lData, error: lErr } = await supabase
        .from("core_woo_write_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (lErr) throw lErr;
      const lRows = (lData ?? []) as WooLog[];
      const luIds = Array.from(new Set(lRows.map((l) => l.production_unit_id).filter(Boolean) as string[]));
      let uMap = new Map<string, { unit_code: string; size: string | null }>();
      if (luIds.length) {
        const { data: usForLogs } = await supabase
          .from("core_production_units")
          .select("id, unit_code, size")
          .in("id", luIds);
        uMap = new Map((usForLogs ?? []).map((u: any) => [u.id, { unit_code: u.unit_code, size: u.size }]));
      }
      setLogs(
        lRows.map((l) => ({
          ...l,
          unit_code: l.production_unit_id ? uMap.get(l.production_unit_id)?.unit_code ?? null : null,
          size: l.production_unit_id ? uMap.get(l.production_unit_id)?.size ?? null : null,
        })),
      );
    } catch (e: any) {
      toast({ title: "Error cargando inventario", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mapa de entradas preparadas activas (cualquier mode) por unidad
  const previewLogs = useMemo(
    () => logs.filter((l) => l.status === "preview" && l.action_type === "stock_increase"),
    [logs],
  );

  const previewByUnit = useMemo(() => {
    const m = new Map<string, WooLog>();
    for (const l of previewLogs) {
      if (l.production_unit_id && !m.has(l.production_unit_id)) m.set(l.production_unit_id, l);
    }
    return m;
  }, [previewLogs]);

  // Clasificación de unidades
  const { readyUnits, blockedUnits } = useMemo(() => {
    const successKeys = new Set(
      logs
        .filter((l) => ["confirmed", "success"].includes(l.status) && l.idempotency_key)
        .map((l) => l.idempotency_key as string),
    );
    const failedByUnit = new Map<string, WooLog>();
    for (const l of logs) {
      if (l.status === "failed" && l.production_unit_id && !failedByUnit.has(l.production_unit_id)) {
        failedByUnit.set(l.production_unit_id, l);
      }
    }
    const ready: ReadyRow[] = [];
    const blocked: Array<Unit & { reason: string }> = [];
    for (const u of units) {
      const reasons: string[] = [];
      if (u.status !== "completed") reasons.push(`Estado: ${u.status} (no completed)`);
      if (!u.core_variant_id) reasons.push("Falta variante (core_variant_id)");
      if (!u.woo_product_id) reasons.push("Falta woo_product_id");
      if (u.core_variant_id && !u.woo_variation_id) reasons.push("Falta woo_variation_id");
      if (successKeys.has(`${u.unit_code}::stock_increase`)) reasons.push("Ya ingresada (idempotency)");
      if (reasons.length > 0) {
        blocked.push({ ...u, reason: reasons.join(" · ") });
        continue;
      }
      const preview = previewByUnit.get(u.id) ?? null;
      const failed = !preview ? failedByUnit.get(u.id) ?? null : null;
      const stale = preview ? isPreviewStale(preview) : false;
      const entryState: EntryState = failed
        ? "error"
        : !preview
          ? "none"
          : stale
            ? "stale"
            : "valid";
      ready.push({ unit: u, preview, failed, entryState });
    }
    // Sin entrada primero, luego vigentes, luego desactualizadas / errores.
    const order: Record<EntryState, number> = { none: 0, valid: 1, stale: 2, error: 3 };
    ready.sort((a, b) => order[a.entryState] - order[b.entryState]);
    return { readyUnits: ready, blockedUnits: blocked };
  }, [units, logs, previewByUnit]);


  // Genera entrada preparada fresca (lectura Woo obligatoria) y, en manual_confirm,
  // confirma + verifica en el mismo paso.
  const addToInventory = async (u: Unit) => {
    setBusyUnit(u.id);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-stock-write", {
        body: {
          production_unit_id: u.id,
          action_type: "stock_increase",
          quantity: 1,
          preview_source: "generated_on_confirm",
        },
      });
      if (error) {
        const b = await parseEdgeError(error);
        throw new Error(
          b?.error ??
            b?.message ??
            "No se pudo consultar el stock actual de WooCommerce. No se ingresó la prenda.",
        );
      }
      const resp: any = data;
      if (resp?.skipped) {
        toast({ title: "Bloqueada", description: resp?.message ?? "No se puede duplicar.", variant: "destructive" });
        await load();
        return;
      }
      if (resp?.error) {
        toast({ title: "Error", description: resp.error, variant: "destructive" });
        await load();
        return;
      }

      const previewId: string | null = resp?.preview?.id ?? null;

      if (writeMode !== "manual_confirm" || !previewId) {
        toast({
          title: "Entrada preparada",
          description:
            writeMode === "dry_run"
              ? "Modo dry_run: no se actualiza WooCommerce."
              : "Revisa la entrada preparada.",
        });
        await load();
        return;
      }

      await confirmWrite({
        id: previewId,
        unit_code: u.unit_code,
        variant_sku: u.variant_sku,
        sku: u.sku,
        size: u.size,
        woo_product_id: u.woo_product_id ?? null,
        woo_variation_id: u.woo_variation_id ?? null,
        stock_before: resp?.preview?.stock_before ?? null,
        quantity_delta: 1,
        stock_after_expected: resp?.preview?.stock_after_expected ?? null,
      } as unknown as WooLog);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusyUnit(null);
      await load();
    }
  };


  const regeneratePreview = async (log: WooLog) => {
    setBusyUnit(log.id);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-stock-write", {
        body: { action: "regenerate", preview_log_id: log.id },
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
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusyUnit(null);
    }
  };

  const discardPreview = async (log: WooLog) => {

    try {
      const { error } = await supabase
        .from("core_woo_write_logs")
        .update({ status: "skipped", error_message: "Descartado manualmente desde Inventario." })
        .eq("id", log.id);
      if (error) throw error;
      toast({ title: "Entrada preparada descartada" });
      setDiscarding(null);
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const parseEdgeError = async (error: any): Promise<any | null> => {
    try {
      const ctx = error?.context;
      if (ctx && typeof ctx.json === "function") {
        return await ctx.clone().json();
      }
      if (ctx && typeof ctx.text === "function") {
        const t = await ctx.clone().text();
        try { return JSON.parse(t); } catch { return { message: t }; }
      }
    } catch { /* ignore */ }
    return null;
  };

  const confirmWrite = async (log: WooLog) => {
    setConfirmBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-stock-write", {
        body: { action: "confirm", preview_log_id: log.id },
      });
      if (error) {
        const body = await parseEdgeError(error);
        if (body?.expired_preview) {
          toast({
            title: "Entrada preparada desactualizada",
            description: body.message ?? PREVIEW_STALE_TEXT,
            variant: "destructive",
          });
          setConfirming(null);
          setConfirmChecked(false);
        } else if (body?.stale_preview) {
          toast({
            title: "Stock cambió en WooCommerce",
            description:
              `El stock real de WooCommerce cambió desde que preparaste esta entrada. ` +
              `Stock preparado: ${body.preview_stock ?? log.stock_before ?? 0} · ` +
              `Stock real actual: ${body.real_stock ?? "?"}. Regenera la entrada antes de confirmar.`,
            variant: "destructive",
          });
          setConfirming(null);
          setConfirmChecked(false);
        } else if (body?.skipped) {
          toast({ title: "Bloqueado", description: body.message ?? "Duplicado.", variant: "destructive" });
        } else {
          const msg = body?.message ?? body?.error ?? (error as any)?.message ?? "Error en la escritura";
          toast({ title: "No se pudo confirmar", description: msg, variant: "destructive" });
        }
      } else if ((data as any)?.expired_preview) {
        toast({
          title: "Entrada preparada desactualizada",
          description: (data as any)?.message ?? PREVIEW_STALE_TEXT,
          variant: "destructive",
        });
        setConfirming(null);
        setConfirmChecked(false);
      } else if ((data as any)?.stale_preview) {
        toast({
          title: "Stock cambió en WooCommerce",
          description: (data as any)?.message ?? "El stock cambió en Woo. Regenera la entrada antes de confirmar.",
          variant: "destructive",
        });
      } else if ((data as any)?.skipped) {
        toast({ title: "Bloqueado", description: (data as any)?.message ?? "Duplicado.", variant: "destructive" });
      } else if ((data as any)?.error) {
        toast({ title: "Error", description: (data as any).error, variant: "destructive" });
      } else if ((data as any)?.ok) {
        const v = (data as any).verification as InventoryVerification | undefined;
        const { data: userData } = await supabase.auth.getUser();
        const verification: InventoryVerification = {
          verified: v?.verified ?? true,
          verify_error: v?.verify_error ?? null,
          unit_code: v?.unit_code ?? log.unit_code ?? null,
          sku: v?.sku ?? log.variant_sku ?? log.sku ?? null,
          size: v?.size ?? (log as any).size ?? null,
          woo_product_id: v?.woo_product_id ?? log.woo_product_id ?? null,
          woo_variation_id: v?.woo_variation_id ?? log.woo_variation_id ?? null,
          stock_before: v?.stock_before ?? log.stock_before ?? null,
          delta: v?.delta ?? log.quantity_delta ?? 1,
          stock_expected: v?.stock_expected ?? log.stock_after_expected ?? null,
          stock_real: v?.stock_real ?? (data as any).stock_after_confirmed ?? null,
          difference: v?.difference ?? 0,
          checked_at: v?.checked_at ?? new Date().toISOString(),
          user_email: userData?.user?.email ?? null,
          preview_source: v?.preview_source ?? "reused_valid_preview",
          woo_stock_checked_before_at: v?.woo_stock_checked_before_at ?? null,
          woo_stock_checked_after_at: v?.woo_stock_checked_after_at ?? null,
          confirmed_at: v?.confirmed_at ?? null,
        };
        setLastResult(verification);
        toast({
          title: verification.verified
            ? "Prenda agregada exitosamente a inventario"
            : "ALERTA: stock no coincidente",
          description: verification.verified
            ? `Unidad ${verification.unit_code ?? "—"} · Stock ${verification.stock_before} → ${verification.stock_real}. Stock verificado correctamente.`
            : `Esperado ${verification.stock_expected} · Real ${verification.stock_real}. Revisa la alerta y envía el reporte a tu superior.`,
          variant: verification.verified ? undefined : "destructive",
        });
        setConfirming(null);
        setConfirmChecked(false);

      }
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Warehouse className="h-7 w-7 text-primary" /> Inventario
          </h1>
          <p className="text-sm text-muted-foreground">
            Preparación de entradas a stock y previsualización de actualización WooCommerce.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            Modo Woo: {writeMode}
          </Badge>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refrescar
          </Button>
        </div>
      </div>

      {writeMode === "dry_run" && (
        <Card className="border-blue-300/40 bg-blue-500/5">
          <CardContent className="py-3 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-700" />
            <span>
              <strong>dry_run activo:</strong> esta pantalla NO actualiza WooCommerce ni cambia stock.
              Solo prepara entradas para revisión.
            </span>
          </CardContent>
        </Card>
      )}

      {lastResult && (
        <InventoryWriteResult
          verification={lastResult}
          onDismiss={lastResult.verified ? () => setLastResult(null) : undefined}
        />
      )}

      <Tabs value={tab} onValueChange={setTab}>

        <TabsList>
          <TabsTrigger value="ready">
            <Package className="h-4 w-4 mr-1" /> Unidades listas
            <Badge variant="secondary" className="ml-2">{readyUnits.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-1" /> Historial de entradas
            <Badge variant="secondary" className="ml-2">{logs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="blocked">
            <AlertTriangle className="h-4 w-4 mr-1" /> Errores / bloqueadas
            <Badge variant="secondary" className="ml-2">{blockedUnits.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* TAB: Unidades listas (incluye unidades con entrada preparada) */}
        <TabsContent value="ready" className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unidades pendientes de ingreso a inventario</CardTitle>
              <p className="text-xs text-muted-foreground">
                Incluye unidades sin entrada preparada y unidades con entrada vigente o desactualizada.
              </p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidad</TableHead>
                    <TableHead>OP</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>SKU variante</TableHead>
                    <TableHead>Talla</TableHead>
                    <TableHead className="text-right">Stock Woo</TableHead>
                    <TableHead>Estado entrada</TableHead>
                    <TableHead>Edad entrada</TableHead>
                    <TableHead className="text-right">Stock esperado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readyUnits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No hay unidades pendientes de ingreso a inventario.
                      </TableCell>
                    </TableRow>
                  )}
                  {readyUnits.map(({ unit: u, preview, failed, entryState }) => {
                    const busy = busyUnit === u.id || (preview ? busyUnit === preview.id : false);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono text-xs">{u.unit_code}</TableCell>
                        <TableCell className="font-mono text-xs">{u.order_code ?? "—"}</TableCell>
                        <TableCell>{u.product_name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{u.variant_sku ?? u.sku ?? "—"}</TableCell>
                        <TableCell>{u.size ?? u.variant_label ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {preview?.stock_before ?? u.woo_stock_quantity ?? 0}
                        </TableCell>
                        <TableCell>
                          {entryState === "none" && (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              Sin entrada
                            </Badge>
                          )}
                          {entryState === "valid" && (
                            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-300">
                              Vigente
                            </Badge>
                          )}
                          {entryState === "stale" && (
                            <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-300">
                              Desactualizada
                            </Badge>
                          )}
                          {entryState === "error" && (
                            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/40">
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {preview ? previewAgeLabel(preview) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {preview?.stock_after_expected ?? "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          {entryState === "error" && failed && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setDetail(failed)}>
                                <Eye className="h-4 w-4" /> Ver error
                              </Button>
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => addToInventory(u)}>
                                <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Reintentar
                              </Button>
                            </>
                          )}
                          {entryState === "stale" && preview && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                disabled={busy}
                                title="Consulta WooCommerce ahora y recalcula el stock esperado."
                                onClick={() => regeneratePreview(preview)}
                              >
                                <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Actualizar stock esperado
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setDetail(preview)}>
                                <Eye className="h-4 w-4" /> Ver entrada
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setDiscarding(preview)}>
                                <XCircle className="h-4 w-4" /> Descartar
                              </Button>
                            </>
                          )}
                          {(entryState === "none" || entryState === "valid") && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                disabled={busy}
                                onClick={() =>
                                  entryState === "valid" && preview && writeMode === "manual_confirm"
                                    ? (setConfirming(preview), setConfirmChecked(false))
                                    : addToInventory(u)
                                }
                              >
                                {writeMode === "dry_run" ? (
                                  <PlayCircle className="h-4 w-4" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                                {writeMode === "dry_run" ? "Preparar entrada" : "Agregar a inventario"}
                              </Button>
                              {preview && (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => setDetail(preview)}>
                                    <Eye className="h-4 w-4" /> Ver entrada
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setDiscarding(preview)}>
                                    <XCircle className="h-4 w-4" /> Descartar
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>


        {/* TAB: Historial */}
        <TabsContent value="history" className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial completo de intentos Woo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead>Idempotency key</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Sin registros.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{l.unit_code ?? "—"}</TableCell>
                      <TableCell className="text-xs">{l.action_type}</TableCell>
                      <TableCell className="text-xs">{l.mode}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={tone(l.status)}>{l.status}</Badge>
                        {l.status === "success" && l.stock_after_confirmed != null && (
                          l.stock_after_confirmed === l.stock_after_expected ? (
                            <Badge variant="outline" className="ml-1 text-[10px] border-green-600/40 text-green-700">
                              Verificada
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="ml-1 text-[10px]">
                              Discrepancia
                            </Badge>
                          )
                        )}

                      </TableCell>
                      <TableCell className="text-right">{l.quantity_delta ?? "—"}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {l.idempotency_key ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(l)}>
                          <Eye className="h-4 w-4" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Bloqueadas */}
        <TabsContent value="blocked" className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unidades que no pueden ingresar a inventario</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidad</TableHead>
                    <TableHead>OP</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedUnits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Sin unidades bloqueadas.
                      </TableCell>
                    </TableRow>
                  )}
                  {blockedUnits.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">{u.unit_code}</TableCell>
                      <TableCell className="font-mono text-xs">{u.order_code ?? "—"}</TableCell>
                      <TableCell>{u.product_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detalle */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de entrada preparada</DialogTitle>
            <DialogDescription>
              Modo actual: <strong>{detail?.mode}</strong> — esta entrada todavía NO actualiza WooCommerce.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Unidad: </span><span className="font-mono">{detail.unit_code ?? "—"}</span></div>
                <div><span className="text-muted-foreground">SKU variante: </span><span className="font-mono">{detail.variant_sku ?? detail.sku ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Talla: </span>{detail.size ?? "—"}</div>
                <div><span className="text-muted-foreground">Acción: </span>{detail.action_type}</div>
                <div><span className="text-muted-foreground">Woo product: </span><span className="font-mono">{detail.woo_product_id ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Woo variation: </span><span className="font-mono">{detail.woo_variation_id ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Stock antes: </span>{detail.stock_before ?? 0}</div>
                <div><span className="text-muted-foreground">Δ: </span>{detail.quantity_delta ?? "—"}</div>
                <div><span className="text-muted-foreground">Stock esperado: </span><strong>{detail.stock_after_expected ?? 0}</strong></div>
                <div><span className="text-muted-foreground">Estado: </span><Badge variant="outline" className={tone(detail.status)}>{detail.status}</Badge></div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Idempotency key</div>
                <div className="font-mono text-xs bg-muted p-2 rounded">{detail.idempotency_key ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Request payload simulado</div>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
{JSON.stringify(detail.request_payload, null, 2)}
                </pre>
              </div>
              <div className="text-xs text-amber-700 bg-amber-500/10 border border-amber-300/40 rounded p-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Esta entrada todavía NO actualiza WooCommerce. Debe confirmarse manualmente.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Descartar */}
      <Dialog open={!!discarding} onOpenChange={(o) => !o && setDiscarding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar entrada preparada</DialogTitle>
            <DialogDescription>
              La entrada preparada se marcará como <code>skipped</code>. Queda en el historial y no afecta WooCommerce ni la unidad.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscarding(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => discarding && discardPreview(discarding)}>
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar escritura Woo */}
      <Dialog
        open={!!confirming}
        onOpenChange={(o) => { if (!o) { setConfirming(null); setConfirmChecked(false); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Confirmar escritura WooCommerce
            </DialogTitle>
            <DialogDescription>
              Vas a sumar <strong>+1</strong> al stock real de WooCommerce para esta variación.
              Esta acción no debe repetirse.
            </DialogDescription>
          </DialogHeader>
          {confirming && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Unidad: </span><span className="font-mono">{confirming.unit_code ?? "—"}</span></div>
                <div><span className="text-muted-foreground">SKU variante: </span><span className="font-mono">{confirming.variant_sku ?? confirming.sku ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Talla: </span>{confirming.size ?? "—"}</div>
                <div><span className="text-muted-foreground">Woo product: </span><span className="font-mono">{confirming.woo_product_id ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Woo variation: </span><span className="font-mono">{confirming.woo_variation_id ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Stock preparado: </span>{confirming.stock_before ?? 0}</div>
                <div><span className="text-muted-foreground">Entrada: </span><strong>+1</strong></div>
                <div><span className="text-muted-foreground">Stock esperado: </span><strong>{confirming.stock_after_expected ?? 0}</strong></div>
              </div>
              <div className="text-xs text-amber-800 bg-amber-500/10 border border-amber-300/40 rounded p-2 flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>
                  La función re-leerá el stock real de WooCommerce antes de escribir. Si cambió, la
                  escritura se cancelará y deberás preparar la entrada nuevamente.
                </span>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={confirmChecked}
                  onCheckedChange={(v) => setConfirmChecked(!!v)}
                />
                <span className="text-sm">
                  Confirmo que quiero actualizar stock real en WooCommerce.
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                Revertir actualización Woo — próximamente.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setConfirming(null); setConfirmChecked(false); }}
              disabled={confirmBusy}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => confirming && confirmWrite(confirming)}
              disabled={!confirmChecked || confirmBusy}
            >
              {confirmBusy ? "Confirmando…" : "Confirmar y escribir en WooCommerce"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
