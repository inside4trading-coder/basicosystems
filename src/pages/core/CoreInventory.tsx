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
  request_payload: any;
  idempotency_key: string | null;
  error_message: string | null;
  created_at: string;
  // joined
  unit_code?: string | null;
  size?: string | null;
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
      const variantIds = Array.from(new Set(rows.map((r) => r.core_variant_id).filter(Boolean) as string[]));

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
        variantIds.length
          ? supabase
              .from("core_product_variants")
              .select("id, woo_variation_id, woo_stock_quantity, size, variant_label")
              .in("id", variantIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const oMap = new Map((orders ?? []).map((o: any) => [o.id, o]));
      const pMap = new Map((products ?? []).map((p: any) => [p.id, p]));
      const vMap = new Map((variants ?? []).map((v: any) => [v.id, v]));

      const enriched: Unit[] = rows.map((u) => {
        const p = u.core_product_id ? pMap.get(u.core_product_id) : null;
        const v = u.core_variant_id ? vMap.get(u.core_variant_id) : null;
        const o = u.production_order_id ? oMap.get(u.production_order_id) : null;
        return {
          ...u,
          order_code: o?.order_code ?? null,
          product_name: p?.name ?? null,
          woo_product_id: p?.woo_product_id ?? null,
          woo_variation_id: v?.woo_variation_id ?? null,
          woo_stock_quantity: v?.woo_stock_quantity ?? p?.woo_stock_quantity ?? null,
        };
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
    const ready: Unit[] = [];
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
      // Si ya tiene entrada preparada activa, no aparece en "Unidades listas"
      if (previewByUnit.has(u.id)) continue;
      ready.push(u);
    }
    return { readyUnits: ready, blockedUnits: blocked };
  }, [units, logs, previewByUnit]);

  const generatePreview = async (u: Unit) => {
    setBusyUnit(u.id);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-stock-write", {
        body: { production_unit_id: u.id, action_type: "stock_increase", quantity: 1 },
      });
      if (error) throw error;
      if ((data as any)?.skipped) {
        toast({
          title: "Bloqueada",
          description: (data as any)?.message ?? "No se puede duplicar.",
          variant: "destructive",
        });
      } else if ((data as any)?.reused_preview) {
        toast({ title: "Entrada preparada ya existente", description: "Esta unidad ya tiene una entrada preparada activa." });
      } else {
        toast({ title: "Entrada preparada", description: "Aún NO se actualiza WooCommerce. Debe confirmarse manualmente." });
      }
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

  const confirmWrite = async (log: WooLog) => {
    setConfirmBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-stock-write", {
        body: { action: "confirm", preview_log_id: log.id },
      });
      if (error) {
        // edge function returned non-2xx — surface error message
        const msg = (error as any)?.message ?? "Error en la escritura";
        toast({ title: "No se pudo confirmar", description: msg, variant: "destructive" });
      } else if ((data as any)?.stale_preview) {
        toast({
          title: "Preview obsoleto",
          description: (data as any)?.message ?? "El stock cambió en Woo. Regenera el preview.",
          variant: "destructive",
        });
      } else if ((data as any)?.skipped) {
        toast({ title: "Bloqueado", description: (data as any)?.message ?? "Duplicado.", variant: "destructive" });
      } else if ((data as any)?.error) {
        toast({ title: "Error", description: (data as any).error, variant: "destructive" });
      } else if ((data as any)?.ok) {
        toast({
          title: "Stock actualizado en WooCommerce",
          description: `Stock confirmado: ${(data as any).stock_after_confirmed}`,
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ready">
            <Package className="h-4 w-4 mr-1" /> Unidades listas
            <Badge variant="secondary" className="ml-2">{readyUnits.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="previews">
            <Eye className="h-4 w-4 mr-1" /> Entradas preparadas
            <Badge variant="secondary" className="ml-2">{previewLogs.length}</Badge>
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

        {/* TAB: Unidades listas */}
        <TabsContent value="ready" className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unidades completadas listas para inventario</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidad</TableHead>
                    <TableHead>OP</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>SKU variante</TableHead>
                    <TableHead>Talla</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Woo product</TableHead>
                    <TableHead>Woo variation</TableHead>
                    <TableHead className="text-right">Stock Woo</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readyUnits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No hay unidades listas. Las unidades deben estar en estado <code>completed</code>.
                      </TableCell>
                    </TableRow>
                  )}
                  {readyUnits.map((u) => {
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono text-xs">{u.unit_code}</TableCell>
                        <TableCell className="font-mono text-xs">{u.order_code ?? "—"}</TableCell>
                        <TableCell>{u.product_name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{u.variant_sku ?? u.sku ?? "—"}</TableCell>
                        <TableCell>{u.size ?? u.variant_label ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{u.woo_product_id ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{u.woo_variation_id ?? "—"}</TableCell>
                        <TableCell className="text-right">{u.woo_stock_quantity ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="default"
                            disabled={busyUnit === u.id}
                            onClick={() => generatePreview(u)}
                          >
                            <PlayCircle className="h-4 w-4" />
                            Preparar entrada
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Previews */}
        <TabsContent value="previews" className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entradas preparadas pendientes</CardTitle>
              {writeMode === "dry_run" && (
                <p className="text-xs text-muted-foreground">
                  Modo dry_run: las entradas preparadas no pueden confirmarse en WooCommerce.
                </p>
              )}
              {writeMode === "manual_confirm" && (
                <p className="text-xs text-amber-700">
                  Modo manual_confirm: confirmar una entrada actualiza el stock real en WooCommerce.
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>SKU variante</TableHead>
                    <TableHead>Talla</TableHead>
                    <TableHead>Woo product</TableHead>
                    <TableHead>Woo variation</TableHead>
                    <TableHead className="text-right">Stock antes</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead className="text-right">Stock esperado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        No hay entradas preparadas activas.
                      </TableCell>
                    </TableRow>
                  )}
                  {previewLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{l.unit_code ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.variant_sku ?? l.sku ?? "—"}</TableCell>
                      <TableCell>{l.size ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.woo_product_id ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.woo_variation_id ?? "—"}</TableCell>
                      <TableCell className="text-right">{l.stock_before ?? 0}</TableCell>
                      <TableCell className="text-right">
                        {l.quantity_delta != null
                          ? (l.quantity_delta > 0 ? `+${l.quantity_delta}` : `${l.quantity_delta}`)
                          : "set"}
                      </TableCell>
                      <TableCell className="text-right font-medium">{l.stock_after_expected ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={tone(l.status)}>
                          {l.status === "preview" ? "entrada preparada" : l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(l)}>
                          <Eye className="h-4 w-4" /> Ver entrada preparada
                        </Button>
                        {writeMode === "manual_confirm" && l.status === "preview" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => { setConfirming(l); setConfirmChecked(false); }}
                          >
                            <ShieldCheck className="h-4 w-4" /> Confirmar y escribir en WooCommerce
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const u = units.find((x) => x.id === l.production_unit_id);
                            if (u) await generatePreview(u);
                          }}
                        >
                          <RefreshCw className="h-4 w-4" /> Regenerar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDiscarding(l)}>
                          <XCircle className="h-4 w-4" /> Descartar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
