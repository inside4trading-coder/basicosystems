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
import { ListChecks, Play, Plus, RotateCcw, History, AlertCircle, CheckCircle2, Ban, Pencil, AlertTriangle } from "lucide-react";
import { PolicyEventsAttentionPanel } from "@/components/core/woocore/PolicyEventsAttentionPanel";
import ExternalRestockList from "@/components/core/needs/ExternalRestockList";
import { useReplenishmentPolicyEvents } from "@/hooks/useReplenishmentPolicyEvents";
import { toast } from "sonner";
import { logCoreAudit } from "@/lib/coreAudit";
import { formatDMY } from "@/lib/dateUtils";

type Need = {
  id: string;
  need_type: string;
  status: string;
  priority: string;
  core_product_id: string | null;
  core_variant_id: string | null;
  sku: string | null;
  variant_sku: string | null;
  product_name: string | null;
  variant_label: string | null;
  size: string | null;
  quantity_needed: number;
  quantity_approved: number;
  quantity_converted_to_order: number;
  quantity_pending: number;
  source: string;
  last_sale_at: string | null;
  reason: string | null;
  notes: string | null;
  is_overproduction: boolean;
  created_at: string;
};

type Run = {
  id: string; created_at: string; status: string;
  movements_checked: number; needs_created: number; needs_updated: number;
  movements_linked: number; reversals_detected: number; skipped_existing: number;
  blocked_count: number; non_restockable_skipped: number; summary: any;
};

type ConvertedLink = {
  id: string;
  production_need_id: string;
  production_order_id: string;
  quantity_taken: number;
  created_at: string;
  order_code: string | null;
  order_status: string | null;
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  open: "Abierta",
  in_progress: "En proceso",
  ready_to_print: "Lista para imprimir",
  printing: "Imprimiendo",
  in_production: "En producción",
  closed: "Completada",
  manually_closed: "Cerrada manual",
  cancelled: "Cancelada",
};
const ORDER_STATUS_BADGE: Record<string, string> = {
  closed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  manually_closed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente", review: "En revisión", approved: "Aprobada",
  partially_converted: "Parcial", converted_to_order: "Convertida",
  ignored: "Denegada", cancelled: "Cancelada", blocked: "Bloqueada",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  review: "bg-orange-100 text-orange-800 border-orange-300",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-300",
  partially_converted: "bg-blue-100 text-blue-800 border-blue-300",
  converted_to_order: "bg-blue-100 text-blue-800 border-blue-300",
  ignored: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
  blocked: "bg-destructive/10 text-destructive border-destructive/30",
};
const PRIORITY_BADGE: Record<string, string> = {
  alta: "bg-red-100 text-red-800 border-red-300",
  media: "bg-yellow-100 text-yellow-800 border-yellow-300",
  baja: "bg-muted text-muted-foreground border-border",
};

const OPEN_STATUSES = ["pending", "review", "approved", "partially_converted"];

export default function CoreProductionNeeds() {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [links, setLinks] = useState<ConvertedLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [periodStart, setPeriodStart] = useState<string>("");
  const [manualOpen, setManualOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState<Need | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [manual, setManual] = useState({
    core_product_id: "", core_variant_id: "", quantity: "1",
    reason: "Restock preventivo", priority: "media", desired_date: "", notes: "",
  });

  async function load() {
    setLoading(true);
    const [{ data: n }, { data: r }, { data: l }] = await Promise.all([
      supabase.from("core_production_needs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("core_production_need_runs").select("*").order("created_at", { ascending: false }).limit(20),
      supabase
        .from("core_production_order_need_links")
        .select("id, production_need_id, production_order_id, quantity_taken, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const linkRows = (l as any[]) ?? [];
    const orderIds = Array.from(new Set(linkRows.map((row) => row.production_order_id).filter(Boolean)));
    const ordersMap = new Map<string, { order_code: string | null; status: string | null }>();
    if (orderIds.length) {
      const { data: ords } = await supabase
        .from("core_production_orders")
        .select("id, order_code, status")
        .in("id", orderIds);
      (ords ?? []).forEach((o: any) => ordersMap.set(o.id, { order_code: o.order_code, status: o.status }));
    }
    setNeeds((n as Need[]) ?? []);
    setRuns((r as Run[]) ?? []);
    setLinks(
      linkRows.map((row) => ({
        id: row.id,
        production_need_id: row.production_need_id,
        production_order_id: row.production_order_id,
        quantity_taken: Number(row.quantity_taken),
        created_at: row.created_at,
        order_code: ordersMap.get(row.production_order_id)?.order_code ?? null,
        order_status: ordersMap.get(row.production_order_id)?.status ?? null,
      })),
    );
    setLoading(false);
  }

  async function loadCatalog() {
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase.from("core_products").select("id, name, core_sku").order("name").limit(500),
      supabase.from("core_product_variants").select("id, core_product_id, size, variant_label, variant_sku").order("size").limit(2000),
    ]);
    setProducts(p ?? []);
    setVariants(v ?? []);
  }

  useEffect(() => { load(); loadCatalog(); }, []);

  useEffect(() => {
    const handler = () => { load(); };
    window.addEventListener("core-needs-refresh", handler);
    return () => window.removeEventListener("core-needs-refresh", handler);
  }, []);

  async function runGeneration(dry = false) {
    setRunning(true);
    try {
      const body: any = { dry_run: dry };
      if (periodStart) body.period_start = new Date(periodStart).toISOString();
      const { data, error } = await supabase.functions.invoke("core-generate-production-needs", {
        body,
      });
      if (error) throw error;
      const d: any = data;
      if (dry) {
        toast.success(`Simulación: ${d.eligible_groups} grupos, ${d.movements_checked} movimientos`);
      } else {
        toast.success(`Generado: ${d.needs_created} nuevas, ${d.needs_updated} actualizadas, ${d.movements_linked} mov. enlazados`);
      }
      // Alertas fuertes por descartes silenciosos
      const reasons = (d?.by_skip_reason ?? {}) as Record<string, number>;
      const missingIds = Number(reasons["missing_core_ids"] ?? 0);
      const insertFails = Object.entries(reasons).filter(([k]) => k.startsWith("insert_failed") || k === "update_failed").reduce((a, [, v]) => a + Number(v ?? 0), 0);
      if (missingIds > 0) {
        toast.error(
          `⚠️ ${missingIds} movimiento(s) DESCARTADOS por falta de variante/producto Core. Revisa "Partidas de Fabricación → Pendientes".`,
          { duration: 15000 },
        );
      }
      if (insertFails > 0) {
        toast.error(`⚠️ ${insertFails} necesidad(es) fallaron al insertarse. Revisa logs.`, { duration: 15000 });
      }
      if (Number(d?.non_restockable_skipped ?? 0) > 0) {
        toast.warning(`${d.non_restockable_skipped} mov. omitidos por control de reposición activo.`, { duration: 8000 });
      }

      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setRunning(false);
    }
  }

  async function changeStatus(need: Need, newStatus: string) {
    const { error } = await supabase
      .from("core_production_needs")
      .update({ status: newStatus })
      .eq("id", need.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({
      table: "core_production_needs", recordId: need.id,
      action: "status_change", field: "status",
      oldValue: need.status, newValue: newStatus,
    });
    toast.success("Estado actualizado");
    load();
  }

  async function approveAll(need: Need) {
    const { error } = await supabase
      .from("core_production_needs")
      .update({ quantity_approved: need.quantity_needed, status: "approved" })
      .eq("id", need.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({
      table: "core_production_needs", recordId: need.id,
      action: "approve_all", newValue: String(need.quantity_needed),
    });
    toast.success("Aprobada");
    load();
  }

  async function submitAdjust() {
    if (!adjustOpen) return;
    const n = Number(adjustQty);
    if (!Number.isFinite(n) || n < 0) return toast.error("Cantidad inválida");
    if (!adjustReason.trim()) return toast.error("Motivo obligatorio");
    const overproduction = n > adjustOpen.quantity_needed;
    const { error } = await supabase
      .from("core_production_needs")
      .update({
        quantity_approved: n,
        is_overproduction: overproduction,
        status: n > 0 ? "approved" : adjustOpen.status,
        notes: [adjustOpen.notes, `Ajuste: ${adjustReason}`].filter(Boolean).join(" | "),
      })
      .eq("id", adjustOpen.id);
    if (error) return toast.error(error.message);
    await logCoreAudit({
      table: "core_production_needs", recordId: adjustOpen.id,
      action: "adjust_quantity", field: "quantity_approved",
      oldValue: adjustOpen.quantity_approved, newValue: n,
    });
    toast.success("Cantidad ajustada");
    setAdjustOpen(null); setAdjustQty(""); setAdjustReason("");
    load();
  }

  async function createManual() {
    if (!manual.core_product_id) return toast.error("Producto obligatorio");
    const variantsForProd = variants.filter(v => v.core_product_id === manual.core_product_id);
    if (variantsForProd.length > 0 && !manual.core_variant_id) return toast.error("Variante obligatoria");
    const qty = Number(manual.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Cantidad debe ser > 0");
    if (!manual.reason) return toast.error("Motivo obligatorio");
    const prod = products.find(p => p.id === manual.core_product_id);
    const vr = variants.find(v => v.id === manual.core_variant_id);
    const { data, error } = await supabase.from("core_production_needs").insert({
      need_type: "manual_restock",
      status: "pending",
      priority: manual.priority,
      core_product_id: manual.core_product_id,
      core_variant_id: manual.core_variant_id || null,
      sku: prod?.core_sku,
      variant_sku: vr?.variant_sku,
      product_name: prod?.name,
      variant_label: vr?.variant_label,
      size: vr?.size,
      quantity_needed: qty,
      quantity_pending: qty,
      source: "manual",
      reason: manual.reason,
      desired_date: manual.desired_date || null,
      notes: manual.notes || null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    await logCoreAudit({
      table: "core_production_needs", recordId: data?.id,
      action: "manual_create", newValue: JSON.stringify({ qty, reason: manual.reason }),
    });
    toast.success("Necesidad manual creada");
    setManualOpen(false);
    setManual({ core_product_id: "", core_variant_id: "", quantity: "1", reason: "Restock preventivo", priority: "media", desired_date: "", notes: "" });
    load();
  }

  // KPIs
  const kpis = useMemo(() => {
    const open = needs.filter(n => OPEN_STATUSES.includes(n.status));
    const unitsPending = open.reduce((s, n) => s + Number(n.quantity_needed) - Number(n.quantity_converted_to_order), 0);
    const products = new Set(open.map(n => n.core_product_id).filter(Boolean));
    const sizes = new Set(open.map(n => `${n.core_product_id}-${n.size}`));
    return {
      open: open.length,
      unitsPending,
      products: products.size,
      sizes: sizes.size,
      approved: needs.filter(n => n.status === "approved").length,
      converted: needs.filter(n => n.status === "converted_to_order").length,
      blocked: needs.filter(n => n.status === "blocked").length,
      lastRun: runs[0]?.created_at,
    };
  }, [needs, runs]);

  const openNeeds = useMemo(() => needs.filter(n => OPEN_STATUSES.includes(n.status)), [needs]);
  const denied = useMemo(() => needs.filter(n => n.status === "ignored"), [needs]);

  const byProduct = useMemo(() => {
    const m = new Map<string, { product_name: string; sku: string; total: number; sizes: Need[] }>();
    for (const n of openNeeds) {
      const k = n.core_product_id ?? n.id;
      const cur = m.get(k) ?? { product_name: n.product_name ?? "-", sku: n.sku ?? "-", total: 0, sizes: [] };
      cur.total += Number(n.quantity_needed) - Number(n.quantity_converted_to_order);
      cur.sizes.push(n);
      m.set(k, cur);
    }
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v }));
  }, [openNeeds]);

  const manuals = useMemo(() => needs.filter(n => n.need_type === "manual_restock"), [needs]);

  const converted = useMemo(() => {
    const needsById = new Map(needs.map((n) => [n.id, n]));
    return links
      .map((l) => {
        const n = needsById.get(l.production_need_id);
        return {
          link_id: l.id,
          created_at: l.created_at,
          quantity_taken: l.quantity_taken,
          order_code: l.order_code,
          order_status: l.order_status,
          product_name: n?.product_name ?? null,
          sku: n?.sku ?? null,
          variant_sku: n?.variant_sku ?? null,
          size: n?.size ?? n?.variant_label ?? null,
          need_status: n?.status ?? null,
          need_id: l.production_need_id,
          completed: l.order_status === "closed" || l.order_status === "manually_closed",
        };
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [links, needs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <ListChecks className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Necesidades de Producción</h1>
            <p className="text-sm text-muted-foreground">Qué hay que fabricar, generado desde Partidas de Fabricación.</p>
          </div>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex flex-col">
            <Label className="text-xs mb-1">Contar ventas desde</Label>
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="h-9 w-[160px]"
              title="Sólo procesa ventas creadas a partir de esta fecha. Dejar vacío para incluir todo el histórico."
            />
          </div>
          <Button variant="outline" onClick={() => runGeneration(true)} disabled={running}>
            <RotateCcw className="h-4 w-4 mr-2" />Simular
          </Button>
          <Button onClick={() => runGeneration(false)} disabled={running}>
            <Play className="h-4 w-4 mr-2" />Generar desde Partidas
          </Button>
          <Button variant="secondary" onClick={() => setManualOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Nueva manual
          </Button>
        </div>
      </div>

      <PolicyEventsSummaryBar />

      <Tabs defaultValue="internal">
        <TabsList>
          <TabsTrigger value="internal">Fabricación interna</TabsTrigger>
          <TabsTrigger value="external">Proveedor externo</TabsTrigger>
          <AttentionTabTrigger />
        </TabsList>

        <TabsContent value="attention" className="mt-4">
          <PolicyEventsAttentionPanel />
        </TabsContent>

        <TabsContent value="external" className="mt-4">
          <ExternalRestockList />
        </TabsContent>


        <TabsContent value="internal" className="mt-4">

      <Tabs defaultValue="summary">

        <TabsList>
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="open">Abiertas ({openNeeds.length})</TabsTrigger>
          <TabsTrigger value="byProduct">Por producto</TabsTrigger>
          <TabsTrigger value="bySize">Por talla</TabsTrigger>
          <TabsTrigger value="manuals">Manuales ({manuals.length})</TabsTrigger>
          <TabsTrigger value="converted">Convertidas ({converted.length})</TabsTrigger>
          <TabsTrigger value="denied">Denegadas ({denied.length})</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Abiertas" value={kpis.open} />
            <Kpi label="Unidades pendientes" value={kpis.unitsPending} />
            <Kpi label="Productos afectados" value={kpis.products} />
            <Kpi label="Tallas afectadas" value={kpis.sizes} />
            <Kpi label="Aprobadas" value={kpis.approved} />
            <Kpi label="Convertidas" value={kpis.converted} />
            <Kpi label="Bloqueadas" value={kpis.blocked} />
            <Kpi label="Última generación" value={kpis.lastRun ? new Date(kpis.lastRun).toLocaleString() : "—"} small />
          </div>
        </TabsContent>

        <TabsContent value="open">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>SKU variante</TableHead>
                  <TableHead className="text-right">Necesaria</TableHead>
                  <TableHead className="text-right">Aprobada</TableHead>
                  <TableHead className="text-right">Convertida</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Última venta</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={11}>Cargando…</TableCell></TableRow>}
                {!loading && openNeeds.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Sin necesidades abiertas.</TableCell></TableRow>
                )}
                {openNeeds.map(n => (
                  <TableRow key={n.id}>
                    <TableCell><Badge variant="outline" className={STATUS_BADGE[n.status]}>{STATUS_LABEL[n.status] ?? n.status}</Badge></TableCell>
                    <TableCell><div className="font-medium">{n.product_name ?? "-"}</div><div className="text-xs text-muted-foreground">{n.sku}</div></TableCell>
                    <TableCell>{n.size ?? n.variant_label ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{n.variant_sku ?? "-"}</TableCell>
                    <TableCell className="text-right">{n.quantity_needed}</TableCell>
                    <TableCell className="text-right">{n.quantity_approved}</TableCell>
                    <TableCell className="text-right">{n.quantity_converted_to_order}</TableCell>
                    <TableCell><Badge variant="outline" className={PRIORITY_BADGE[n.priority]}>{n.priority}</Badge></TableCell>
                    <TableCell className="text-xs">{n.need_type === "sale_generated" ? "Venta" : "Manual"}</TableCell>
                    <TableCell className="text-xs">{n.last_sale_at ? formatDMY(n.last_sale_at) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => approveAll(n)} title="Aprobar todo">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setAdjustOpen(n); setAdjustQty(String(n.quantity_approved || n.quantity_needed)); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => changeStatus(n, "review")}>Revisar</Button>
                        <Button size="sm" variant="outline" onClick={() => changeStatus(n, "ignored")}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toast.info("Las Órdenes de Producción se construirán en el siguiente bloque.")}>
                          Preparar OP
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="byProduct">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Total unidades</TableHead>
                  <TableHead>Tallas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byProduct.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sin datos.</TableCell></TableRow>}
                {byProduct.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="text-right font-bold">{p.total}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {p.sizes.map(s => (
                          <Badge key={s.id} variant="outline">{s.size ?? "-"}: {Number(s.quantity_needed) - Number(s.quantity_converted_to_order)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="bySize">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>SKU variante</TableHead>
                  <TableHead className="text-right">Necesaria</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openNeeds.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin datos.</TableCell></TableRow>}
                {openNeeds.map(n => (
                  <TableRow key={n.id}>
                    <TableCell>{n.product_name}</TableCell>
                    <TableCell>{n.size ?? n.variant_label ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{n.variant_sku ?? "-"}</TableCell>
                    <TableCell className="text-right">{n.quantity_needed}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_BADGE[n.status]}>{STATUS_LABEL[n.status]}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="manuals">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manuals.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin necesidades manuales.</TableCell></TableRow>}
                {manuals.map(n => (
                  <TableRow key={n.id}>
                    <TableCell>{n.product_name}</TableCell>
                    <TableCell>{n.size ?? "-"}</TableCell>
                    <TableCell className="text-right">{n.quantity_needed}</TableCell>
                    <TableCell>{n.reason}</TableCell>
                    <TableCell><Badge variant="outline" className={PRIORITY_BADGE[n.priority]}>{n.priority}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_BADGE[n.status]}>{STATUS_LABEL[n.status]}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(n.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="converted">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha conversión</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>SKU variante</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Orden producción</TableHead>
                  <TableHead>Estado OP</TableHead>
                  <TableHead>Completada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {converted.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin necesidades convertidas todavía.</TableCell></TableRow>
                )}
                {converted.map((c) => (
                  <TableRow key={c.link_id}>
                    <TableCell className="text-xs">{formatDMY(c.created_at)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.product_name ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">{c.sku ?? ""}</div>
                    </TableCell>
                    <TableCell>{c.size ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{c.variant_sku ?? "-"}</TableCell>
                    <TableCell className="text-right font-semibold">{c.quantity_taken}</TableCell>
                    <TableCell className="font-mono text-xs">{c.order_code ?? "—"}</TableCell>
                    <TableCell>
                      {c.order_status ? (
                        <Badge variant="outline" className={ORDER_STATUS_BADGE[c.order_status] ?? ""}>
                          {ORDER_STATUS_LABEL[c.order_status] ?? c.order_status}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {c.completed ? (
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Sí
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border">No</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="denied">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>SKU variante</TableHead>
                  <TableHead className="text-right">Necesaria</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Última venta</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {denied.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin necesidades denegadas.</TableCell></TableRow>
                )}
                {denied.map(n => (
                  <TableRow key={n.id}>
                    <TableCell><Badge variant="outline" className={STATUS_BADGE[n.status]}>{STATUS_LABEL[n.status] ?? n.status}</Badge></TableCell>
                    <TableCell><div className="font-medium">{n.product_name ?? "-"}</div><div className="text-xs text-muted-foreground">{n.sku}</div></TableCell>
                    <TableCell>{n.size ?? n.variant_label ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{n.variant_sku ?? "-"}</TableCell>
                    <TableCell className="text-right">{n.quantity_needed}</TableCell>
                    <TableCell className="text-xs">{n.need_type === "sale_generated" ? "Venta" : "Manual"}</TableCell>
                    <TableCell className="text-xs">{n.last_sale_at ? formatDMY(n.last_sale_at) : "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => changeStatus(n, "pending")}>Reactivar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>



        <TabsContent value="history">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Mov. revisados</TableHead>
                  <TableHead className="text-right">Creadas</TableHead>
                  <TableHead className="text-right">Actualizadas</TableHead>
                  <TableHead className="text-right">Enlaces</TableHead>
                  <TableHead className="text-right">Saltadas</TableHead>
                  <TableHead className="text-right">No restock</TableHead>
                  <TableHead className="text-right">Reversos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin ejecuciones.</TableCell></TableRow>}
                {runs.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="text-right">{r.movements_checked}</TableCell>
                    <TableCell className="text-right">{r.needs_created}</TableCell>
                    <TableCell className="text-right">{r.needs_updated}</TableCell>
                    <TableCell className="text-right">{r.movements_linked}</TableCell>
                    <TableCell className="text-right">{r.skipped_existing}</TableCell>
                    <TableCell className="text-right">{r.non_restockable_skipped}</TableCell>
                    <TableCell className="text-right">{r.reversals_detected}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

        </TabsContent>
      </Tabs>


      {/* Adjust dialog */}
      <Dialog open={!!adjustOpen} onOpenChange={(o) => !o && setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar cantidad aprobada</DialogTitle></DialogHeader>
          {adjustOpen && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {adjustOpen.product_name} · {adjustOpen.size ?? "-"} · Necesaria: {adjustOpen.quantity_needed}
              </div>
              <div>
                <Label>Nueva cantidad aprobada</Label>
                <Input type="number" min={0} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
              </div>
              <div>
                <Label>Motivo</Label>
                <Textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
              </div>
              {Number(adjustQty) > adjustOpen.quantity_needed && (
                <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Sobreproducción aprobada
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(null)}>Cancelar</Button>
            <Button onClick={submitAdjust}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva necesidad manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Producto</Label>
              <Select value={manual.core_product_id} onValueChange={(v) => setManual(m => ({ ...m, core_product_id: v, core_variant_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.core_sku} — {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Variante / talla</Label>
              <Select value={manual.core_variant_id} onValueChange={(v) => setManual(m => ({ ...m, core_variant_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {variants.filter(v => v.core_product_id === manual.core_product_id).map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.size ?? v.variant_label} — {v.variant_sku ?? ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cantidad</Label>
                <Input type="number" min={1} value={manual.quantity} onChange={(e) => setManual(m => ({ ...m, quantity: e.target.value }))} />
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={manual.priority} onValueChange={(v) => setManual(m => ({ ...m, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Motivo</Label>
              <Select value={manual.reason} onValueChange={(v) => setManual(m => ({ ...m, reason: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Restock preventivo","Evento","Reposición visual","Pedido especial","Ajuste manual","Prueba de producción","Otro"].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha deseada</Label>
              <Input type="date" value={manual.desired_date} onChange={(e) => setManual(m => ({ ...m, desired_date: e.target.value }))} />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={manual.notes} onChange={(e) => setManual(m => ({ ...m, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={createManual}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttentionTabTrigger() {
  const { counts } = useReplenishmentPolicyEvents();
  const total = counts.total ?? 0;
  const active = total > 0;
  return (
    <TabsTrigger
      value="attention"
      className={
        active
          ? "chip-error data-[state=active]:bg-[hsl(var(--status-error))] data-[state=active]:text-white animate-pulse motion-reduce:animate-none"
          : ""
      }
    >
      Requieren atención
      {active && (
        <Badge className="num ml-2 bg-background text-[hsl(var(--status-error))] hover:bg-background">{total}</Badge>
      )}
    </TabsTrigger>
  );
}

function PolicyEventsSummaryBar() {
  const { counts } = useReplenishmentPolicyEvents();
  const total = counts.total ?? 0;
  const rep = counts.suggest_replacement ?? 0;
  const ext = counts.external_supplier_review ?? 0;
  const man = counts.manual_cost_review ?? 0;
  const blocked =
    (counts.block_no_restock ?? 0) + (counts.block_exit ?? 0) + (counts.block_ignored ?? 0);
  const missingMap = counts.missing_map ?? 0;
  const missingCost = (counts.missing_cost ?? 0) + (counts.financial_review ?? 0);
  const unclassified = counts.unclassified_fund ?? 0;
  const configIssues = missingMap + missingCost + unclassified;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <MiniCard label="Reemplazos" value={rep} />
        <MiniCard label="Proveedor externo" value={ext} />
        <MiniCard label="Costo manual" value={man} />
        <MiniCard label="Bloqueadas" value={blocked} />
        <MiniCard
          label="Problemas de configuración"
          value={configIssues}
          highlight={configIssues > 0}
        />
        <MiniCard label="Total atención" value={total} highlight={total > 0} />
      </div>
      {total > 0 && (
        <div className="flex items-center gap-2 rounded border border-red-500 bg-red-500/10 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <div className="flex-1">
            Hay <strong>{total}</strong> ventas o reposiciones que requieren una decisión.
            <span className="text-xs text-muted-foreground ml-2">
              {rep} reemplazos · {ext} proveedor externo · {blocked} bloqueadas · {missingMap} sin
              mapeo · {missingCost} sin costo · {unclassified} sin clasificar
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const trigger = document.querySelector<HTMLButtonElement>(
                '[role="tab"][value="attention"]',
              );
              trigger?.click();
            }}
          >
            Revisar ahora
          </Button>
        </div>
      )}
    </div>
  );
}

function MiniCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={`p-3 ${highlight ? "border-amber-500" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </Card>
  );
}

function Kpi({ label, value, small }: { label: string; value: any; small?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={small ? "text-sm font-semibold mt-1" : "text-2xl font-black mt-1"}>{value ?? "—"}</div>
    </Card>
  );
}
