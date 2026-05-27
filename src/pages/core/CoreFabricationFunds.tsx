import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Layers, Play, Plus, Download, RotateCcw, Wallet, AlertCircle, History, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { logCoreAudit } from "@/lib/coreAudit";
import PendingResolutionPanel from "@/components/core/PendingResolutionPanel";

type Fund = {
  id: string; fund_type: string; core_product_id: string | null; sku: string | null;
  name: string; currency: string; available_amount: number; status: string; updated_at: string;
};
type Movement = {
  id: string; fund_id: string; movement_type: string; source: string;
  source_order_id: number | null; source_order_item_id: number | null;
  core_product_id: string | null; sku: string | null; product_name: string | null;
  quantity: number | null; unit_cost_snapshot: number | null;
  amount: number; currency: string; reason: string | null; status: string;
  created_at: string; related_movement_id: string | null;
  fabrication_fund_run_id: string | null;
};
type Pending = {
  id: string; source_order_id: number; source_order_item_id: number | null;
  woo_sku: string | null; product_name: string | null; quantity: number | null; revenue: number | null;
  order_status: string | null; reason: string; suggested_action: string | null; status: string;
  created_at: string;
  fabrication_fund_run_id: string | null;
};

type Run = {
  id: string; status: string; created_at: string;
  orders_checked: number; items_checked: number; movements_created: number;
  pending_items_created: number; reversals_created: number; errors_count: number;
  summary: any;
};

const FUND_LABEL: Record<string, string> = {
  general: "General de fabricación",
  non_restockable: "No restockeable",
  product_specific: "Por producto",
  replacement: "Reemplazo",
  pending: "Pendiente",
};
const FUND_BADGE: Record<string, string> = {
  general: "bg-emerald-100 text-emerald-800 border-emerald-300",
  non_restockable: "bg-orange-100 text-orange-800 border-orange-300",
  product_specific: "bg-blue-100 text-blue-800 border-blue-300",
  replacement: "bg-purple-100 text-purple-800 border-purple-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
};
const MOV_LABEL: Record<string, string> = {
  sale_generated: "Venta",
  sale_generated_non_restockable: "Venta no restock",
  manual_increase: "Aumento manual",
  manual_decrease: "Disminución manual",
  transfer: "Transferencia",
  reversal: "Reverso",
  close: "Cierre",
  correction: "Corrección",
};
const MOV_BADGE: Record<string, string> = {
  sale_generated: "bg-emerald-100 text-emerald-800 border-emerald-300",
  sale_generated_non_restockable: "bg-orange-100 text-orange-800 border-orange-300",
  manual_increase: "bg-blue-100 text-blue-800 border-blue-300",
  manual_decrease: "bg-blue-100 text-blue-800 border-blue-300",
  transfer: "bg-purple-100 text-purple-800 border-purple-300",
  reversal: "bg-destructive/10 text-destructive border-destructive/30",
  close: "bg-muted text-muted-foreground border-border",
  correction: "bg-yellow-100 text-yellow-800 border-yellow-300",
};
const PENDING_REASON_LABEL: Record<string, string> = {
  product_not_in_core: "Producto no existe en Catálogo de Fabricación",
  missing_cost: "Producto sin costo en Catálogo",
  missing_sku: "SKU faltante",
  sku_conflict: "Conflicto de SKU",
  not_fabricable: "No fabricable",
  missing_restock_decision: "Falta decisión de restock",
  sync_error: "Error de sincronización",
};

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));

type ProdUnit = { id: string; sku: string | null; variant_sku: string | null; status: string };

const normSku = (s: string | null | undefined) =>
  (s ?? "").toString().trim().toUpperCase().replace(/\s+/g, "-").replace(/-+/g, "-");

export default function CoreFabricationFunds() {
  const [tab, setTab] = useState("resumen");
  const [funds, setFunds] = useState<Fund[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [pendings, setPendings] = useState<Pending[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [units, setUnits] = useState<ProdUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [runDetail, setRunDetail] = useState<Run | null>(null);
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");
  const [form, setForm] = useState({
    movement_type: "manual_increase",
    fund_id: "",
    target_fund_id: "",
    amount: "",
    reason: "",
    notes: "",
  });



  async function load() {
    setLoading(true);
    const [{ data: f }, { data: m }, { data: p }, { data: r }, { data: u }] = await Promise.all([
      supabase.from("core_fabrication_funds").select("*").order("fund_type"),
      supabase.from("core_fabrication_fund_movements").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("core_fabrication_fund_pending_items").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("core_fabrication_fund_runs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("core_production_units").select("id, sku, variant_sku, status").limit(5000),
    ]);
    setFunds((f as any) ?? []);
    setMovements((m as any) ?? []);
    setPendings((p as any) ?? []);
    setRuns((r as any) ?? []);
    setUnits((u as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);


  const totals = useMemo(() => {
    const general = funds.filter(f => f.fund_type === "general").reduce((s, f) => s + Number(f.available_amount), 0);
    const nonR = funds.filter(f => f.fund_type === "non_restockable").reduce((s, f) => s + Number(f.available_amount), 0);
    const pendingHist = pendings.filter(p => p.status === "pending").length;
    const lastRun = runs[0];
    const lastRunPend = lastRun?.pending_items_created ?? 0;
    const inRange = (iso: string) => {
      if (!periodStart && !periodEnd) return true;
      const t = new Date(iso).getTime();
      if (periodStart && t < new Date(periodStart).getTime()) return false;
      if (periodEnd) { const end = new Date(periodEnd); end.setHours(23,59,59,999); if (t > end.getTime()) return false; }
      return true;
    };
    const inRangePend = pendings.filter(p => p.status === "pending" && inRange(p.created_at));
    const rangeCount = inRangePend.length;
    const rangeRevenue = inRangePend.reduce((s, p) => s + Number(p.revenue ?? 0), 0);
    const sales = movements.filter(m => m.movement_type.startsWith("sale_generated")).length;
    const reversals = movements.filter(m => m.movement_type === "reversal").length;
    const manuals = movements.filter(m => m.movement_type.startsWith("manual_") || m.movement_type === "correction" || m.movement_type === "transfer").length;

    // === Visual interpretation: generated vs executed vs available ===
    // Group posted sale movements by normalized SKU, oldest first.
    // For each SKU, mark the first N movements as "executed" where N = units in entered_inventory for that SKU.
    // Remaining posted sale amounts are "available sin asignar".
    const saleMovs = movements
      .filter(m => m.status === "posted" && m.movement_type.startsWith("sale_generated") && Number(m.amount) > 0)
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const generatedTotal = saleMovs.reduce((s, m) => s + Number(m.amount), 0);

    const executedUnitsBySku: Record<string, number> = {};
    for (const u of units) {
      if (u.status !== "entered_inventory") continue;
      const k = normSku(u.variant_sku || u.sku);
      if (!k) continue;
      executedUnitsBySku[k] = (executedUnitsBySku[k] ?? 0) + 1;
    }

    let executedTotal = 0;
    const usedBySku: Record<string, number> = {};
    for (const mv of saleMovs) {
      const k = normSku(mv.sku);
      const capacity = executedUnitsBySku[k] ?? 0;
      const used = usedBySku[k] ?? 0;
      const qty = Number(mv.quantity ?? 1) || 1;
      const perUnit = Number(mv.amount) / qty;
      const remaining = Math.max(0, capacity - used);
      const cover = Math.min(qty, remaining);
      if (cover > 0) {
        executedTotal += perUnit * cover;
        usedBySku[k] = used + cover;
      }
    }
    const availableUnassigned = Math.max(0, generatedTotal - executedTotal);

    return { general, nonR, pendingHist, lastRunPend, rangeCount, rangeRevenue, sales, reversals, manuals, lastRun, generatedTotal, executedTotal, availableUnassigned };
  }, [funds, pendings, movements, runs, periodStart, periodEnd, units]);


  async function processSales() {
    setProcessing(true);
    try {
      const body: any = {};
      const toLocalISO = (dStr: string, end = false) => {
        const [y, m, d] = dStr.split("-").map(Number);
        const dt = new Date(y, (m ?? 1) - 1, d ?? 1, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
        return dt.toISOString();
      };
      if (periodStart) body.period_start = toLocalISO(periodStart, false);
      if (periodEnd) body.period_end = toLocalISO(periodEnd, true);
      const { data, error } = await supabase.functions.invoke("core-process-fabrication-funds", { body });
      if (error) throw error;
      const s = (data as any)?.summary ?? {};
      const m = s.movements_created ?? 0;
      const p = s.pending_items_created ?? 0;
      const r = s.reversals_created ?? 0;
      const items = s.items_checked ?? 0;
      if (m === 0 && p > 0) {
        toast.warning(`Procesamiento completado: ${items} ítems revisados. 0 movimientos generados porque ${p} requieren asociación o costo. Revisa la pestaña Pendientes.`);
      } else {
        toast.success(`Procesamiento completado: ${m} movimientos, ${p} pendientes, ${r} reversos.`);
      }
      load();
    } catch (e: any) {
      toast.error(`Error: ${e.message ?? e}`);
    } finally {
      setProcessing(false);
    }
  }


  function openManual() {
    const general = funds.find(f => f.fund_type === "general");
    setForm({
      movement_type: "manual_increase",
      fund_id: general?.id ?? funds[0]?.id ?? "",
      target_fund_id: "",
      amount: "",
      reason: "",
      notes: "",
    });
    setManualOpen(true);
  }

  async function saveManual() {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("El monto debe ser positivo");
    if (!form.reason.trim()) return toast.error("Motivo obligatorio");
    if (!form.fund_id) return toast.error("Selecciona partida");
    if (form.movement_type === "transfer" && !form.target_fund_id) return toast.error("Selecciona partida destino");

    const fund = funds.find(f => f.id === form.fund_id)!;
    const { data: { user } } = await supabase.auth.getUser();

    try {
      if (form.movement_type === "manual_increase") {
        const { data: mov, error } = await supabase.from("core_fabrication_fund_movements").insert({
          fund_id: fund.id, movement_type: "manual_increase", source: "manual",
          amount: amt, currency: fund.currency, reason: form.reason, notes: form.notes,
          status: "posted", created_by: user?.id ?? null,
        }).select().single();
        if (error) throw error;
        await supabase.from("core_fabrication_funds").update({ available_amount: Number(fund.available_amount) + amt }).eq("id", fund.id);
        await logCoreAudit({ table: "core_fabrication_fund_movements", recordId: mov?.id, action: "manual_increase_fund", newValue: { amount: amt, reason: form.reason } });
      } else if (form.movement_type === "manual_decrease") {
        const { data: mov, error } = await supabase.from("core_fabrication_fund_movements").insert({
          fund_id: fund.id, movement_type: "manual_decrease", source: "manual",
          amount: -amt, currency: fund.currency, reason: form.reason, notes: form.notes,
          status: "posted", created_by: user?.id ?? null,
        }).select().single();
        if (error) throw error;
        await supabase.from("core_fabrication_funds").update({ available_amount: Number(fund.available_amount) - amt }).eq("id", fund.id);
        await logCoreAudit({ table: "core_fabrication_fund_movements", recordId: mov?.id, action: "manual_decrease_fund", newValue: { amount: amt, reason: form.reason } });
      } else if (form.movement_type === "transfer") {
        const target = funds.find(f => f.id === form.target_fund_id)!;
        const { data: out, error: e1 } = await supabase.from("core_fabrication_fund_movements").insert({
          fund_id: fund.id, movement_type: "transfer", source: "manual",
          amount: -amt, currency: fund.currency, reason: `Transferencia a ${target.name}: ${form.reason}`, notes: form.notes,
          status: "posted", created_by: user?.id ?? null,
        }).select().single();
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("core_fabrication_fund_movements").insert({
          fund_id: target.id, movement_type: "transfer", source: "manual",
          amount: amt, currency: target.currency, reason: `Transferencia desde ${fund.name}: ${form.reason}`, notes: form.notes,
          related_movement_id: out?.id ?? null,
          status: "posted", created_by: user?.id ?? null,
        });
        if (e2) throw e2;
        await supabase.from("core_fabrication_funds").update({ available_amount: Number(fund.available_amount) - amt }).eq("id", fund.id);
        await supabase.from("core_fabrication_funds").update({ available_amount: Number(target.available_amount) + amt }).eq("id", target.id);
        await logCoreAudit({ table: "core_fabrication_fund_movements", recordId: out?.id, action: "transfer_fund", newValue: { from: fund.name, to: target.name, amount: amt } });
      } else if (form.movement_type === "correction") {
        const { data: mov, error } = await supabase.from("core_fabrication_fund_movements").insert({
          fund_id: fund.id, movement_type: "correction", source: "manual",
          amount: amt, currency: fund.currency, reason: form.reason, notes: form.notes,
          status: "posted", created_by: user?.id ?? null,
        }).select().single();
        if (error) throw error;
        await supabase.from("core_fabrication_funds").update({ available_amount: Number(fund.available_amount) + amt }).eq("id", fund.id);
        await logCoreAudit({ table: "core_fabrication_fund_movements", recordId: mov?.id, action: "correction_fund", newValue: { amount: amt, reason: form.reason } });
      } else if (form.movement_type === "close") {
        await supabase.from("core_fabrication_funds").update({ status: "closed" }).eq("id", fund.id);
        await supabase.from("core_fabrication_fund_movements").insert({
          fund_id: fund.id, movement_type: "close", source: "manual",
          amount: 0, currency: fund.currency, reason: form.reason, notes: form.notes,
          status: "posted", created_by: user?.id ?? null,
        });
        await logCoreAudit({ table: "core_fabrication_funds", recordId: fund.id, action: "close_fund", newValue: { reason: form.reason } });
      }
      toast.success("Ajuste registrado");
      setManualOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    }
  }

  async function resolvePending(p: Pending, status: "ignored" | "review") {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("core_fabrication_fund_pending_items")
      .update({ status, resolved_at: status === "ignored" ? new Date().toISOString() : null, resolved_by: user?.id ?? null })
      .eq("id", p.id);
    await logCoreAudit({ table: "core_fabrication_fund_pending_items", recordId: p.id, action: "resolve_pending", newValue: { status } });
    toast.success("Actualizado");
    load();
  }

  function downloadReport() {
    const rows = [
      ["fecha", "tipo", "partida", "sku", "producto", "pedido", "item", "qty", "costo_unit", "monto", "moneda", "origen", "motivo", "estado"],
      ...movements.map(m => {
        const f = funds.find(x => x.id === m.fund_id);
        return [
          m.created_at, MOV_LABEL[m.movement_type] ?? m.movement_type,
          f ? FUND_LABEL[f.fund_type] : "—", m.sku ?? "", m.product_name ?? "",
          m.source_order_id ?? "", m.source_order_item_id ?? "",
          m.quantity ?? "", m.unit_cost_snapshot ?? "",
          m.amount, m.currency, m.source, (m.reason ?? "").replace(/\n/g, " "), m.status,
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partidas-fabricacion-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Partidas de Fabricación</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Control del fondo reservado para fabricar productos vendidos, reponer stock o reemplazar productos no restockeables.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col">
            <Label className="text-[10px] uppercase text-muted-foreground">Desde</Label>
            <Input type="date" className="h-9 w-[150px]" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <Label className="text-[10px] uppercase text-muted-foreground">Hasta</Label>
            <Input type="date" className="h-9 w-[150px]" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
          </div>
          <Button onClick={processSales} disabled={processing}>
            <Play className="h-4 w-4 mr-1" />{processing ? "Procesando…" : "Procesar ventas confirmadas"}
          </Button>
          <Button variant="outline" onClick={openManual}><Plus className="h-4 w-4 mr-1" />Nuevo ajuste manual</Button>
          <Button variant="outline" onClick={downloadReport}><Download className="h-4 w-4 mr-1" />Generar reporte</Button>
        </div>

      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="resumen"><Wallet className="h-3.5 w-3.5 mr-1.5" />Resumen</TabsTrigger>
          <TabsTrigger value="partidas"><Layers className="h-3.5 w-3.5 mr-1.5" />Partidas</TabsTrigger>
          <TabsTrigger value="movimientos"><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Movimientos</TabsTrigger>
          <TabsTrigger value="pendientes"><AlertCircle className="h-3.5 w-3.5 mr-1.5" />Pendientes ({pendings.filter(p => p.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="procesamientos"><History className="h-3.5 w-3.5 mr-1.5" />Procesamientos</TabsTrigger>
        </TabsList>

        {/* RESUMEN */}
        <TabsContent value="resumen" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Partida general disponible" value={usd(totals.general)} tone="emerald" />
            <KpiCard label="Partida no restockeable" value={usd(totals.nonR)} tone="orange" />
            <KpiCard label="Pendientes históricos" value={`${totals.pendingHist} ítems`} tone="yellow" />
            <KpiCard label="Pendientes último run" value={String(totals.lastRunPend)} tone="muted" />
            <KpiCard label="Pendientes del rango" value={`${totals.rangeCount} ítems`} sub={usd(totals.rangeRevenue) + " revenue"} tone="yellow" />
            <KpiCard label="Movimientos totales" value={String(movements.length)} tone="muted" />
            <KpiCard label="Ventas procesadas" value={String(totals.sales)} tone="muted" />
            <KpiCard label="Último procesamiento" value={totals.lastRun ? new Date(totals.lastRun.created_at).toLocaleString() : "—"} tone="muted" />
          </div>
        </TabsContent>

        {/* PARTIDAS */}
        <TabsContent value="partidas" className="mt-4">
          <Card className="p-4">
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actualizada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                  ) : funds.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin partidas.</TableCell></TableRow>
                  ) : funds.map(f => (
                    <TableRow key={f.id}>
                      <TableCell><Badge variant="outline" className={FUND_BADGE[f.fund_type] ?? ""}>{FUND_LABEL[f.fund_type] ?? f.fund_type}</Badge></TableCell>
                      <TableCell className="text-sm">{f.name}</TableCell>
                      <TableCell className="font-mono text-xs">{f.sku ?? "—"}</TableCell>
                      <TableCell className="font-mono text-right">{usd(f.available_amount)}</TableCell>
                      <TableCell className="text-xs">{f.currency}</TableCell>
                      <TableCell><Badge variant="outline">{f.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(f.updated_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* MOVIMIENTOS */}
        <TabsContent value="movimientos" className="mt-4">
          <Card className="p-4">
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Partida</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Origen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                  ) : movements.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Sin movimientos.</TableCell></TableRow>
                  ) : movements.map(m => {
                    const f = funds.find(x => x.id === m.fund_id);
                    const isManual = m.source === "manual";
                    return (
                      <TableRow key={m.id} className={isManual ? "bg-yellow-50/40 dark:bg-yellow-950/10" : ""}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className={MOV_BADGE[m.movement_type] ?? ""}>{MOV_LABEL[m.movement_type] ?? m.movement_type}</Badge></TableCell>
                        <TableCell className="text-xs">{f ? FUND_LABEL[f.fund_type] : "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{m.sku ?? "—"}</TableCell>
                        <TableCell className="text-xs truncate max-w-[200px]">{m.product_name ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{m.source_order_id ? `#${m.source_order_id}` : "—"}</TableCell>
                        <TableCell className="text-right text-xs">{m.quantity ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{m.unit_cost_snapshot ? usd(m.unit_cost_snapshot) : "—"}</TableCell>
                        <TableCell className={`text-right font-mono ${Number(m.amount) < 0 ? "text-destructive" : "text-emerald-700"}`}>{usd(m.amount)}</TableCell>
                        <TableCell className="text-xs">{m.source}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* PENDIENTES - Centro de Resolución */}
        <TabsContent value="pendientes" className="mt-4">
          <PendingResolutionPanel onChanged={load} />
        </TabsContent>

        {/* PROCESAMIENTOS */}
        <TabsContent value="procesamientos" className="mt-4">
          <Card className="p-4">
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Ítems</TableHead>
                    <TableHead className="text-right">Movs.</TableHead>
                    <TableHead className="text-right">Pendientes</TableHead>
                    <TableHead className="text-right">Reversos</TableHead>
                    <TableHead className="text-right">Errores</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                  ) : runs.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin procesamientos.</TableCell></TableRow>
                  ) : runs.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell className="text-right text-xs font-mono">{r.orders_checked}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{r.items_checked}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{r.movements_created}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{r.pending_items_created}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{r.reversals_created}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{r.errors_count}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setRunDetail(r)}>Ver detalle</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>

              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* RUN DETAIL DIALOG */}
      <Dialog open={!!runDetail} onOpenChange={(o) => !o && setRunDetail(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Procesamiento {runDetail ? new Date(runDetail.created_at).toLocaleString() : ""}
            </DialogTitle>
          </DialogHeader>
          {runDetail && (() => {
            const runMovs = movements.filter(m => m.fabrication_fund_run_id === runDetail.id);
            const runPends = pendings.filter(p => p.fabrication_fund_run_id === runDetail.id);
            const reversals = runMovs.filter(m => m.movement_type === "reversal");
            const sales = runMovs.filter(m => m.movement_type.startsWith("sale_generated"));
            const errors: any[] = (runDetail.summary?.errors ?? []) as any[];
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                  <Card className="p-2"><div className="text-muted-foreground">Estado</div><div className="font-semibold">{runDetail.status}</div></Card>
                  <Card className="p-2"><div className="text-muted-foreground">Movs creados</div><div className="font-semibold">{runDetail.movements_created}</div></Card>
                  <Card className="p-2"><div className="text-muted-foreground">Pendientes</div><div className="font-semibold">{runDetail.pending_items_created}</div></Card>
                  <Card className="p-2"><div className="text-muted-foreground">Reversos</div><div className="font-semibold">{runDetail.reversals_created}</div></Card>
                  <Card className="p-2"><div className="text-muted-foreground">Errores</div><div className="font-semibold">{runDetail.errors_count}</div></Card>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-1">Ventas / movimientos ({sales.length})</h3>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>SKU</TableHead><TableHead>Producto</TableHead><TableHead>Pedido</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {sales.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-3 text-xs text-muted-foreground">Sin movimientos</TableCell></TableRow> :
                          sales.map(m => (
                            <TableRow key={m.id}>
                              <TableCell><Badge variant="outline" className={MOV_BADGE[m.movement_type] ?? ""}>{MOV_LABEL[m.movement_type] ?? m.movement_type}</Badge></TableCell>
                              <TableCell className="font-mono text-xs">{m.sku ?? "—"}</TableCell>
                              <TableCell className="text-xs">{m.product_name ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">#{m.source_order_id}</TableCell>
                              <TableCell className="text-right font-mono text-xs">{usd(m.amount)}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-1">Reversos ({reversals.length})</h3>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Producto</TableHead><TableHead>Pedido</TableHead><TableHead>Motivo</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {reversals.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-3 text-xs text-muted-foreground">Sin reversos</TableCell></TableRow> :
                          reversals.map(m => (
                            <TableRow key={m.id}>
                              <TableCell className="font-mono text-xs">{m.sku ?? "—"}</TableCell>
                              <TableCell className="text-xs">{m.product_name ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">#{m.source_order_id}</TableCell>
                              <TableCell className="text-xs">{m.reason ?? "—"}</TableCell>
                              <TableCell className="text-right font-mono text-xs text-destructive">{usd(m.amount)}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-1">Pendientes ({runPends.length})</h3>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>SKU</TableHead><TableHead>Producto</TableHead><TableHead>Motivo</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {runPends.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-3 text-xs text-muted-foreground">Sin pendientes</TableCell></TableRow> :
                          runPends.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs">#{p.source_order_id}</TableCell>
                              <TableCell className="font-mono text-xs">{p.woo_sku ?? "—"}</TableCell>
                              <TableCell className="text-xs">{p.product_name ?? "—"}</TableCell>
                              <TableCell className="text-xs">{PENDING_REASON_LABEL[p.reason] ?? p.reason}</TableCell>
                              <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-1">Errores ({errors.length})</h3>
                  {errors.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin errores.</p>
                  ) : (
                    <pre className="text-[11px] bg-muted/40 p-2 rounded overflow-x-auto max-h-48">{JSON.stringify(errors, null, 2)}</pre>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDetail(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* MANUAL ADJUST DIALOG */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo ajuste manual</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Tipo de movimiento *</Label>
              <Select value={form.movement_type} onValueChange={v => setForm({ ...form, movement_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual_increase">Aumentar partida</SelectItem>
                  <SelectItem value="manual_decrease">Disminuir partida</SelectItem>
                  <SelectItem value="transfer">Transferir entre partidas</SelectItem>
                  <SelectItem value="correction">Corrección manual</SelectItem>
                  <SelectItem value="close">Cerrar partida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>{form.movement_type === "transfer" ? "Partida origen *" : "Partida *"}</Label>
              <Select value={form.fund_id} onValueChange={v => setForm({ ...form, fund_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona partida" /></SelectTrigger>
                <SelectContent>
                  {funds.map(f => <SelectItem key={f.id} value={f.id}>{FUND_LABEL[f.fund_type]} — {f.name} ({usd(f.available_amount)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.movement_type === "transfer" && (
              <div className="col-span-2">
                <Label>Partida destino *</Label>
                <Select value={form.target_fund_id} onValueChange={v => setForm({ ...form, target_fund_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona destino" /></SelectTrigger>
                  <SelectContent>
                    {funds.filter(f => f.id !== form.fund_id).map(f => <SelectItem key={f.id} value={f.id}>{FUND_LABEL[f.fund_type]} — {f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.movement_type !== "close" && (
              <div className="col-span-2">
                <Label>Monto (positivo) *</Label>
                <Input type="number" min={0} step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
            )}
            <div className="col-span-2">
              <Label>Motivo *</Label>
              <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Observaciones</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={saveManual}>Registrar ajuste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "emerald" | "orange" | "yellow" | "muted" }) {
  const toneCls = {
    emerald: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20",
    orange: "bg-orange-50 border-orange-200 dark:bg-orange-950/20",
    yellow: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20",
    muted: "bg-muted/30 border-border",
  }[tone];
  return (
    <Card className={`p-4 ${toneCls}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-xl font-black mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}
