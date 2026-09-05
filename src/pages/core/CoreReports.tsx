import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Download, AlertTriangle, PackageCheck, Factory, Boxes, Wallet, ShoppingCart, History, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type AnyRow = Record<string, any>;

function toCSV(rows: AnyRow[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}

function downloadCSV(name: string, rows: AnyRow[]) {
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
}

function hoursSince(d?: string | null) {
  if (!d) return null;
  return (Date.now() - new Date(d).getTime()) / 3600000;
}

function riskBadge(h: number | null) {
  if (h === null) return <Badge variant="secondary">—</Badge>;
  if (h >= 72) return <Badge variant="destructive">Crítica · {Math.floor(h)}h</Badge>;
  if (h >= 24) return <Badge className="chip-warning">Alta · {Math.floor(h)}h</Badge>;
  return <Badge className="chip-warning">Reciente · {Math.floor(h)}h</Badge>;
}

function invStatusBadge(s: string) {
  const map: Record<string, { v: any; cls?: string; label: string }> = {
    fully_entered: { v: "default", cls: "chip-success", label: "Inventario completo" },
    partially_entered: { v: "default", cls: "chip-warning", label: "Parcial" },
    pending_inventory: { v: "destructive", label: "Pendiente inventario" },
    not_ready: { v: "secondary", label: "No listo" },
  };
  const m = map[s] ?? { v: "secondary", label: s };
  return <Badge variant={m.v} className={m.cls}>{m.label}</Badge>;
}

function defaultRange(days = 30) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function CoreReports() {
  const { user } = useAuth();
  const [range, setRange] = useState(defaultRange(30));
  const [search, setSearch] = useState("");

  const [units, setUnits] = useState<AnyRow[]>([]);
  const [orders, setOrders] = useState<AnyRow[]>([]);
  const [wooLogs, setWooLogs] = useState<AnyRow[]>([]);
  const [workEntries, setWorkEntries] = useState<AnyRow[]>([]);
  const [scanEvents, setScanEvents] = useState<AnyRow[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<AnyRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AnyRow[]>([]);
  const [operators, setOperators] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const fromISO = new Date(range.from).toISOString();
      const toISO = new Date(new Date(range.to).getTime() + 86400000).toISOString();
      const [u, o, w, we, se, pr, al, ops] = await Promise.all([
        supabase
          .from("core_production_units")
          .select(
            "id,unit_code,production_order_id,status,sku,variant_sku,size,entered_inventory_at,entered_inventory_by,inventory_entry_source,updated_at,created_at,core_product_id"
          )
          .order("updated_at", { ascending: false })
          .limit(2000),
        supabase
          .from("core_production_orders")
          .select(
            "id,order_code,status,total_quantity,completed_quantity,pending_quantity,product_name,sku,created_at,responsible_user_id"
          )
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("core_woo_write_logs")
          .select("*")
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("core_production_work_entries")
          .select(
            "id,unit_code,process_name,process_type,operator_id,operator_name_snapshot,rate_snapshot,payroll_amount,payroll_status,payroll_week_start,production_order_id,core_product_id,created_at,scanned_by_user_id"
          )
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .order("created_at", { ascending: false })
          .limit(3000),
        supabase
          .from("core_production_scan_events")
          .select(
            "id,unit_code,process_name,process_type,operator_id,operator_name_snapshot,event_type,status,created_at,scanned_by_user_id,production_order_id"
          )
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("core_payroll_runs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("core_audit_logs")
          .select("*")
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase.from("core_factory_operators").select("id,first_name,last_name,alias,status").limit(500),
      ]);
      if (cancelled) return;
      setUnits(u.data ?? []);
      setOrders(o.data ?? []);
      setWooLogs(w.data ?? []);
      setWorkEntries(we.data ?? []);
      setScanEvents(se.data ?? []);
      setPayrollRuns(pr.data ?? []);
      setAuditLogs(al.data ?? []);
      setOperators(ops.data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const opMap = useMemo(() => {
    const m = new Map<string, string>();
    operators.forEach((o) =>
      m.set(o.id, [o.alias, o.first_name, o.last_name].filter(Boolean).join(" ").trim() || "—")
    );
    return m;
  }, [operators]);

  const orderMap = useMemo(() => {
    const m = new Map<string, AnyRow>();
    orders.forEach((o) => m.set(o.id, o));
    return m;
  }, [orders]);

  const matchSearch = (s: string | null | undefined) =>
    !search.trim() || (s ?? "").toLowerCase().includes(search.trim().toLowerCase());

  const risk = useMemo(() => {
    return units
      .filter((u) => u.status !== "entered_inventory" && u.status !== "cancelled")
      .filter((u) => u.status === "completed" || u.status === "ready_for_inventory")
      .filter((u) => matchSearch(u.unit_code) || matchSearch(u.sku) || matchSearch(u.variant_sku));
  }, [units, search]);

  const entered = useMemo(
    () =>
      units
        .filter((u) => u.status === "entered_inventory")
        .filter((u) => matchSearch(u.unit_code) || matchSearch(u.sku) || matchSearch(u.variant_sku)),
    [units, search]
  );

  const unitsByOrder = useMemo(() => {
    const m = new Map<string, AnyRow[]>();
    units.forEach((u) => {
      if (!u.production_order_id) return;
      const a = m.get(u.production_order_id) ?? [];
      a.push(u);
      m.set(u.production_order_id, a);
    });
    return m;
  }, [units]);

  const orderInvStatus = (orderId: string): string => {
    const us = unitsByOrder.get(orderId) ?? [];
    if (!us.length) return "not_ready";
    const total = us.length;
    const ent = us.filter((u) => u.status === "entered_inventory").length;
    const ready = us.filter((u) => u.status === "completed" || u.status === "entered_inventory").length;
    if (ent === total) return "fully_entered";
    if (ent > 0) return "partially_entered";
    if (ready > 0) return "pending_inventory";
    return "not_ready";
  };

  // KPIs
  const kpis = useMemo(() => {
    const openOrders = orders.filter((o) => !["completed", "cancelled", "closed"].includes(o.status)).length;
    const inProd = units.filter((u) => u.status === "in_production").length;
    const completed = units.filter((u) => u.status === "completed").length;
    const inInv = units.filter((u) => u.status === "entered_inventory").length;
    const wooOk = wooLogs.filter((l) => l.status === "success").length;
    const wooFail = wooLogs.filter((l) => l.status === "failed").length;
    const previewsPending = wooLogs.filter((l) => l.status === "preview").length;
    const payPending = workEntries.filter((w) => w.payroll_status === "pending");
    const payPendingAmt = payPending.reduce((s, w) => s + Number(w.payroll_amount || 0), 0);
    return { openOrders, inProd, completed, inInv, wooOk, wooFail, previewsPending, payPendingCount: payPending.length, payPendingAmt };
  }, [orders, units, wooLogs, workEntries]);

  // Operators aggregation
  const opAgg = useMemo(() => {
    const m = new Map<string, { id: string; name: string; entries: number; units: Set<string>; amount: number; pending: number; paid: number }>();
    workEntries.forEach((w) => {
      const id = w.operator_id ?? "—";
      const cur = m.get(id) ?? {
        id,
        name: w.operator_name_snapshot ?? (id !== "—" ? opMap.get(id) ?? "—" : "Sin operario"),
        entries: 0,
        units: new Set<string>(),
        amount: 0,
        pending: 0,
        paid: 0,
      };
      cur.entries += 1;
      if (w.unit_code) cur.units.add(w.unit_code);
      const amt = Number(w.payroll_amount || 0);
      cur.amount += amt;
      if (w.payroll_status === "pending") cur.pending += amt;
      if (w.payroll_status === "paid") cur.paid += amt;
      m.set(id, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.amount - a.amount);
  }, [workEntries, opMap]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solo lectura · Auditoría operativa de producción, inventario, Woo y nómina.
          </p>
        </div>
        <Badge variant="outline">Read-only</Badge>
      </div>

      {/* Filtros globales */}
      <Card className="p-4 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Buscar (código OP / unidad / SKU)</Label>
            <Input placeholder="OP-000001, CAN0001-L..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setRange(defaultRange(1))}>Hoy</Button>
            <Button size="sm" variant="outline" onClick={() => setRange(defaultRange(7))}>7d</Button>
            <Button size="sm" variant="outline" onClick={() => setRange(defaultRange(30))}>30d</Button>
            <Button size="sm" variant="outline" onClick={() => setRange(defaultRange(90))}>90d</Button>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="resumen"><Activity className="h-3.5 w-3.5 mr-1" />Resumen</TabsTrigger>
          <TabsTrigger value="riesgo"><AlertTriangle className="h-3.5 w-3.5 mr-1" />Riesgo / Sin ingresar</TabsTrigger>
          <TabsTrigger value="inventario"><PackageCheck className="h-3.5 w-3.5 mr-1" />Ingresadas</TabsTrigger>
          <TabsTrigger value="ordenes"><Factory className="h-3.5 w-3.5 mr-1" />Órdenes</TabsTrigger>
          <TabsTrigger value="operarios"><Boxes className="h-3.5 w-3.5 mr-1" />Por operario</TabsTrigger>
          <TabsTrigger value="nomina"><Wallet className="h-3.5 w-3.5 mr-1" />Nómina</TabsTrigger>
          <TabsTrigger value="woo"><ShoppingCart className="h-3.5 w-3.5 mr-1" />WooCommerce</TabsTrigger>
          <TabsTrigger value="auditoria"><History className="h-3.5 w-3.5 mr-1" />Auditoría</TabsTrigger>
        </TabsList>

        {/* RESUMEN */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Órdenes abiertas" value={kpis.openOrders} />
            <KPI label="En producción" value={kpis.inProd} />
            <KPI label="Completadas" value={kpis.completed} />
            <KPI label="En inventario" value={kpis.inInv} />
            <KPI label="Sin ingresar" value={risk.length} tone={risk.length > 0 ? "danger" : "default"} />
            <KPI label="Woo OK" value={kpis.wooOk} tone="success" />
            <KPI label="Woo fallidos" value={kpis.wooFail} tone={kpis.wooFail > 0 ? "danger" : "default"} />
            <KPI label="Previews pendientes" value={kpis.previewsPending} />
            <KPI label="Trabajos pendientes nómina" value={kpis.payPendingCount} />
            <KPI label="Monto pendiente nómina" value={`$${kpis.payPendingAmt.toFixed(2)}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MiniList
              title="Últimas 10 ingresadas a inventario"
              rows={entered.slice(0, 10).map((u) => ({
                key: u.id,
                left: u.unit_code,
                right: fmtDate(u.entered_inventory_at),
                sub: `${u.variant_sku ?? u.sku ?? ""} ${u.size ?? ""}`.trim(),
              }))}
            />
            <MiniList
              title="Últimas 10 listas sin ingresar"
              rows={risk.slice(0, 10).map((u) => ({
                key: u.id,
                left: u.unit_code,
                right: fmtDate(u.updated_at),
                sub: `${u.variant_sku ?? u.sku ?? ""} ${u.size ?? ""}`.trim(),
                danger: true,
              }))}
            />
            <MiniList
              title="Últimos 10 movimientos Woo"
              rows={wooLogs.slice(0, 10).map((l) => ({
                key: l.id,
                left: `${l.action_type} · ${l.status}`,
                right: fmtDate(l.created_at),
                sub: `${l.sku ?? l.variant_sku ?? ""} Δ${l.quantity_delta ?? 0}`,
                danger: l.status === "failed",
              }))}
            />
            <MiniList
              title="Últimos 10 escaneos"
              rows={scanEvents.slice(0, 10).map((s) => ({
                key: s.id,
                left: `${s.unit_code ?? ""} · ${s.process_name ?? ""}`,
                right: fmtDate(s.created_at),
                sub: s.operator_name_snapshot ?? "",
              }))}
            />
          </div>
        </TabsContent>

        {/* RIESGO */}
        <TabsContent value="riesgo" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {risk.length} unidad(es) completadas pero NO ingresadas al inventario.
            </p>
            <Button size="sm" variant="outline" onClick={() => downloadCSV("riesgo_sin_ingresar", risk)}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidad</TableHead>
                  <TableHead>OP</TableHead>
                  <TableHead>SKU / Talla</TableHead>
                  <TableHead>Actualizada</TableHead>
                  <TableHead>Riesgo</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risk.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sin prendas en riesgo 🎉</TableCell></TableRow>
                )}
                {risk.slice(0, 500).map((u) => {
                  const ord = orderMap.get(u.production_order_id);
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono">{u.unit_code}</TableCell>
                      <TableCell>{ord?.order_code ?? "—"}</TableCell>
                      <TableCell className="text-xs">{u.variant_sku ?? u.sku ?? "—"} · {u.size ?? "—"}</TableCell>
                      <TableCell className="text-xs">{fmtDate(u.updated_at)}</TableCell>
                      <TableCell>{riskBadge(hoursSince(u.updated_at))}</TableCell>
                      <TableCell className="flex gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/core/escaneo?unit=${u.unit_code}`}>Escanear</Link>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/core/inventario`}>Inventario</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* INVENTARIO */}
        <TabsContent value="inventario" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{entered.length} unidad(es) ingresadas a inventario.</p>
            <Button size="sm" variant="outline" onClick={() => downloadCSV("ingresadas_inventario", entered)}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidad</TableHead>
                  <TableHead>OP</TableHead>
                  <TableHead>SKU / Talla</TableHead>
                  <TableHead>Ingreso</TableHead>
                  <TableHead>Fuente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entered.slice(0, 500).map((u) => {
                  const ord = orderMap.get(u.production_order_id);
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono">{u.unit_code}</TableCell>
                      <TableCell>{ord?.order_code ?? "—"}</TableCell>
                      <TableCell className="text-xs">{u.variant_sku ?? u.sku ?? "—"} · {u.size ?? "—"}</TableCell>
                      <TableCell className="text-xs">{fmtDate(u.entered_inventory_at)}</TableCell>
                      <TableCell className="text-xs">{u.inventory_entry_source ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ÓRDENES */}
        <TabsContent value="ordenes" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{orders.length} órden(es) en el rango.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCSV(
                  "ordenes",
                  orders.map((o) => {
                    const us = unitsByOrder.get(o.id) ?? [];
                    return {
                      order_code: o.order_code,
                      status: o.status,
                      product: o.product_name,
                      total: o.total_quantity,
                      completed: us.filter((u) => u.status === "completed" || u.status === "entered_inventory").length,
                      entered: us.filter((u) => u.status === "entered_inventory").length,
                      inv_status: orderInvStatus(o.id),
                      created_at: o.created_at,
                    };
                  })
                )
              }
            >
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OP</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Compl. / Ingr.</TableHead>
                  <TableHead>Inventario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders
                  .filter((o) => matchSearch(o.order_code) || matchSearch(o.product_name) || matchSearch(o.sku))
                  .slice(0, 500)
                  .map((o) => {
                    const us = unitsByOrder.get(o.id) ?? [];
                    const ent = us.filter((u) => u.status === "entered_inventory").length;
                    const comp = us.filter((u) => u.status === "completed" || u.status === "entered_inventory").length;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono">{o.order_code}</TableCell>
                        <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                        <TableCell className="text-xs">{o.product_name ?? "—"}</TableCell>
                        <TableCell>{o.total_quantity}</TableCell>
                        <TableCell className="text-xs">{comp} / {ent}</TableCell>
                        <TableCell>{invStatusBadge(orderInvStatus(o.id))}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* OPERARIOS */}
        <TabsContent value="operarios" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Agrupado por operario en el rango.</p>
            <Button size="sm" variant="outline" onClick={() => downloadCSV("trabajo_operarios", workEntries)}>
              <Download className="h-4 w-4 mr-1" /> CSV detalle
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operario</TableHead>
                  <TableHead>Trabajos</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pendiente</TableHead>
                  <TableHead>Pagado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opAgg.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{o.name}</TableCell>
                    <TableCell>{o.entries}</TableCell>
                    <TableCell>{o.units.size}</TableCell>
                    <TableCell>${o.amount.toFixed(2)}</TableCell>
                    <TableCell className={o.pending > 0 ? "text-orange-600 font-medium" : ""}>${o.pending.toFixed(2)}</TableCell>
                    <TableCell>${o.paid.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {opAgg.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sin trabajos en el rango.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* NÓMINA */}
        <TabsContent value="nomina" className="space-y-3">
          {(() => {
            const missingRate = workEntries.filter(
              (w) => w.payroll_status === "missing_rate" || w.rate_snapshot === null || w.rate_snapshot === undefined,
            ).length;
            const zeroRate = workEntries.filter(
              (w) =>
                w.payroll_status !== "missing_rate" &&
                w.rate_snapshot !== null &&
                w.rate_snapshot !== undefined &&
                Number(w.rate_snapshot) === 0,
            ).length;
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <KPI label="Pendientes" value={workEntries.filter((w) => w.payroll_status === "pending").length} />
                  <KPI label="Incluidos" value={workEntries.filter((w) => w.payroll_status === "included").length} />
                  <KPI label="Pagados" value={workEntries.filter((w) => w.payroll_status === "paid").length} />
                  <KPI label="Sin tarifa / revisar" value={missingRate} tone={missingRate > 0 ? "danger" : "default"} />
                  <KPI label="Tarifa 0.00 (definida)" value={zeroRate} />
                </div>
                <p className="text-xs text-muted-foreground">
                  «Sin tarifa / revisar» cuenta solo entradas con <code>payroll_status=missing_rate</code> o tarifa nula.
                  «Tarifa 0.00 (definida)» son procesos cuya estructura paga $0 — no son errores.
                </p>
              </>
            );
          })()}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{payrollRuns.length} nómina(s).</p>
            <Button size="sm" variant="outline" onClick={() => downloadCSV("nominas", payrollRuns)}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Operarios</TableHead>
                  <TableHead>Trabajos</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRuns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.payroll_code ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.period_start} → {r.period_end}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell>{r.operators_count}</TableCell>
                    <TableCell>{r.work_entries_count}</TableCell>
                    <TableCell>${Number(r.total_amount || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">{r.payment_date ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {payrollRuns.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sin nóminas.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* WOO */}
        <TabsContent value="woo" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPI label="Previews" value={wooLogs.filter((l) => l.status === "preview").length} />
            <KPI label="Success" value={wooLogs.filter((l) => l.status === "success").length} tone="success" />
            <KPI label="Failed" value={wooLogs.filter((l) => l.status === "failed").length} tone="danger" />
            <KPI label="Skipped" value={wooLogs.filter((l) => l.status === "skipped").length} />
            <KPI label="Reverted" value={wooLogs.filter((l) => l.status === "reverted").length} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{wooLogs.length} log(s) Woo.</p>
            <Button size="sm" variant="outline" onClick={() => downloadCSV("woo_write_logs", wooLogs)}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Δ</TableHead>
                  <TableHead>Confirmado</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wooLogs
                  .filter((l) => matchSearch(l.sku) || matchSearch(l.variant_sku) || matchSearch(l.idempotency_key))
                  .slice(0, 500)
                  .map((l) => {
                    const realWrite = l.status === "success" && l.confirmed_at;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{fmtDate(l.created_at)}</TableCell>
                        <TableCell className="text-xs">{l.action_type}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit">preview: {l.mode}</Badge>
                            {realWrite && (
                              <Badge className="chip-info w-fit">
                                Confirmado manualmente
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={l.status === "failed" ? "destructive" : "outline"}
                            className={l.status === "success" ? "chip-success" : ""}
                          >
                            {l.status}
                            {realWrite ? " · escritura real" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.sku ?? l.variant_sku ?? "—"}</TableCell>
                        <TableCell>{l.quantity_delta ?? 0}</TableCell>
                        <TableCell className="text-xs">{l.stock_after_confirmed ?? "—"} {l.confirmed_at ? `· ${fmtDate(l.confirmed_at)}` : ""}</TableCell>
                        <TableCell className="text-xs text-destructive">{l.error_message ?? ""}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* AUDITORÍA */}
        <TabsContent value="auditoria" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{auditLogs.length} evento(s).</p>
            <Button size="sm" variant="outline" onClick={() => downloadCSV("auditoria", auditLogs)}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
          <Card className="rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tabla</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>Antes → Después</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs
                  .filter((a) => matchSearch(a.table_name) || matchSearch(a.action) || matchSearch(a.performed_by))
                  .slice(0, 500)
                  .map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{fmtDate(a.created_at)}</TableCell>
                      <TableCell className="text-xs">{a.performed_by ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{a.table_name}</TableCell>
                      <TableCell className="text-xs">{a.action}</TableCell>
                      <TableCell className="text-xs">{a.field_changed ?? "—"}</TableCell>
                      <TableCell className="text-xs truncate max-w-[300px]">{(a.old_value ?? "∅")} → {(a.new_value ?? "∅")}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {loading && <p className="text-xs text-muted-foreground text-center">Cargando…</p>}
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: any; tone?: "default" | "success" | "danger" }) {
  const cls =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "success"
      ? "border-green-500/40 bg-green-500/5"
      : "border-border/60";
  return (
    <Card className={`p-4 rounded-2xl border ${cls}`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="num text-2xl font-black mt-1">{value}</p>
    </Card>
  );
}

function MiniList({ title, rows }: { title: string; rows: { key: string; left: string; right: string; sub?: string; danger?: boolean }[] }) {
  return (
    <Card className="p-4 rounded-2xl">
      <h3 className="text-sm font-bold mb-3">{title}</h3>
      <div className="space-y-1.5">
        {rows.length === 0 && <p className="text-xs text-muted-foreground">Sin datos.</p>}
        {rows.map((r) => (
          <div key={r.key} className={`flex items-center justify-between text-xs gap-2 py-1 border-b border-border/30 last:border-0 ${r.danger ? "text-destructive" : ""}`}>
            <div className="min-w-0">
              <p className="font-mono truncate">{r.left}</p>
              {r.sub && <p className="text-muted-foreground truncate">{r.sub}</p>}
            </div>
            <span className="shrink-0 text-muted-foreground">{r.right}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
