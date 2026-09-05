// Pipeline visual de producción + inventario por unidad.
// Solo visualización: lee de core_production_units, core_production_unit_processes,
// core_production_work_entries, core_products. No escribe en Woo ni cambia estados.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Ban,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  PackageCheck,
  Package,
  QrCode,
  ChevronRight,
  ChevronDown,
  History,
  Wrench,
} from "lucide-react";
import { CancelProductionUnitDialog, type CancelUnitTarget } from "@/components/core/CancelProductionUnitDialog";

type Props = {
  productionOrderId: string;
  orderCode: string;
  onRepair?: () => Promise<void> | void;
};

type Unit = {
  id: string;
  unit_code: string;
  status: string;
  size: string | null;
  variant_label: string | null;
  variant_sku: string | null;
  sku: string | null;
  core_product_id: string | null;
  entered_inventory_at: string | null;
  entered_inventory_by: string | null;
  inventory_entry_source: string | null;
  cancelled_reason: string | null;
  cancelled_at: string | null;
};


type UnitProcess = {
  id: string;
  production_unit_id: string;
  process_name: string;
  process_type: string | null;
  process_order: number;
  status: string;
  adds_to_payroll: boolean;
  suggested_role: string | null;
  rate_snapshot: any;
  completed_at: string | null;
  completed_by_operator_id: string | null;
};

type WorkEntry = {
  id: string;
  production_unit_id: string;
  production_unit_process_id: string;
  operator_name_snapshot: string | null;
  rate_snapshot: number | null;
  currency: string | null;
  payroll_amount: number | null;
  payroll_status: string;
  created_at: string;
};

type ProductInfo = { id: string; sku: string | null; product_name: string | null };

// ---------- Helpers ----------
function stepClass(state: "done" | "pending" | "in_progress" | "error" | "inv_done" | "inv_ready" | "inv_blocked") {
  switch (state) {
    case "done":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "in_progress":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "pending":
      return "bg-muted text-muted-foreground border-border";
    case "error":
      return "bg-red-100 text-red-800 border-red-300";
    case "inv_done":
      return "chip-success border-emerald-700";
    case "inv_ready":
      return "bg-red-100 text-red-800 border-red-400";
    case "inv_blocked":
      return "bg-muted text-muted-foreground border-border";
  }
}

function processStepState(p: UnitProcess): "done" | "pending" | "in_progress" | "error" {
  const s = (p.status || "").toLowerCase();
  if (s === "completed" || s === "skipped") return "done";
  if (s === "in_progress") return "in_progress";
  if (s === "error" || s === "blocked") return "error";
  return "pending";
}

function unitOverall(unit: Unit, procs: UnitProcess[]) {
  if (unit.status === "cancelled" || unit.status === "discarded") {
    return {
      label: "Cancelada",
      tone: "error" as const,
      icon: <Ban className="h-3 w-3" />,
      progress: 0,
      completedSteps: 0,
      totalSteps: 1,
    };
  }
  if (procs.length === 0) {
    return {
      label: "Sin procesos generados",
      tone: "error" as const,
      icon: <AlertTriangle className="h-3 w-3" />,
      progress: 0,
      completedSteps: 0,
      totalSteps: 1,
    };
  }
  const completed = procs.filter((p) => {
    const s = (p.status || "").toLowerCase();
    return s === "completed" || s === "skipped";
  }).length;
  const total = procs.length + 1; // +1 inventario
  const enteredInv = unit.status === "entered_inventory";
  const done = completed + (enteredInv ? 1 : 0);
  const pct = Math.round((done / total) * 100);

  let label: string;
  let tone: "done" | "pending" | "in_progress" | "error" | "inv_ready";
  let icon: JSX.Element;
  if (enteredInv) {
    label = "Ingresada a inventario";
    tone = "done";
    icon = <PackageCheck className="h-3 w-3" />;
  } else if (completed === procs.length) {
    label = "Lista para inventario";
    tone = "inv_ready";
    icon = <ShieldAlert className="h-3 w-3" />;
  } else if (completed === 0) {
    label = "Producción no iniciada";
    tone = "pending";
    icon = <Circle className="h-3 w-3" />;
  } else {
    label = "En producción";
    tone = "in_progress";
    icon = <Loader2 className="h-3 w-3" />;
  }
  return { label, tone, icon, progress: pct, completedSteps: done, totalSteps: total };
}

// ---------- Component ----------
export function ProductionPipelineSection({ productionOrderId, orderCode, onRepair }: Props) {
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [processes, setProcesses] = useState<UnitProcess[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [products, setProducts] = useState<Record<string, ProductInfo>>({});
  const [operatorNames, setOperatorNames] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [repairing, setRepairing] = useState(false);
  const [cancelUnit, setCancelUnit] = useState<CancelUnitTarget | null>(null);

  async function load() {
    setLoading(true);
    const { data: uns } = await supabase
      .from("core_production_units")
      .select(
        "id, unit_code, status, size, variant_label, variant_sku, sku, core_product_id, entered_inventory_at, entered_inventory_by, inventory_entry_source, cancelled_reason, cancelled_at",
      )
      .eq("production_order_id", productionOrderId)
      .order("unit_code");
    const unitsArr = (uns as Unit[]) ?? [];
    setUnits(unitsArr);

    const unitIds = unitsArr.map((u) => u.id);
    if (unitIds.length === 0) {
      setProcesses([]);
      setWorkEntries([]);
      setProducts({});
      setLoading(false);
      return;
    }

    const [{ data: procs }, { data: wes }] = await Promise.all([
      supabase
        .from("core_production_unit_processes")
        .select(
          "id, production_unit_id, process_name, process_type, process_order, status, adds_to_payroll, suggested_role, rate_snapshot, completed_at, completed_by_operator_id",
        )
        .in("production_unit_id", unitIds)
        .order("process_order"),
      supabase
        .from("core_production_work_entries")
        .select(
          "id, production_unit_id, production_unit_process_id, operator_name_snapshot, rate_snapshot, currency, payroll_amount, payroll_status, created_at",
        )
        .in("production_unit_id", unitIds),
    ]);
    setProcesses((procs as UnitProcess[]) ?? []);
    setWorkEntries((wes as WorkEntry[]) ?? []);

    // Products
    const productIds = Array.from(
      new Set(unitsArr.map((u) => u.core_product_id).filter(Boolean) as string[]),
    );
    if (productIds.length) {
      const { data: prods } = await supabase
        .from("core_products")
        .select("id, core_sku, name")
        .in("id", productIds);
      const map: Record<string, ProductInfo> = {};
      for (const p of ((prods as any[]) ?? [])) {
        map[p.id] = { id: p.id, sku: p.core_sku ?? null, product_name: p.name ?? null };
      }
      setProducts(map);
    } else {
      setProducts({});
    }

    // Operator names (fallback to operators table)
    const opIds = Array.from(
      new Set(
        ((procs as UnitProcess[]) ?? [])
          .map((p) => p.completed_by_operator_id)
          .filter(Boolean) as string[],
      ),
    );
    if (opIds.length) {
      const { data: ops } = await supabase
        .from("core_factory_operators")
        .select("id, full_name")
        .in("id", opIds);
      const map: Record<string, string> = {};
      for (const o of (ops as any[]) ?? []) map[o.id] = o.full_name;
      setOperatorNames(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (productionOrderId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionOrderId]);

  // Index data
  const procsByUnit = useMemo(() => {
    const m: Record<string, UnitProcess[]> = {};
    for (const p of processes) (m[p.production_unit_id] ??= []).push(p);
    return m;
  }, [processes]);

  const workByProcess = useMemo(() => {
    const m: Record<string, WorkEntry> = {};
    for (const w of workEntries) m[w.production_unit_process_id] = w;
    return m;
  }, [workEntries]);

  // Summary
  const summary = useMemo(() => {
    let cancelled = 0;
    let inProd = 0,
      prodDone = 0,
      readyNotEntered = 0,
      entered = 0,
      noProc = 0,
      pendingProcs = 0,
      payrollEntries = 0,
      payrollPendingAmount = 0,
      progressSum = 0,
      progressCount = 0;
    for (const u of units) {
      const ps = procsByUnit[u.id] ?? [];
      if (u.status === "cancelled" || u.status === "discarded") {
        cancelled++;
        continue;
      }
      const ov = unitOverall(u, ps);
      progressSum += ov.progress;
      progressCount += 1;
      if (ps.length === 0) noProc++;
      const allDone = ps.length > 0 && ps.every((p) => ["completed", "skipped"].includes((p.status || "").toLowerCase()));
      if (u.status === "entered_inventory") entered++;
      else if (allDone) {
        readyNotEntered++;
        prodDone++;
      } else if (ps.some((p) => ["completed", "skipped"].includes((p.status || "").toLowerCase()))) {
        inProd++;
      }
      pendingProcs += ps.filter((p) => !["completed", "skipped"].includes((p.status || "").toLowerCase())).length;
    }
    for (const w of workEntries) {
      payrollEntries++;
      if (w.payroll_status === "pending") payrollPendingAmount += Number(w.payroll_amount || 0);
    }
    const avg = progressCount > 0 ? Math.round(progressSum / progressCount) : 0;
    return {
      total: units.length,
      inProd,
      prodDone,
      readyNotEntered,
      entered,
      noProc,
      pendingProcs,
      payrollEntries,
      payrollPendingAmount,
      avg,
      cancelled,
    };
  }, [units, procsByUnit, workEntries]);

  // Group units by product line
  const groups = useMemo(() => {
    const m: Record<string, { key: string; sku: string; name: string; units: Unit[] }> = {};
    for (const u of units) {
      const prod = u.core_product_id ? products[u.core_product_id] : null;
      const sku = prod?.sku ?? u.sku ?? "—";
      const key = u.core_product_id ?? sku;
      if (!m[key]) {
        m[key] = {
          key,
          sku,
          name: prod?.product_name ?? u.sku ?? "Producto",
          units: [],
        };
      }
      m[key].units.push(u);
    }
    return Object.values(m);
  }, [units, products]);

  async function handleRepair() {
    setRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "core-generate-production-units",
        { body: { production_order_id: productionOrderId, repair_missing_processes: true } },
      );
      if (error) throw error;
      const d: any = data;
      const repaired = d?.repaired?.length ?? 0;
      const skipped = d?.skipped?.length ?? 0;
      // eslint-disable-next-line no-alert
      console.log(`Pipeline reparado · ${repaired} reparadas · ${skipped} omitidas`);
      await load();
      if (onRepair) await onRepair();
    } finally {
      setRepairing(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando pipeline…
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-3">
        Aún no hay unidades generadas para esta orden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Total unidades</div>
          <div className="text-xl font-bold">{summary.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">En producción</div>
          <div className="text-xl font-bold text-amber-700">{summary.inProd}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Listas sin ingresar</div>
          <div className={`text-xl font-bold ${summary.readyNotEntered > 0 ? "text-red-700" : ""}`}>
            {summary.readyNotEntered}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Ingresadas inventario</div>
          <div className="text-xl font-bold text-emerald-700">{summary.entered}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Canceladas</div>
          <div className={`text-xl font-bold ${summary.cancelled > 0 ? "text-red-700" : ""}`}>
            {summary.cancelled}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Progreso promedio</div>
          <div className="text-xl font-bold">{summary.avg}%</div>
          <Progress value={summary.avg} className="h-1 mt-1" />
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Procesos pendientes</div>
          <div className="text-xl font-bold">{summary.pendingProcs}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Trabajos nómina</div>
          <div className="text-xl font-bold">{summary.payrollEntries}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Monto pend. nómina</div>
          <div className="text-xl font-bold">
            ${summary.payrollPendingAmount.toFixed(2)}
          </div>
        </Card>
      </div>

      {summary.readyNotEntered > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-xs">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">
              {summary.readyNotEntered} prenda{summary.readyNotEntered > 1 ? "s" : ""} lista{summary.readyNotEntered > 1 ? "s" : ""} sin ingresar a inventario
            </div>
            <div>Riesgo operativo: existen físicamente pero aún no están registradas como stock.</div>
          </div>
        </div>
      )}

      {summary.noProc > 0 && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">
                {summary.noProc} unidad{summary.noProc > 1 ? "es" : ""} sin procesos generados
              </div>
              <div>Requieren reparación antes de poder escanearse.</div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleRepair} disabled={repairing}>
            {repairing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3 mr-1" />}
            Reparar procesos
          </Button>
        </div>
      )}

      {/* Groups by product */}
      <div className="space-y-3">
        {groups.map((g) => {
          const groupOpen = expanded[`g:${g.key}`] !== false; // default open
          let gDone = 0,
            gTotal = 0;
          for (const u of g.units) {
            const ps = procsByUnit[u.id] ?? [];
            const ov = unitOverall(u, ps);
            gDone += ov.completedSteps;
            gTotal += ov.totalSteps;
          }
          const gPct = gTotal > 0 ? Math.round((gDone / gTotal) * 100) : 0;
          return (
            <Card key={g.key} className="p-3">
              <Collapsible
                open={groupOpen}
                onOpenChange={(o) => setExpanded((e) => ({ ...e, [`g:${g.key}`]: o }))}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-2">
                      {groupOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <div>
                        <div className="text-sm font-semibold">
                          {g.name}{" "}
                          <span className="text-xs font-mono text-muted-foreground">
                            · {g.sku}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {g.units.length} unidad{g.units.length > 1 ? "es" : ""}
                        </div>
                      </div>
                    </div>
                    <div className="w-32">
                      <div className="text-[10px] text-right text-muted-foreground">{gPct}%</div>
                      <Progress value={gPct} className="h-1.5" />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {g.units.map((u) => {
                    const ps = procsByUnit[u.id] ?? [];
                    const ov = unitOverall(u, ps);
                    const unitOpen = !!expanded[`u:${u.id}`];
                    const isCancelled = u.status === "cancelled" || u.status === "discarded";
                    const enteredInv = u.status === "entered_inventory";
                    const allProcDone = ps.length > 0 && ps.every((p) => ["completed", "skipped"].includes((p.status || "").toLowerCase()));

                    // Inventory step state
                    const invState: "inv_done" | "inv_ready" | "inv_blocked" = enteredInv
                      ? "inv_done"
                      : allProcDone
                        ? "inv_ready"
                        : "inv_blocked";
                    const invLabel = enteredInv
                      ? "Inventario ✓"
                      : allProcDone
                        ? "Lista para inventario"
                        : "Inventario bloqueado";

                    return (
                      <div key={u.id} className="border rounded-md p-3 bg-muted/10">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-semibold">{u.unit_code}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {u.size ?? u.variant_label ?? "—"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${stepClass(ov.tone === "inv_ready" ? "inv_ready" : ov.tone)}`}
                            >
                              {ov.icon}
                              <span className="ml-1">{ov.label}</span>
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {ov.progress}% ({ov.completedSteps}/{ov.totalSteps})
                            </span>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpanded((e) => ({ ...e, [`u:${u.id}`]: !unitOpen }))}
                            >
                              <History className="h-3 w-3 mr-1" />
                              {unitOpen ? "Ocultar" : "Detalle"}
                            </Button>
                            {!isCancelled && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`/core/escaneo?unit=${u.unit_code}`, "_blank")}
                              >
                                <QrCode className="h-3 w-3 mr-1" /> Escanear
                              </Button>
                            )}
                            {!isCancelled && (enteredInv || allProcDone) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open("/core/inventario", "_blank")}
                              >
                                <Package className="h-3 w-3 mr-1" /> Inventario
                              </Button>
                            )}
                            {!isCancelled && !enteredInv && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-700 border-red-300 hover:bg-red-50"
                                onClick={() =>
                                  setCancelUnit({
                                    id: u.id,
                                    unit_code: u.unit_code,
                                    sku: u.sku,
                                    variant_sku: u.variant_sku,
                                    size: u.size,
                                    variant_label: u.variant_label,
                                    hasCompletedProcesses: ps.some((p) =>
                                      ["completed", "skipped"].includes((p.status || "").toLowerCase()),
                                    ),
                                  })
                                }
                              >
                                <Ban className="h-3 w-3 mr-1" /> Cancelar prenda
                              </Button>
                            )}
                          </div>
                        </div>

                        {isCancelled && (
                          <div className="mb-2 rounded-md border border-red-300 bg-red-50 p-2 text-[11px] text-red-800">
                            <span className="font-semibold">Prenda cancelada</span>
                            {u.cancelled_reason ? ` · ${u.cancelled_reason}` : ""}
                            {u.cancelled_at ? ` · ${new Date(u.cancelled_at).toLocaleString()}` : ""}
                          </div>
                        )}

                        {/* Pipeline steps */}
                        <div className={`flex flex-wrap items-center gap-1 ${isCancelled ? "opacity-50" : ""}`}>
                          {ps.length === 0 ? (
                            <Badge variant="outline" className={`text-[10px] ${stepClass("error")}`}>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Sin procesos · requiere reparación
                            </Badge>
                          ) : (
                            ps.map((p, idx) => {
                              const st = processStepState(p);
                              return (
                                <div key={p.id} className="flex items-center gap-1">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${stepClass(st)}`}
                                    title={p.suggested_role ? `Rol: ${p.suggested_role}` : undefined}
                                  >
                                    {st === "done" ? (
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                    ) : st === "in_progress" ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : st === "error" ? (
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                    ) : (
                                      <Circle className="h-3 w-3 mr-1" />
                                    )}
                                    {p.process_name}
                                  </Badge>
                                  {idx < ps.length - 1 && (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              );
                            })
                          )}
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="outline" className={`text-[10px] ${stepClass(invState)}`}>
                            {invState === "inv_done" ? (
                              <PackageCheck className="h-3 w-3 mr-1" />
                            ) : invState === "inv_ready" ? (
                              <ShieldAlert className="h-3 w-3 mr-1" />
                            ) : (
                              <Package className="h-3 w-3 mr-1" />
                            )}
                            {invLabel}
                          </Badge>
                        </div>

                        {/* Detail */}
                        {unitOpen && (
                          <div className="mt-3 border-t pt-2 space-y-2">
                            {ps.length === 0 ? (
                              <div className="text-xs text-red-700">
                                Esta unidad no tiene procesos generados.
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {ps.map((p) => {
                                  const we = workByProcess[p.id];
                                  const rateCfg = p.rate_snapshot?.unit_cost;
                                  const rateZeroByConfig = Number(rateCfg ?? 0) === 0 && p.adds_to_payroll;
                                  return (
                                    <div
                                      key={p.id}
                                      className="text-[11px] grid grid-cols-1 md:grid-cols-5 gap-1 md:gap-2 p-2 bg-background rounded border"
                                    >
                                      <div>
                                        <div className="font-semibold">{p.process_name}</div>
                                        <div className="text-muted-foreground">
                                          {p.suggested_role ?? "—"}
                                        </div>
                                      </div>
                                      <div>
                                        <Badge variant="outline" className={`text-[10px] ${stepClass(processStepState(p))}`}>
                                          {p.status}
                                        </Badge>
                                      </div>
                                      <div>
                                        <div className="text-muted-foreground">Operario</div>
                                        <div>
                                          {we?.operator_name_snapshot ??
                                            (p.completed_by_operator_id
                                              ? operatorNames[p.completed_by_operator_id] ?? "—"
                                              : "—")}
                                        </div>
                                        {p.completed_at && (
                                          <div className="text-muted-foreground">
                                            {new Date(p.completed_at).toLocaleString()}
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-muted-foreground">Tarifa</div>
                                        <div>
                                          {rateCfg != null
                                            ? `${p.rate_snapshot?.currency ?? "USD"} ${Number(rateCfg).toFixed(2)}`
                                            : "—"}
                                        </div>
                                        {rateZeroByConfig && (
                                          <div className="text-[10px] text-muted-foreground">
                                            Tarifa configurada en 0.00
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-muted-foreground">Nómina</div>
                                        {p.adds_to_payroll ? (
                                          we ? (
                                            <>
                                              <div>
                                                {we.currency ?? "USD"}{" "}
                                                {Number(we.payroll_amount ?? 0).toFixed(2)}
                                              </div>
                                              <Badge variant="outline" className="text-[10px]">
                                                {we.payroll_status}
                                              </Badge>
                                            </>
                                          ) : (
                                            <div className="text-muted-foreground">—</div>
                                          )
                                        ) : (
                                          <div className="text-muted-foreground">No suma</div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Inventory final step detail */}
                            <div className="text-[11px] p-2 bg-background rounded border">
                              <div className="flex items-center gap-2">
                                <Package className="h-3 w-3" />
                                <span className="font-semibold">Inventario</span>
                                <Badge variant="outline" className={`text-[10px] ${stepClass(invState)}`}>
                                  {invLabel}
                                </Badge>
                              </div>
                              {enteredInv ? (
                                <div className="mt-1 text-muted-foreground">
                                  {u.entered_inventory_at &&
                                    new Date(u.entered_inventory_at).toLocaleString()}{" "}
                                  · {u.inventory_entry_source ?? "—"}
                                </div>
                              ) : allProcDone ? (
                                <div className="mt-1 text-red-700">
                                  Producción completa. Aún no ingresada a inventario.
                                </div>
                              ) : (
                                <div className="mt-1 text-muted-foreground">
                                  Bloqueado: hay procesos pendientes.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      <CancelProductionUnitDialog
        unit={cancelUnit}
        onOpenChange={(o) => !o && setCancelUnit(null)}
        onCancelled={async () => {
          await load();
          if (onRepair) await onRepair();
        }}
      />
    </div>
  );
}
