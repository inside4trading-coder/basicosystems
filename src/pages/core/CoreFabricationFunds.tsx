import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Layers, Play, Plus, Download, RotateCcw, Wallet, AlertCircle, History, ListChecks, ExternalLink, Scale } from "lucide-react";
import { toast } from "sonner";
import { logCoreAudit } from "@/lib/coreAudit";
import PendingResolutionPanel from "@/components/core/PendingResolutionPanel";
import {
  CONFIRMED_STATUSES, RECON_BASELINE, CLOSED_PENDING_STATUSES,
  isShippingLike, classifyLine, veRangeToUtc, veRangeBounds, formatVE,
  rowsToCsv, downloadCsv, chunk,
  RESULT_LABEL, RESULT_BADGE, type ReconRow,
} from "@/lib/coreReconciliation";

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
  fund_bucket: string | null;
  woo_product_id: number | null;
  woo_variation_id: number | null;
  cost_snapshot_data: any;
  production_order_id?: string | null;
  metadata?: any;
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
  period_start: string | null; period_end: string | null;
  orders_checked: number; items_checked: number; movements_created: number;
  pending_items_created: number; reversals_created: number; errors_count: number;
  summary: any;
};


const FUND_LABEL: Record<string, string> = {
  general: "General de fabricación",
  non_restockable: "Liberado por no restock",
  product_specific: "Por producto",
  replacement: "Reemplazo",
  pending: "Pendiente",
};
const FUND_BADGE: Record<string, string> = {
  general: "bg-emerald-100 text-emerald-800 border-emerald-300",
  non_restockable: "bg-teal-100 text-teal-800 border-teal-300",
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
  replacement_cost_adjustment: "Ajuste por reemplazo",
  replacement_reclassification_out: "Salida por reclasificación",
  replacement_reclassification_in: "Entrada por reclasificación",
  external_supplier_payment: "Pago a proveedor externo",
  production_allocated: "Asignado a OP",
  production_released: "Liberado de OP",
  production_executed: "Producción ejecutada",
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
  replacement_cost_adjustment: "bg-indigo-100 text-indigo-800 border-indigo-300",
  replacement_reclassification_out: "bg-purple-100 text-purple-800 border-purple-300",
  replacement_reclassification_in: "bg-purple-100 text-purple-800 border-purple-300",
  external_supplier_payment: "bg-rose-100 text-rose-800 border-rose-300",
  production_allocated: "bg-amber-100 text-amber-800 border-amber-300",
  production_released: "bg-emerald-100 text-emerald-800 border-emerald-300",
  production_executed: "bg-slate-100 text-slate-800 border-slate-300",
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

// Fecha base desde la cual se reinició el procesamiento de Partidas de Fabricación.
// No se permite procesar ni seleccionar rangos anteriores a esta fecha.
const BASELINE_DATE = "2026-07-27";
const BASELINE_DATE_LABEL = "27/07/2026";
const todayLocalISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const formatDDMMYYYY = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

type ProdUnit = { id: string; sku: string | null; variant_sku: string | null; status: string };

const normSku = (s: string | null | undefined) =>
  (s ?? "").toString().trim().toUpperCase().replace(/\s+/g, "-").replace(/-+/g, "-");

export default function CoreFabricationFunds() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("resumen");
  const [funds, setFunds] = useState<Fund[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [pendings, setPendings] = useState<Pending[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [units, setUnits] = useState<ProdUnit[]>([]);
  const [prodOrders, setProdOrders] = useState<Array<{ id: string; order_code: string | null; status: string }>>([]);
  const [movFilter, setMovFilter] = useState<"all" | "pending_classification" | "external_supplier" | "production">("all");
  const [reconEvents, setReconEvents] = useState<any[]>([]);
  const [reconFilter, setReconFilter] = useState<"all" | "positive" | "negative" | "reclass" | "pending">("all");
  const [reconSearch, setReconSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [runDetail, setRunDetail] = useState<Run | null>(null);
  const [periodStart, setPeriodStart] = useState<string>(BASELINE_DATE);
  const [periodEnd, setPeriodEnd] = useState<string>(todayLocalISO());
  const [missingDaysOpen, setMissingDaysOpen] = useState(false);
  const [reconOpen, setReconOpen] = useState(false);
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
    const [{ data: f }, { data: m }, { data: p }, { data: r }, { data: u }, { data: ev }, { data: po }] = await Promise.all([
      supabase.from("core_fabrication_funds").select("*").order("fund_type"),
      supabase.from("core_fabrication_fund_movements").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("core_fabrication_fund_pending_items").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("core_fabrication_fund_runs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("core_production_units").select("id, sku, variant_sku, status").limit(5000),
      supabase.from("core_replenishment_policy_events" as any)
        .select("id, created_at, action, status, resolution_data, core_product_id, replacement_product_id, woo_product_id, replacement_woo_product_id, core_variant_id")
        .eq("action", "suggest_replacement")
        .in("status", ["resolved", "applied", "reviewed"])
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("core_production_orders").select("id, order_code, status").limit(2000),
    ]);
    setFunds((f as any) ?? []);
    setMovements((m as any) ?? []);
    setPendings((p as any) ?? []);
    setRuns((r as any) ?? []);
    setUnits((u as any) ?? []);
    setReconEvents((ev as any) ?? []);
    setProdOrders((po as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Deep-link: /core/partidas-fabricacion?mov=external abre movimientos externos.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("mov") === "external") {
      setMovFilter("external_supplier");
      setTab("movimientos");
    }
  }, []);


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

    // === Asignación real a órdenes de producción ===
    const ACTIVE_OP = new Set(["open", "in_production", "partially_completed"]);
    const DONE_OP = new Set(["closed", "completed", "manually_closed"]);
    const orderStatusById = new Map(prodOrders.map(o => [o.id, o.status]));
    let allocatedActive = 0;
    let allocatedDone = 0;
    for (const m of movements) {
      if (m.movement_type !== "production_allocated" || m.status !== "posted") continue;
      const st = m.production_order_id ? orderStatusById.get(m.production_order_id) : undefined;
      const amt = Math.abs(Number(m.amount) || 0);
      if (st && ACTIVE_OP.has(st)) allocatedActive += amt;
      else if (st && DONE_OP.has(st)) allocatedDone += amt;
    }
    const executedProduction = movements
      .filter(m => m.movement_type === "production_executed" && m.status === "posted")
      .reduce((s, m) => s + Math.abs(Number(m.metadata?.executed_amount ?? 0)), 0);
    const availableReal = general - allocatedActive;

    return {
      general, nonR, pendingHist, lastRunPend, rangeCount, rangeRevenue, sales, reversals, manuals, lastRun,
      generatedTotal, executedTotal, availableUnassigned,
      allocatedActive, allocatedDone, executedProduction: executedProduction || allocatedDone, availableReal,
    };
  }, [funds, pendings, movements, runs, periodStart, periodEnd, units, prodOrders]);

  // === Partidas principales (cards) ===
  const partidaCards = useMemo(() => {
    const pick = (t: string) => funds.find(f => f.fund_type === t && f.currency === "USD" && !f.core_product_id) ?? null;
    const factory = pick("general");
    const external = pick("external_supplier");
    const pending = pick("pending");
    const nonRestock = pick("non_restockable");
    const movsBy = (fundId?: string | null) => movements.filter(m => fundId && m.fund_id === fundId);
    const last = (list: Movement[]) => list.length ? list[0].created_at : null;
    return {
      factory: { fund: factory, count: movsBy(factory?.id).length, last: last(movsBy(factory?.id)) },
      external: { fund: external, count: movsBy(external?.id).length, last: last(movsBy(external?.id)) },
      pending: { fund: pending, count: movsBy(pending?.id).length, last: last(movsBy(pending?.id)) },
      nonRestock: { fund: nonRestock, count: movsBy(nonRestock?.id).length, last: last(movsBy(nonRestock?.id)) },
    };
  }, [funds, movements]);

  // === Conciliaciones de reemplazos ===
  const reconciliation = useMemo(() => {
    const posMovs = movements.filter(m => m.movement_type === "replacement_cost_adjustment" && Number(m.amount) > 0);
    const negMovs = movements.filter(m => m.movement_type === "replacement_cost_adjustment" && Number(m.amount) < 0);
    const reclassMovs = movements.filter(m => m.movement_type === "replacement_reclassification_out");
    const positives = posMovs.reduce((s, m) => s + Number(m.amount), 0);
    const negatives = negMovs.reduce((s, m) => s + Math.abs(Number(m.amount)), 0);
    const net = positives - negatives;
    const reclassified = reclassMovs.reduce((s, m) => s + Math.abs(Number(m.amount)), 0);
    let conciliated = 0;
    let pendingRec = 0;
    for (const ev of reconEvents) {
      const fin = ev?.resolution_data?.financial_reconciliation;
      if (fin && fin.status === "posted") conciliated += 1;
      else pendingRec += 1;
    }
    return { positives, negatives, net, reclassified, conciliated, pendingRec };
  }, [movements, reconEvents]);

  // === Control de días saltados ===
  // Un día se considera "cerrado" si está cubierto por el rango de período de
  // al menos un run exitoso. El rango se normaliza a hora Venezuela (-04:00),
  // igual que el resto del módulo de Partidas.
  const SUCCESS_RUN_STATUSES = new Set(["completed", "completed_warnings", "success", "posted"]);
  const toVenezuelaDateISO = (dt: string | Date) => {
    const d = new Date(dt);
    // Restar 4 horas para llevar UTC a hora Venezuela (zona del backend de Partidas).
    const v = new Date(d.getTime() - 4 * 60 * 60 * 1000);
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  };
  const missingDays = useMemo(() => {
    const closed = new Set<string>();
    for (const r of runs) {
      if (!SUCCESS_RUN_STATUSES.has(r.status)) continue;
      if (!r.period_start || !r.period_end) continue;
      let cur = toVenezuelaDateISO(r.period_start);
      const end = toVenezuelaDateISO(r.period_end);
      // Salimos si el período no es parseable (defensivo).
      if (!cur || !end || cur === "Invalid Date" || end === "Invalid Date") continue;
      while (cur <= end) {
        if (cur >= BASELINE_DATE) closed.add(cur);
        cur = addDaysISO(cur, 1);
      }
    }
    const today = todayLocalISO();
    const yesterday = addDaysISO(today, -1);
    if (yesterday < BASELINE_DATE) return [] as string[];
    const out: string[] = [];
    let cur = BASELINE_DATE;
    while (cur <= yesterday) {
      if (!closed.has(cur)) out.push(cur);
      cur = addDaysISO(cur, 1);
    }
    return out;
  }, [runs]);


  function handleStartChange(v: string) {
    if (v && v < BASELINE_DATE) {
      toast.error(`Las partidas fueron reiniciadas. El nuevo procesamiento empieza desde ${BASELINE_DATE_LABEL}.`);
      setPeriodStart(BASELINE_DATE);
      return;
    }
    setPeriodStart(v);
  }
  function handleEndChange(v: string) {
    if (v && v < BASELINE_DATE) {
      toast.error(`Las partidas fueron reiniciadas. El nuevo procesamiento empieza desde ${BASELINE_DATE_LABEL}.`);
      return;
    }
    setPeriodEnd(v);
  }
  function fillNextPendingDay() {
    if (missingDays.length === 0) return;
    const d = missingDays[0];
    setPeriodStart(d);
    setPeriodEnd(d);
    toast.info(`Rango preparado para ${formatDDMMYYYY(d)}. Presiona "Procesar ventas confirmadas" para ejecutar.`);
  }




  async function processSales() {
    // Bloqueo: no procesar fechas anteriores a BASELINE_DATE.
    if (periodStart && periodStart < BASELINE_DATE) {
      toast.error(`Las partidas fueron reiniciadas. El nuevo procesamiento empieza desde ${BASELINE_DATE_LABEL}.`);
      return;
    }
    // Bloqueo anti-salto: si hay un día pendiente anterior a periodStart, no procesar.
    if (missingDays.length > 0 && periodStart) {
      const firstPending = missingDays[0];
      if (periodStart > firstPending) {
        toast.error(`No puedes procesar el ${formatDDMMYYYY(periodStart)} porque el ${formatDDMMYYYY(firstPending)} aún no fue cerrado.`);
        return;
      }
    }
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
    const formatCsvNumber = (v: unknown, decimals = 4): string => {
      if (v === null || v === undefined || v === "") return "";
      const n = Number(v);
      if (!Number.isFinite(n)) return "";
      return n.toFixed(decimals).replace(".", ",");
    };
    const escapeCsvText = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (/[";\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    type Cell = { n?: unknown; t?: unknown };
    const header = ["fecha", "tipo", "partida", "sku", "producto", "pedido", "item", "qty", "costo_unit", "monto", "moneda", "origen", "motivo", "estado"];
    const dataRows: Cell[][] = movements.map(m => {
      const f = funds.find(x => x.id === m.fund_id);
      return [
        { t: m.created_at },
        { t: MOV_LABEL[m.movement_type] ?? m.movement_type },
        { t: f ? FUND_LABEL[f.fund_type] : "—" },
        { t: m.sku ?? "" },
        { t: m.product_name ?? "" },
        { t: m.source_order_id ?? "" },
        { t: m.source_order_item_id ?? "" },
        { n: m.quantity ?? "" },
        { n: m.unit_cost_snapshot ?? "" },
        { n: m.amount },
        { t: m.currency },
        { t: m.source },
        { t: (m.reason ?? "").replace(/\n/g, " ") },
        { t: m.status },
      ];
    });
    const lines: string[] = [];
    lines.push("sep=;");
    lines.push(header.map(escapeCsvText).join(";"));
    for (const row of dataRows) {
      lines.push(row.map(cell => "n" in cell ? formatCsvNumber(cell.n) : escapeCsvText(cell.t)).join(";"));
    }
    const csv = lines.join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
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
            <Input type="date" className="h-9 w-[150px]" min={BASELINE_DATE} value={periodStart} onChange={e => handleStartChange(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <Label className="text-[10px] uppercase text-muted-foreground">Hasta</Label>
            <Input type="date" className="h-9 w-[150px]" min={BASELINE_DATE} value={periodEnd} onChange={e => handleEndChange(e.target.value)} />
          </div>
          <Button onClick={processSales} disabled={processing}>
            <Play className="h-4 w-4 mr-1" />{processing ? "Procesando…" : "Procesar ventas confirmadas"}
          </Button>
          <Button variant="outline" onClick={() => setReconOpen(true)}>
            <Scale className="h-4 w-4 mr-1" />Conciliar rango
          </Button>
          {missingDays.length > 0 && (
            <Button variant="outline" onClick={fillNextPendingDay} title="Prepara el rango con el primer día pendiente">
              Procesar próximo día pendiente
            </Button>
          )}
          <Button variant="outline" onClick={openManual}><Plus className="h-4 w-4 mr-1" />Nuevo ajuste manual</Button>
          <Button variant="outline" onClick={downloadReport}><Download className="h-4 w-4 mr-1" />Generar reporte</Button>
        </div>

      </div>

      {missingDays.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-destructive">
                Hay días sin cerrar en Partidas. Esto puede dejar dinero de costo sin reservar.
              </p>
              <p className="text-xs text-destructive/80 mt-1">
                {missingDays.length} día{missingDays.length === 1 ? "" : "s"} pendiente{missingDays.length === 1 ? "" : "s"} desde {BASELINE_DATE_LABEL}: {missingDays.slice(0, 6).map(formatDDMMYYYY).join(", ")}{missingDays.length > 6 ? `, … (+${missingDays.length - 6})` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setMissingDaysOpen(true)}>Ver días pendientes</Button>
          </div>
        </div>
      )}


      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="resumen"><Wallet className="h-3.5 w-3.5 mr-1.5" />Resumen</TabsTrigger>
          <TabsTrigger value="partidas"><Layers className="h-3.5 w-3.5 mr-1.5" />Partidas</TabsTrigger>
          <TabsTrigger value="movimientos"><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Movimientos</TabsTrigger>
          <TabsTrigger value="pendientes"><AlertCircle className="h-3.5 w-3.5 mr-1.5" />Pendientes ({pendings.filter(p => p.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="procesamientos"><History className="h-3.5 w-3.5 mr-1.5" />Procesamientos</TabsTrigger>
          <TabsTrigger value="conciliacion"><ListChecks className="h-3.5 w-3.5 mr-1.5" />Conciliación ({reconciliation.conciliated + reconciliation.pendingRec})</TabsTrigger>
        </TabsList>

        {/* RESUMEN */}
        <TabsContent value="resumen" className="space-y-4 mt-4">
          {/* Cierre diario */}
          <Card className={`p-4 border ${missingDays.length === 0 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20" : "bg-destructive/10 border-destructive/40"}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Cierre diario</p>
                <p className={`text-sm font-semibold mt-1 ${missingDays.length === 0 ? "text-emerald-800 dark:text-emerald-300" : "text-destructive"}`}>
                  {missingDays.length === 0
                    ? `Todo cerrado desde ${BASELINE_DATE_LABEL}.`
                    : `${missingDays.length} día${missingDays.length === 1 ? "" : "s"} sin cerrar.`}
                </p>
                {missingDays.length > 0 && (
                  <p className="text-xs text-destructive/80 mt-1">
                    Primer pendiente: <strong>{formatDDMMYYYY(missingDays[0])}</strong>
                  </p>
                )}
              </div>
              {missingDays.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setMissingDaysOpen(true)}>Ver días pendientes</Button>
              )}
            </div>
          </Card>

          {/* Disponible interno total */}
          <Card className="p-4 border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Disponible real sin asignar</p>
            <p className="text-3xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
              {usd(totals.availableReal + Number(partidaCards.nonRestock.fund?.available_amount ?? 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              General de fabricación <strong className="font-mono">{usd(totals.general)}</strong>
              {" − "}
              Asignado a OP activas <strong className="font-mono">{usd(totals.allocatedActive)}</strong>
              {" + "}
              Liberado por no restock <strong className="font-mono">{usd(Number(partidaCards.nonRestock.fund?.available_amount ?? 0))}</strong>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 italic">
              Proveedor externo y pendiente por resolver se contabilizan aparte.
            </p>
          </Card>


          {/* Cards de las partidas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">

            <PartidaCard
              title="General de fabricación"
              description="Producción habitual: reserva destinada a fabricación interna."
              fund={partidaCards.factory.fund}
              movementsCount={partidaCards.factory.count}
              lastMovementAt={partidaCards.factory.last}
              tone="emerald"
            />
            <PartidaCard
              title="Liberado por no restock"
              description="Dinero reservado de prendas que no se repondrán, disponible para futuras fabricaciones."
              fund={partidaCards.nonRestock.fund}
              movementsCount={partidaCards.nonRestock.count}
              lastMovementAt={partidaCards.nonRestock.last}
              tone="emerald"
            />
            <PartidaCard
              title="Proveedores externos"
              description="Reserva destinada a compras y reposición externa."
              fund={partidaCards.external.fund}
              movementsCount={partidaCards.external.count}
              lastMovementAt={partidaCards.external.last}
              tone="blue"
              onClick={() => { setMovFilter("external_supplier"); setTab("movimientos"); }}
            />
            <PartidaCard
              title="Pendiente por resolver"
              description="Dinero reservado cuyo origen financiero todavía debe definirse."
              fund={partidaCards.pending.fund}
              movementsCount={partidaCards.pending.count}
              lastMovementAt={partidaCards.pending.last}
              tone="yellow"
              alertWhenPositive
              onClick={() => { setMovFilter("pending_classification"); setTab("movimientos"); }}
            />
          </div>


          <p className="text-[11px] text-muted-foreground italic">
            Estos saldos representan reservas registradas. Los pagos externos todavía no se descuentan automáticamente.
          </p>

          {/* Resumen de reemplazos */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Conciliación de reemplazos
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <KpiCard label="Reemplazos conciliados" value={String(reconciliation.conciliated)} tone="emerald" />
              <KpiCard label="Conciliaciones pendientes" value={String(reconciliation.pendingRec)} tone="yellow" />
              <KpiCard label="Ajustes positivos" value={usd(reconciliation.positives)} tone="muted" />
              <KpiCard label="Ajustes negativos" value={usd(reconciliation.negatives)} tone="muted" />
              <KpiCard label="Ajuste neto" value={usd(reconciliation.net)} tone={reconciliation.net >= 0 ? "emerald" : "orange"} />
              <KpiCard label="Reclasificado entre partidas" value={usd(reconciliation.reclassified)} tone="muted" />
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Partida generada" value={usd(totals.generatedTotal)} sub="Ventas confirmadas posted" tone="emerald" />
            <KpiCard label="Asignado a OP" value={usd(totals.allocatedActive)} sub="OP abiertas / en producción" tone="orange" />
            <KpiCard label="Ejecutado" value={usd(totals.executedProduction)} sub="OP completadas o cerradas" tone="muted" />
            <KpiCard label="Disponible real sin asignar" value={usd(totals.availableReal)} sub="General − asignado a OP" tone="emerald" />
            <KpiCard label="Liberado por no restock" value={usd(totals.nonR)} sub="Disponible para futuras fabricaciones" tone="emerald" />
            <KpiCard label="Ejecutado en inventario" value={usd(totals.executedTotal)} sub="Unidades ya ingresadas" tone="muted" />

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
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs">Filtro rápido:</Label>
              <Select value={movFilter} onValueChange={(v: any) => setMovFilter(v)}>
                <SelectTrigger className="h-9 w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los movimientos</SelectItem>
                  <SelectItem value="pending_classification">Pendiente de clasificación</SelectItem>
                  <SelectItem value="external_supplier">Proveedores externos</SelectItem>
                </SelectContent>
              </Select>
              {movFilter !== "all" && (
                <Button size="sm" variant="ghost" onClick={() => setMovFilter("all")}>Limpiar</Button>
              )}
            </div>
            {(() => {
              const pendingFundId = partidaCards.pending.fund?.id ?? null;
              const externalFundId = partidaCards.external.fund?.id ?? null;
              const filtered = movements.filter(m => {
                if (movFilter === "all") return true;
                if (movFilter === "external_supplier") {
                  return m.fund_bucket === "external_supplier" || (externalFundId && m.fund_id === externalFundId);
                }
                return m.fund_bucket === "pending_classification" || (pendingFundId && m.fund_id === pendingFundId);
              });
              const total = filtered.reduce((s, m) => s + Number(m.amount || 0), 0);
              return (
                <>
                  {movFilter === "pending_classification" && (
                    <div className="text-xs bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 rounded px-3 py-2">
                      Mostrando <strong>{filtered.length}</strong> movimiento{filtered.length === 1 ? "" : "s"} pendiente{filtered.length === 1 ? "" : "s"} de clasificación · Total <strong className="font-mono">{usd(total)}</strong>
                    </div>
                  )}
                  {movFilter === "external_supplier" && (
                    <div className="text-xs bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded px-3 py-2">
                      Mostrando <strong>{filtered.length}</strong> movimiento{filtered.length === 1 ? "" : "s"} de proveedores externos · Total <strong className="font-mono">{usd(total)}</strong>
                    </div>
                  )}
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Woo prod / var</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead>Partida</TableHead>
                          <TableHead>Bucket</TableHead>
                          <TableHead>Motivo / warning</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                          <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">Sin movimientos.</TableCell></TableRow>
                        ) : filtered.map(m => {
                          const f = funds.find(x => x.id === m.fund_id);
                          const isManual = m.source === "manual";
                          const isPending = m.fund_bucket === "pending_classification" || (pendingFundId && m.fund_id === pendingFundId);
                          const snap: any = m.cost_snapshot_data ?? {};
                          const warning = snap?.warning ?? snap?.reason ?? null;
                          const rowMsg = warning ?? m.reason ?? "—";
                          const searchParam = m.woo_product_id
                            ? String(m.woo_product_id)
                            : (m.sku ?? m.product_name ?? "");
                          return (
                            <TableRow key={m.id} className={isPending ? "bg-yellow-50/40 dark:bg-yellow-950/10" : isManual ? "bg-yellow-50/40 dark:bg-yellow-950/10" : ""}>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className={MOV_BADGE[m.movement_type] ?? ""}>{MOV_LABEL[m.movement_type] ?? m.movement_type}</Badge>
                                  {isPending && (
                                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-[10px]">Pendiente de clasificación</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs truncate max-w-[200px]">{m.product_name ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{m.sku ?? "—"}</TableCell>
                              <TableCell className="text-xs font-mono">{m.source_order_id ? `#${m.source_order_id}` : "—"}</TableCell>
                              <TableCell className="text-xs font-mono">
                                {m.woo_product_id ? m.woo_product_id : "—"}
                                {m.woo_variation_id ? ` / ${m.woo_variation_id}` : ""}
                              </TableCell>
                              <TableCell className="text-right text-xs">{m.quantity ?? "—"}</TableCell>
                              <TableCell className="text-right text-xs font-mono">{m.unit_cost_snapshot ? usd(m.unit_cost_snapshot) : "—"}</TableCell>
                              <TableCell className={`text-right font-mono ${Number(m.amount) < 0 ? "text-destructive" : "text-emerald-700"}`}>{usd(m.amount)}</TableCell>
                              <TableCell className="text-xs">{f ? FUND_LABEL[f.fund_type] ?? f.fund_type : "—"}</TableCell>
                              <TableCell className="text-xs font-mono">{m.fund_bucket ?? "—"}</TableCell>
                              <TableCell className="text-xs max-w-[240px] truncate" title={String(rowMsg)}>{rowMsg}</TableCell>
                              <TableCell>
                                {isPending && searchParam && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(`/core/mapa-woo-core?search=${encodeURIComponent(String(searchParam))}`)}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Resolver en Mapa Woo/Core
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
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

        {/* CONCILIACIÓN */}
        <TabsContent value="conciliacion" className="mt-4 space-y-3">
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={reconFilter} onValueChange={(v: any) => setReconFilter(v)}>
                <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="positive">Ajustes positivos</SelectItem>
                  <SelectItem value="negative">Ajustes negativos</SelectItem>
                  <SelectItem value="reclass">Reclasificados</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar producto, SKU o Woo ID…"
                className="h-9 w-[280px]"
                value={reconSearch}
                onChange={e => setReconSearch(e.target.value)}
              />
              <div className="text-xs text-muted-foreground ml-auto">
                {reconciliation.conciliated} conciliados · {reconciliation.pendingRec} pendientes
              </div>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto original</TableHead>
                    <TableHead>Producto reemplazo</TableHead>
                    <TableHead className="text-right">Reserva original</TableHead>
                    <TableHead className="text-right">Costo destino</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Partida origen</TableHead>
                    <TableHead>Partida destino</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const rows = reconEvents.map((ev: any) => {
                      const fin = ev?.resolution_data?.financial_reconciliation ?? null;
                      const orig = Number(fin?.original_reserved_amount ?? ev?.resolution_data?.original_reserved_amount ?? 0);
                      const dest = Number(fin?.destination_total ?? ev?.resolution_data?.estimated_total ?? 0);
                      const diff = Number(fin?.net_difference ?? (dest - orig));
                      const origBucket = fin?.original_bucket ?? "—";
                      const targets = fin?.target_totals_by_bucket ?? {};
                      const targetBucket = Object.keys(targets)[0] ?? ev?.resolution_data?.final_route_action ?? "—";
                      const isReclass = origBucket !== "—" && targetBucket !== "—" && origBucket !== targetBucket;
                      const isPosted = fin?.status === "posted";
                      const status: string = isPosted
                        ? (isReclass ? "Reclasificado" : diff > 0 ? "Ajuste +" : diff < 0 ? "Liberación" : "Conciliado")
                        : "Pendiente";
                      const origLabel = ev.woo_product_id ? `Woo #${ev.woo_product_id}` : (ev.core_product_id ?? "—");
                      const replLabel = ev.replacement_woo_product_id ? `Woo #${ev.replacement_woo_product_id}` : (ev.replacement_product_id ?? "—");
                      return { ev, orig, dest, diff, origBucket, targetBucket, isPosted, status, origLabel, replLabel };
                    });
                    const filtered = rows.filter(r => {
                      if (reconFilter === "positive" && !(r.isPosted && r.diff > 0)) return false;
                      if (reconFilter === "negative" && !(r.isPosted && r.diff < 0)) return false;
                      if (reconFilter === "reclass" && !(r.isPosted && r.origBucket !== r.targetBucket)) return false;
                      if (reconFilter === "pending" && r.isPosted) return false;
                      if (reconSearch.trim()) {
                        const q = reconSearch.trim().toLowerCase();
                        const hay = `${r.origLabel} ${r.replLabel}`.toLowerCase();
                        if (!hay.includes(q)) return false;
                      }
                      return true;
                    });
                    if (filtered.length === 0) {
                      return <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin conciliaciones que coincidan.</TableCell></TableRow>;
                    }
                    return filtered.map(r => (
                      <TableRow key={r.ev.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.ev.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{r.origLabel}</TableCell>
                        <TableCell className="text-xs">{r.replLabel}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{usd(r.orig)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{usd(r.dest)}</TableCell>
                        <TableCell className={`text-right font-mono text-xs ${r.diff > 0 ? "text-indigo-700" : r.diff < 0 ? "text-emerald-700" : ""}`}>{usd(r.diff)}</TableCell>
                        <TableCell className="text-xs">{r.origBucket}</TableCell>
                        <TableCell className="text-xs">{r.targetBucket}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            r.status === "Conciliado" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                            r.status === "Ajuste +" ? "bg-indigo-100 text-indigo-800 border-indigo-300" :
                            r.status === "Liberación" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                            r.status === "Reclasificado" ? "bg-purple-100 text-purple-800 border-purple-300" :
                            "bg-yellow-100 text-yellow-800 border-yellow-300"
                          }>{r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
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

      <Dialog open={missingDaysOpen} onOpenChange={setMissingDaysOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Días sin cerrar desde {BASELINE_DATE_LABEL}</DialogTitle>
          </DialogHeader>
          {missingDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay días pendientes.</p>
          ) : (
            <ul className="text-sm space-y-1 max-h-[60vh] overflow-y-auto">
              {missingDays.map(d => (
                <li key={d} className="flex items-center justify-between border rounded px-3 py-1.5">
                  <span className="font-mono">{formatDDMMYYYY(d)}</span>
                  <Button size="sm" variant="ghost" onClick={() => { setPeriodStart(d); setPeriodEnd(d); setMissingDaysOpen(false); toast.info(`Rango preparado para ${formatDDMMYYYY(d)}.`); }}>
                    Preparar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissingDaysOpen(false)}>Cerrar</Button>
            {missingDays.length > 0 && (
              <Button onClick={() => { fillNextPendingDay(); setMissingDaysOpen(false); }}>Preparar próximo día pendiente</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReconciliationDialog
        open={reconOpen}
        onOpenChange={setReconOpen}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />
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

function PartidaCard({
  title,
  description,
  fund,
  movementsCount,
  lastMovementAt,
  tone,
  alertWhenPositive,
  onClick,
}: {
  title: string;
  description: string;
  fund: Fund | null;
  movementsCount: number;
  lastMovementAt: string | null;
  tone: "emerald" | "blue" | "yellow";
  alertWhenPositive?: boolean;
  onClick?: () => void;
}) {
  const toneCls = {
    emerald: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20",
    blue: "bg-blue-50 border-blue-200 dark:bg-blue-950/20",
    yellow: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20",
  }[tone];
  const amount = Number(fund?.available_amount ?? 0);
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const showAlert = !!alertWhenPositive && amount > 0;
  const clickable = !!onClick;
  return (
    <Card
      className={`p-4 ${toneCls} ${clickable ? "cursor-pointer hover:ring-2 hover:ring-primary/40 transition" : ""}`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</p>
          <p className="text-2xl font-black mt-1">{fmt.format(amount)}</p>
        </div>
        {showAlert && (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
            Requiere atención
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2">{description}</p>
      <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
        <span>{movementsCount} movimiento{movementsCount === 1 ? "" : "s"}</span>
        <span>{lastMovementAt ? `Últ.: ${new Date(lastMovementAt).toLocaleDateString()}` : "Sin movimientos"}</span>
      </div>
      {clickable && (
        <p className="text-[11px] text-primary mt-2 font-semibold">Ver movimientos →</p>
      )}
    </Card>
  );
}

// ---------- Conciliación Woo vs Partidas (read-only) ----------

type ReconFilter = "all" | "movements" | "pending" | "pending_cost" | "pending_mapping" | "excluded" | "late" | "diff";

function ReconciliationDialog({
  open, onOpenChange, periodStart, periodEnd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodStart: string;
  periodEnd: string;
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [filter, setFilter] = useState<ReconFilter>("all");

  const utcRange = useMemo(() => veRangeToUtc(periodStart, periodEnd), [periodStart, periodEnd]);
  const daysSpan = useMemo(() => {
    const [ay, am, ad] = periodStart.split("-").map(Number);
    const [by, bm, bd] = periodEnd.split("-").map(Number);
    const a = Date.UTC(ay, (am ?? 1) - 1, ad ?? 1);
    const b = Date.UTC(by, (bm ?? 1) - 1, bd ?? 1);
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }, [periodStart, periodEnd]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const bounds = veRangeBounds(periodStart, periodEnd);

        // 1. Pedidos del rango (todos los status)
        const rangeOrders = await paginatedSelect<any>(async (from, to) =>
          supabase
            .from("orders")
            .select("order_id, order_number, order_datetime, order_status")
            .gte("order_datetime", bounds.gte)
            .lte("order_datetime", bounds.lte)
            .order("order_id", { ascending: true })
            .range(from, to)
        );

        // 2. Rezagados confirmados: creados >= BASELINE y < periodStart (VE 00:00 UTC)
        const lateBoundLower = `${RECON_BASELINE}T04:00:00.000Z`;
        const lateBoundUpper = bounds.gte;
        const lateOrders = lateBoundLower < lateBoundUpper
          ? await paginatedSelect<any>(async (from, to) =>
              supabase
                .from("orders")
                .select("order_id, order_number, order_datetime, order_status")
                .in("order_status", Array.from(CONFIRMED_STATUSES))
                .gte("order_datetime", lateBoundLower)
                .lt("order_datetime", lateBoundUpper)
                .order("order_id", { ascending: true })
                .range(from, to)
            )
          : [];

        // Unir order_ids
        const orderMap = new Map<number, any>();
        for (const o of rangeOrders) orderMap.set(o.order_id, o);
        for (const o of lateOrders) if (!orderMap.has(o.order_id)) orderMap.set(o.order_id, o);
        const allOrderIds = Array.from(orderMap.keys());

        if (allOrderIds.length === 0) {
          if (!cancelled) { setRows([]); setLoading(false); }
          return;
        }

        // 3. order_items
        const items: any[] = [];
        for (const ids of chunk(allOrderIds, 200)) {
          const chunkRows = await paginatedSelect<any>(async (from, to) =>
            supabase
              .from("order_items")
              .select("order_id, line_item_id, sku, product_name, quantity, line_total, product_id, variation_id")
              .in("order_id", ids)
              .order("order_id", { ascending: true })
              .range(from, to)
          );
          items.push(...chunkRows);
        }

        // 4. Movimientos sale_generated*
        const movs: any[] = [];
        for (const ids of chunk(allOrderIds, 200)) {
          const chunkRows = await paginatedSelect<any>(async (from, to) =>
            supabase
              .from("core_fabrication_fund_movements")
              .select("source_order_id, source_order_item_id, amount, unit_cost_snapshot, fund_bucket, movement_type, currency")
              .in("source_order_id", ids)
              .in("movement_type", ["sale_generated", "sale_generated_non_restockable"])
              .order("source_order_id", { ascending: true })
              .range(from, to)
          );
          movs.push(...chunkRows);
        }
        const movByLine = new Map<string, any>();
        for (const m of movs) {
          const k = `${m.source_order_id}:${m.source_order_item_id ?? ""}`;
          if (!movByLine.has(k)) movByLine.set(k, m);
        }

        // 5. Pending items
        const pendings: any[] = [];
        for (const ids of chunk(allOrderIds, 200)) {
          const chunkRows = await paginatedSelect<any>(async (from, to) =>
            supabase
              .from("core_fabrication_fund_pending_items")
              .select("source_order_id, source_order_item_id, status, reason, woo_sku, product_name, quantity, woo_product_id, woo_variation_id")
              .in("source_order_id", ids)
              .order("source_order_id", { ascending: true })
              .range(from, to)
          );
          pendings.push(...chunkRows);
        }
        const pendByLine = new Map<string, any>();
        for (const p of pendings) {
          const k = `${p.source_order_id}:${p.source_order_item_id ?? ""}`;
          const existing = pendByLine.get(k);
          const isActive = p.status && !CLOSED_PENDING_STATUSES.has(p.status);
          if (!existing || (isActive && !(existing.status && !CLOSED_PENDING_STATUSES.has(existing.status)))) {
            pendByLine.set(k, p);
          }
        }

        // Detectar rezagados reales: pedidos "late" con al menos una línea sin movimiento
        const lateOrderIdSet = new Set<number>();
        for (const lo of lateOrders) {
          const lines = items.filter(it => it.order_id === lo.order_id);
          if (lines.length === 0) continue;
          const hasUnreserved = lines.some(l => {
            if (isShippingLike(l.product_name, l.sku)) return false;
            return !movByLine.has(`${l.order_id}:${l.line_item_id ?? ""}`);
          });
          if (hasUnreserved) lateOrderIdSet.add(lo.order_id);
        }

        // Construir filas
        const out: ReconRow[] = [];
        for (const it of items) {
          const order = orderMap.get(it.order_id);
          if (!order) continue;
          const k = `${it.order_id}:${it.line_item_id ?? ""}`;
          const mov = movByLine.get(k) ?? null;
          const pend = pendByLine.get(k) ?? null;
          const cls = classifyLine({
            orderStatus: order.order_status,
            sku: it.sku,
            productName: it.product_name,
            movement: mov,
            pending: pend,
          });
          out.push({
            order_id: it.order_id,
            order_number: order.order_number,
            order_datetime: order.order_datetime,
            order_status: order.order_status,
            line_item_id: it.line_item_id,
            sku: it.sku,
            product_name: it.product_name,
            woo_product_id: it.product_id ?? null,
            woo_variation_id: it.variation_id ?? null,
            quantity: it.quantity,
            line_total: it.line_total,
            result: cls.result,
            is_late_confirmed: lateOrderIdSet.has(it.order_id),
            movement_amount: mov?.amount ?? null,
            movement_unit_cost: mov?.unit_cost_snapshot ?? null,
            movement_bucket: mov?.fund_bucket ?? null,
            movement_type: mov?.movement_type ?? null,
            reason: cls.reason,
          });
        }

        // Ordenar por order_id desc
        out.sort((a, b) => b.order_id - a.order_id || (a.line_item_id ?? 0) - (b.line_item_id ?? 0));
        if (!cancelled) setRows(out);
      } catch (e: any) {
        toast.error("Error cargando conciliación: " + (e?.message ?? String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, periodStart, periodEnd]);

  const summary = useMemo(() => {
    const s = {
      orders: new Set<number>(),
      lines: rows.length,
      product_lines: 0,
      shipping_excluded: 0,
      confirmed_processable: 0,
      reserved: 0,
      pending_cost: 0,
      pending_mapping: 0,
      pending_classification: 0,
      excluded_status: 0,
      late_confirmed: 0,
      diff: 0,
    };
    for (const r of rows) {
      s.orders.add(r.order_id);
      if (r.result === "excluded_shipping") { s.shipping_excluded++; continue; }
      s.product_lines++;
      if (r.result === "reserved") s.reserved++;
      else if (r.result === "pending_cost") s.pending_cost++;
      else if (r.result === "pending_mapping") s.pending_mapping++;
      else if (r.result === "pending_classification") s.pending_classification++;
      else if (r.result === "excluded_status") s.excluded_status++;
      else if (r.result === "not_processed") s.diff++;
      if (r.result !== "excluded_status") s.confirmed_processable++;
      if (r.is_late_confirmed) s.late_confirmed++;
    }
    return s;
  }, [rows]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "all": return rows;
      case "movements": return rows.filter(r => r.result === "reserved");
      case "pending": return rows.filter(r => r.result === "pending_cost" || r.result === "pending_mapping" || r.result === "pending_classification");
      case "pending_cost": return rows.filter(r => r.result === "pending_cost");
      case "pending_mapping": return rows.filter(r => r.result === "pending_mapping");
      case "excluded": return rows.filter(r => r.result === "excluded_status" || r.result === "excluded_shipping");
      case "late": return rows.filter(r => r.is_late_confirmed);
      case "diff": return rows.filter(r => r.result === "not_processed");
    }
  }, [rows, filter]);

  const handleExport = () => {
    if (filtered.length === 0) { toast.info("No hay filas para exportar."); return; }
    const csv = rowsToCsv(filtered);
    downloadCsv(`conciliacion-hub_${periodStart}_${periodEnd}.csv`, csv);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" /> Conciliar rango Woo ↔ Partidas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div>
              <span className="font-semibold">Rango VE:</span>{" "}
              <span className="font-mono">
                {periodStart.split("-").reverse().join("/")} 00:00 → {periodEnd.split("-").reverse().join("/")} 23:59
              </span>
            </div>
            <div>
              <span className="font-semibold">Rango UTC:</span>{" "}
              <span className="font-mono">{utcRange.fromUtc} → {utcRange.toUtc}</span>
            </div>
            {daysSpan > 1 && (
              <div className="text-amber-700 dark:text-amber-400">
                Este rango incluye {daysSpan} días. Para comparar con Woo, exporta exactamente el mismo rango.
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Antes de conciliar o procesar, sincroniza Woo para incluir pedidos recientes.
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            <SummaryChip label="Pedidos" value={summary.orders.size} />
            <SummaryChip label="Líneas totales" value={summary.lines} />
            <SummaryChip label="Productos" value={summary.product_lines} />
            <SummaryChip label="Delivery/envío" value={summary.shipping_excluded} tone="muted" />
            <SummaryChip label="Confirmadas procesables" value={summary.confirmed_processable} tone="emerald" />
            <SummaryChip label="Ya reservadas" value={summary.reserved} tone="emerald" />
            <SummaryChip label="Sin costo" value={summary.pending_cost} tone="yellow" />
            <SummaryChip label="Sin mapeo" value={summary.pending_mapping} tone="orange" />
            <SummaryChip label="Sin clasificar" value={summary.pending_classification} tone="amber" />
            <SummaryChip label="Excluidas status" value={summary.excluded_status} tone="muted" />
            <SummaryChip label="Rezagados" value={summary.late_confirmed} tone="blue" />
            <SummaryChip label="Diferencias" value={summary.diff} tone="red" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filter} onValueChange={(v) => setFilter(v as ReconFilter)}>
              <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="movements">Movimientos (ya reservados)</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="pending_cost">Sin costo</SelectItem>
                <SelectItem value="pending_mapping">Sin mapeo</SelectItem>
                <SelectItem value="excluded">Excluidos</SelectItem>
                <SelectItem value="late">Rezagados confirmados</SelectItem>
                <SelectItem value="diff">Diferencias / no procesado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> Exportar conciliación Hub
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {loading ? "Cargando…" : `${filtered.length} fila${filtered.length === 1 ? "" : "s"} visibles`}
            </span>
          </div>

          <div className="border rounded-md max-h-[50vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Fecha VE</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Woo P/V</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Partida</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-6">Sin datos.</TableCell></TableRow>
                )}
                {filtered.map((r, i) => (
                  <TableRow key={`${r.order_id}:${r.line_item_id ?? i}`}>
                    <TableCell className="font-mono text-xs">
                      {r.order_number ?? r.order_id}
                      {r.is_late_confirmed && (
                        <Badge variant="outline" className="ml-1 bg-blue-100 text-blue-800 border-blue-300 text-[10px]">Rezagado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{formatVE(r.order_datetime)}</TableCell>
                    <TableCell className="text-xs">{r.order_status ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sku ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={r.product_name ?? ""}>{r.product_name ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{r.woo_product_id ?? "—"}{r.woo_variation_id ? `/${r.woo_variation_id}` : ""}</TableCell>
                    <TableCell className="text-right text-xs">{r.quantity ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${RESULT_BADGE[r.result]} text-[10px]`}>{RESULT_LABEL[r.result]}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">{r.movement_unit_cost != null ? usd(Number(r.movement_unit_cost)) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{r.movement_amount != null ? usd(Number(r.movement_amount)) : "—"}</TableCell>
                    <TableCell className="text-xs">{r.movement_bucket ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryChip({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "emerald" | "yellow" | "orange" | "amber" | "muted" | "blue" | "red" }) {
  const toneCls: Record<string, string> = {
    default: "bg-muted/30 border-border",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-900",
    orange: "bg-orange-50 border-orange-200 text-orange-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    muted: "bg-muted/40 border-border text-muted-foreground",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    red: "bg-destructive/10 border-destructive/30 text-destructive",
  };
  return (
    <div className={`rounded-md border px-2 py-1.5 ${toneCls[tone]}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="text-base font-black leading-tight">{value}</div>
    </div>
  );
}

async function paginatedSelect<T>(fetchPage: (from: number, to: number) => any): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

