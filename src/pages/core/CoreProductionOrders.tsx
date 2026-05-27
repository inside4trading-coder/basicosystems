import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ClipboardList, Plus, Layers, QrCode, X, Ban, Lock, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { logCoreAudit } from "@/lib/coreAudit";

type Order = {
  id: string;
  order_code: string;
  status: string;
  order_type: string;
  priority: string;
  core_product_id: string | null;
  sku: string | null;
  product_name: string | null;
  total_quantity: number;
  completed_quantity: number;
  pending_quantity: number;
  source: string;
  expected_date: string | null;
  reason: string | null;
  notes: string | null;
  is_overproduction: boolean;
  manual_close_reason: string | null;
  cancelled_reason: string | null;
  created_at: string;
};

type Line = {
  id: string;
  production_order_id: string;
  core_variant_id: string | null;
  sku: string | null;
  variant_sku: string | null;
  variant_label: string | null;
  size: string | null;
  quantity_ordered: number;
  quantity_completed: number;
  quantity_pending: number;
  status: string;
};

type Process = {
  id: string;
  production_order_id: string;
  process_name: string;
  process_type: string | null;
  process_order: number;
  adds_to_payroll: boolean;
  suggested_role: string | null;
  status: string;
};

type Need = {
  id: string;
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
  status: string;
  priority: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", open: "Abierta", in_production: "En producción",
  partially_completed: "Parcial", completed: "Completada",
  closed: "Cerrada", cancelled: "Cancelada", manually_closed: "Cierre manual",
};
const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  open: "bg-blue-100 text-blue-800 border-blue-300",
  in_production: "bg-amber-100 text-amber-800 border-amber-300",
  partially_completed: "bg-amber-100 text-amber-800 border-amber-300",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  closed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-100 text-red-800 border-red-300",
  manually_closed: "bg-orange-100 text-orange-800 border-orange-300",
};

const OPEN_STATUSES = ["draft", "open"];
const PROD_STATUSES = ["in_production", "partially_completed"];
const DONE_STATUSES = ["completed"];
const CLOSED_STATUSES = ["closed", "manually_closed"];

export default function CoreProductionOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allLines, setAllLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState<null | "in_production" | "open" | "cancelled" | "manually_closed">(null);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  const [fromNeedsOpen, setFromNeedsOpen] = useState(false);
  const [approvedNeeds, setApprovedNeeds] = useState<Need[]>([]);
  const [selectedNeeds, setSelectedNeeds] = useState<Record<string, number>>({});
  const [allowOver, setAllowOver] = useState(false);
  const [creating, setCreating] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [manualProductId, setManualProductId] = useState("");
  const [manualVariants, setManualVariants] = useState<any[]>([]);
  const [manualQuantities, setManualQuantities] = useState<Record<string, number>>({});
  const [manualReason, setManualReason] = useState("");
  const [manualPriority, setManualPriority] = useState("media");
  const [manualNotes, setManualNotes] = useState("");
  const [manualExpected, setManualExpected] = useState("");

  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailLines, setDetailLines] = useState<Line[]>([]);
  const [detailProcesses, setDetailProcesses] = useState<Process[]>([]);
  const [detailLinks, setDetailLinks] = useState<any[]>([]);

  const [closeOpen, setCloseOpen] = useState<Order | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const [cancelOpen, setCancelOpen] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("core_production_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    const ords = ((data as any) ?? []) as Order[];
    setOrders(ords);
    const ids = ords.map((o) => o.id);
    if (ids.length) {
      const { data: lns } = await supabase
        .from("core_production_order_lines")
        .select("*")
        .in("production_order_id", ids);
      setAllLines((lns as any) ?? []);
    } else {
      setAllLines([]);
    }
    setSelectedOrders(new Set());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const linesByOrder = useMemo(() => {
    const m: Record<string, Line[]> = {};
    for (const l of allLines) (m[l.production_order_id] ||= []).push(l);
    return m;
  }, [allLines]);

  const runBulk = async () => {
    const ids = Array.from(selectedOrders);
    if (!ids.length || !bulkOpen) return;
    if ((bulkOpen === "cancelled" || bulkOpen === "manually_closed") && !bulkReason.trim()) {
      toast.error("Motivo obligatorio");
      return;
    }
    setBulkRunning(true);
    try {
      const patch: any = { status: bulkOpen };
      if (bulkOpen === "cancelled") {
        patch.cancelled_reason = bulkReason;
        patch.cancelled_at = new Date().toISOString();
      }
      if (bulkOpen === "manually_closed") {
        patch.manual_close_reason = bulkReason;
        patch.manual_close_notes = bulkReason;
        patch.manually_closed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("core_production_orders")
        .update(patch)
        .in("id", ids);
      if (error) throw error;
      for (const id of ids) {
        await logCoreAudit({
          table: "core_production_orders", recordId: id,
          action: `bulk_${bulkOpen}`, field: "status",
          oldValue: null, newValue: bulkOpen,
        });
      }
      toast.success(`${ids.length} orden(es) actualizadas`);
      setBulkOpen(null); setBulkReason("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error en acción masiva");
    } finally {
      setBulkRunning(false);
    }
  };

  const kpis = useMemo(() => {
    const open = orders.filter((o) => OPEN_STATUSES.includes(o.status));
    const prod = orders.filter((o) => PROD_STATUSES.includes(o.status));
    const done = orders.filter((o) => DONE_STATUSES.includes(o.status));
    const closed = orders.filter((o) => CLOSED_STATUSES.includes(o.status));
    const cancelled = orders.filter((o) => o.status === "cancelled");
    return {
      open: open.length,
      open_units: open.reduce((a, o) => a + Number(o.pending_quantity), 0),
      prod_units: prod.reduce((a, o) => a + Number(o.pending_quantity), 0),
      done_units: done.reduce((a, o) => a + Number(o.completed_quantity), 0),
      closed: closed.length,
      cancelled: cancelled.length,
      last: orders[0]?.created_at ?? null,
    };
  }, [orders]);

  const openFromNeeds = async () => {
    const { data } = await supabase
      .from("core_production_needs")
      .select("*")
      .eq("status", "approved")
      .gt("quantity_pending", 0)
      .order("created_at", { ascending: false });
    setApprovedNeeds((data as any) ?? []);
    setSelectedNeeds({});
    setAllowOver(false);
    setFromNeedsOpen(true);
  };

  const submitFromNeeds = async () => {
    const need_ids = Object.keys(selectedNeeds).filter((k) => selectedNeeds[k] > 0);
    if (!need_ids.length) {
      toast.error("Selecciona al menos una necesidad");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "core-create-production-order",
        {
          body: {
            mode: "from_needs",
            need_ids,
            quantities: selectedNeeds,
            allow_overproduction: allowOver,
          },
        },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Órdenes creadas: ${(data as any).count}`);
      setFromNeedsOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error creando órdenes");
    } finally {
      setCreating(false);
    }
  };

  const openManual = async () => {
    if (!products.length) {
      const { data } = await supabase
        .from("core_products")
        .select("id, core_sku, name")
        .order("name", { ascending: true });
      setProducts(data ?? []);
    }
    setManualProductId("");
    setManualVariants([]);
    setManualQuantities({});
    setManualReason("");
    setManualPriority("media");
    setManualNotes("");
    setManualExpected("");
    setManualOpen(true);
  };

  useEffect(() => {
    if (!manualProductId) { setManualVariants([]); return; }
    supabase
      .from("core_product_variants")
      .select("id, variant_sku, variant_label, size")
      .eq("core_product_id", manualProductId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setManualVariants(data ?? []));
  }, [manualProductId]);

  const submitManual = async () => {
    if (!manualProductId) { toast.error("Selecciona producto"); return; }
    if (!manualReason) { toast.error("Motivo obligatorio"); return; }
    const lines = Object.entries(manualQuantities)
      .filter(([_, q]) => Number(q) > 0)
      .map(([core_variant_id, quantity]) => ({ core_variant_id, quantity: Number(quantity) }));
    if (!lines.length) { toast.error("Agrega al menos una talla con cantidad"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "core-create-production-order",
        {
          body: {
            mode: "manual",
            core_product_id: manualProductId,
            lines,
            reason: manualReason,
            priority: manualPriority,
            notes: manualNotes || null,
            expected_date: manualExpected || null,
          },
        },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Orden manual creada: ${(data as any).created?.[0]?.order_code}`);
      setManualOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error creando orden manual");
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (o: Order) => {
    setDetailOrder(o);
    const [{ data: lines }, { data: procs }, { data: links }] = await Promise.all([
      supabase.from("core_production_order_lines").select("*").eq("production_order_id", o.id),
      supabase.from("core_production_order_processes").select("*").eq("production_order_id", o.id).order("process_order"),
      supabase.from("core_production_order_need_links").select("*, core_production_needs(variant_sku, product_name, size)").eq("production_order_id", o.id),
    ]);
    setDetailLines((lines as any) ?? []);
    setDetailProcesses((procs as any) ?? []);
    setDetailLinks((links as any) ?? []);
  };

  const changeStatus = async (o: Order, newStatus: string) => {
    const { error } = await supabase
      .from("core_production_orders")
      .update({ status: newStatus })
      .eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    await logCoreAudit({
      table: "core_production_orders", recordId: o.id,
      action: "change_status", field: "status",
      oldValue: o.status, newValue: newStatus,
    });
    toast.success("Estado actualizado");
    await load();
    if (detailOrder?.id === o.id) setDetailOrder({ ...o, status: newStatus });
  };

  const submitClose = async () => {
    if (!closeOpen) return;
    if (!closeReason || !closeNotes) {
      toast.error("Motivo y observación obligatorios");
      return;
    }
    const { error } = await supabase
      .from("core_production_orders")
      .update({
        status: "manually_closed",
        manual_close_reason: closeReason,
        manual_close_notes: closeNotes,
        manually_closed_at: new Date().toISOString(),
      })
      .eq("id", closeOpen.id);
    if (error) { toast.error(error.message); return; }
    await logCoreAudit({
      table: "core_production_orders", recordId: closeOpen.id,
      action: "manual_close", field: "status",
      oldValue: closeOpen.status, newValue: "manually_closed",
    });
    toast.success("Orden cerrada manualmente");
    setCloseOpen(null); setCloseReason(""); setCloseNotes("");
    await load();
  };

  const submitCancel = async () => {
    if (!cancelOpen) return;
    if (!cancelReason) { toast.error("Motivo obligatorio"); return; }
    const { error } = await supabase
      .from("core_production_orders")
      .update({
        status: "cancelled",
        cancelled_reason: cancelReason,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", cancelOpen.id);
    if (error) { toast.error(error.message); return; }
    await logCoreAudit({
      table: "core_production_orders", recordId: cancelOpen.id,
      action: "cancel", field: "status",
      oldValue: cancelOpen.status, newValue: "cancelled",
    });
    toast.success("Orden cancelada");
    setCancelOpen(null); setCancelReason("");
    await load();
  };

  const renderRow = (o: Order) => {
    const lines = linesByOrder[o.id] ?? [];
    const checked = selectedOrders.has(o.id);
    return (
      <TableRow key={o.id} data-state={checked ? "selected" : undefined}>
        <TableCell className="w-[36px]">
          <Checkbox
            checked={checked}
            onCheckedChange={(c) => {
              setSelectedOrders((prev) => {
                const next = new Set(prev);
                if (c) next.add(o.id); else next.delete(o.id);
                return next;
              });
            }}
            aria-label="Seleccionar orden"
          />
        </TableCell>
        <TableCell className="font-mono text-sm">{o.order_code}</TableCell>
        <TableCell>
          <Badge variant="outline" className={STATUS_BADGE[o.status]}>
            {STATUS_LABEL[o.status] ?? o.status}
          </Badge>
          {o.is_overproduction && (
            <Badge variant="outline" className="ml-1 bg-orange-100 text-orange-800 border-orange-300">
              Sobreprod.
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <div className="font-medium">{o.product_name}</div>
          <div className="text-xs text-muted-foreground font-mono">{o.sku}</div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1 max-w-[260px]">
            {lines.length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : lines.map((l) => (
              <Badge
                key={l.id}
                variant="outline"
                className="bg-primary/10 text-primary border-primary/30 font-bold text-[11px] px-2 py-0.5"
                title={l.variant_sku ?? ""}
              >
                {(l.size ?? l.variant_label ?? "?")}
                <span className="ml-1 font-semibold text-foreground/80">×{l.quantity_ordered}</span>
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell className="text-right">{o.total_quantity}</TableCell>
        <TableCell className="text-right">{o.pending_quantity}</TableCell>
        <TableCell className="text-right">{o.completed_quantity}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{o.source}</TableCell>
        <TableCell className="text-xs">{new Date(o.created_at).toLocaleString()}</TableCell>
        <TableCell className="text-right">
          <Button size="sm" variant="outline" onClick={() => openDetail(o)}>
            <Eye className="h-3 w-3 mr-1" /> Ver
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  const filterTable = (statuses: string[]) => {
    const rows = orders.filter((o) => statuses.includes(o.status));
    const allChecked = rows.length > 0 && rows.every((r) => selectedOrders.has(r.id));
    const someChecked = rows.some((r) => selectedOrders.has(r.id));
    return (
      <Card className="p-4 mt-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[36px]">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(c) => {
                    setSelectedOrders((prev) => {
                      const next = new Set(prev);
                      if (c) rows.forEach((r) => next.add(r.id));
                      else rows.forEach((r) => next.delete(r.id));
                      return next;
                    });
                  }}
                  aria-label="Seleccionar todo"
                />
              </TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tallas</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pend.</TableHead>
              <TableHead className="text-right">Compl.</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Creada</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  Sin órdenes en esta vista.
                </TableCell>
              </TableRow>
            ) : rows.map(renderRow)}
          </TableBody>
        </Table>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Órdenes de Producción
          </h1>
          <p className="text-sm text-muted-foreground">
            Convierte necesidades aprobadas en órdenes reales de fábrica.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openManual}>
            <Plus className="h-4 w-4 mr-1" /> Nueva manual
          </Button>
          <Button onClick={openFromNeeds}>
            <Layers className="h-4 w-4 mr-1" /> Crear desde necesidades
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Abiertas</div><div className="text-2xl font-bold">{kpis.open}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Unid. pendientes</div><div className="text-2xl font-bold">{kpis.open_units}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">En producción</div><div className="text-2xl font-bold">{kpis.prod_units}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Completadas</div><div className="text-2xl font-bold">{kpis.done_units}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Cerradas</div><div className="text-2xl font-bold">{kpis.closed}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Canceladas</div><div className="text-2xl font-bold">{kpis.cancelled}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Última</div><div className="text-xs">{kpis.last ? new Date(kpis.last).toLocaleString() : "—"}</div></Card>
      </div>

      {selectedOrders.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/5 animate-fade-in">
          <div className="text-sm font-semibold">
            {selectedOrders.size} orden{selectedOrders.size === 1 ? "" : "es"} seleccionada{selectedOrders.size === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => setSelectedOrders(new Set())}>Cancelar</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen("in_production")}>Marcar en producción</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen("open")}>Volver a abierta</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen("manually_closed")}>
              <Lock className="h-3 w-3 mr-1" /> Cerrar manualmente
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setBulkOpen("cancelled")}>
              <Ban className="h-3 w-3 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="open">

        <TabsList>
          <TabsTrigger value="open">Abiertas</TabsTrigger>
          <TabsTrigger value="prod">En producción</TabsTrigger>
          <TabsTrigger value="done">Completadas</TabsTrigger>
          <TabsTrigger value="closed">Cerradas</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
        </TabsList>
        <TabsContent value="open">{filterTable(OPEN_STATUSES)}</TabsContent>
        <TabsContent value="prod">{filterTable(PROD_STATUSES)}</TabsContent>
        <TabsContent value="done">{filterTable(DONE_STATUSES)}</TabsContent>
        <TabsContent value="closed">{filterTable(CLOSED_STATUSES)}</TabsContent>
        <TabsContent value="cancelled">{filterTable(["cancelled"])}</TabsContent>
      </Tabs>

      {/* Crear desde necesidades */}
      <Dialog open={fromNeedsOpen} onOpenChange={setFromNeedsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crear orden desde necesidades aprobadas</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto">
            {approvedNeeds.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No hay necesidades aprobadas con pendientes.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Producto / Talla</TableHead>
                    <TableHead className="text-right">Aprob.</TableHead>
                    <TableHead className="text-right">Pend.</TableHead>
                    <TableHead className="text-right w-32">Convertir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedNeeds.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <Checkbox
                          checked={!!selectedNeeds[n.id]}
                          onCheckedChange={(c) => {
                            setSelectedNeeds((prev) => {
                              const next = { ...prev };
                              if (c) next[n.id] = Number(n.quantity_pending);
                              else delete next[n.id];
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{n.product_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {n.variant_sku} · talla {n.size ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{n.quantity_approved}</TableCell>
                      <TableCell className="text-right">{n.quantity_pending}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          value={selectedNeeds[n.id] ?? ""}
                          onChange={(e) => setSelectedNeeds((p) => ({
                            ...p, [n.id]: Number(e.target.value),
                          }))}
                          className="h-8 w-24 ml-auto"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="overproduction"
              checked={allowOver}
              onCheckedChange={(c) => setAllowOver(!!c)}
            />
            <Label htmlFor="overproduction" className="text-sm">
              Permitir sobreproducción (convertir más de lo aprobado)
            </Label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFromNeedsOpen(false)}>Cancelar</Button>
            <Button onClick={submitFromNeeds} disabled={creating}>
              {creating ? "Creando..." : "Crear orden(es)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva orden manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Producto de fabricación *</Label>
              <Select value={manualProductId} onValueChange={setManualProductId}>
                <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.core_sku} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {manualVariants.length > 0 && (
              <div>
                <Label>Tallas / Variaciones</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-auto">
                  {manualVariants.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <span className="font-mono">{v.variant_sku}</span>
                        <span className="text-muted-foreground ml-2">{v.size}</span>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={manualQuantities[v.id] ?? ""}
                        onChange={(e) => setManualQuantities((p) => ({
                          ...p, [v.id]: Number(e.target.value),
                        }))}
                        className="h-8 w-24"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Motivo *</Label>
                <Select value={manualReason} onValueChange={setManualReason}>
                  <SelectTrigger><SelectValue placeholder="Selecciona motivo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restock_preventivo">Restock preventivo</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="pedido_especial">Pedido especial</SelectItem>
                    <SelectItem value="prueba">Producción de prueba</SelectItem>
                    <SelectItem value="reposicion_visual">Reposición visual</SelectItem>
                    <SelectItem value="ajuste_interno">Ajuste interno</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={manualPriority} onValueChange={setManualPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha esperada</Label>
                <Input type="date" value={manualExpected} onChange={(e) => setManualExpected(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={submitManual} disabled={creating}>
              {creating ? "Creando..." : "Crear orden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle */}
      <Sheet open={!!detailOrder} onOpenChange={(o) => !o && setDetailOrder(null)}>
        <SheetContent className="w-[640px] sm:max-w-[640px] overflow-y-auto">
          {detailOrder && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="font-mono">{detailOrder.order_code}</span>
                  <Badge variant="outline" className={STATUS_BADGE[detailOrder.status]}>
                    {STATUS_LABEL[detailOrder.status] ?? detailOrder.status}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <Card className="p-3">
                  <div className="font-medium">{detailOrder.product_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{detailOrder.sku}</div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                    <div><div className="text-xs text-muted-foreground">Total</div>{detailOrder.total_quantity}</div>
                    <div><div className="text-xs text-muted-foreground">Pendientes</div>{detailOrder.pending_quantity}</div>
                    <div><div className="text-xs text-muted-foreground">Completadas</div>{detailOrder.completed_quantity}</div>
                  </div>
                  {detailOrder.is_overproduction && (
                    <Badge variant="outline" className="mt-2 bg-orange-100 text-orange-800 border-orange-300">
                      Sobreproducción autorizada
                    </Badge>
                  )}
                  {detailOrder.manual_close_reason && (
                    <div className="mt-2 text-xs">
                      <span className="font-medium">Cierre manual:</span> {detailOrder.manual_close_reason}
                    </div>
                  )}
                  {detailOrder.cancelled_reason && (
                    <div className="mt-2 text-xs">
                      <span className="font-medium">Cancelada:</span> {detailOrder.cancelled_reason}
                    </div>
                  )}
                </Card>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Líneas por talla</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Talla</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Ord.</TableHead>
                        <TableHead className="text-right">Compl.</TableHead>
                        <TableHead className="text-right">Pend.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailLines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.size ?? l.variant_label}</TableCell>
                          <TableCell className="font-mono text-xs">{l.variant_sku}</TableCell>
                          <TableCell className="text-right">{l.quantity_ordered}</TableCell>
                          <TableCell className="text-right">{l.quantity_completed}</TableCell>
                          <TableCell className="text-right">{l.quantity_pending}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Procesos requeridos</h4>
                  {detailProcesses.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Sin procesos asociados a la estructura de costos.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Proceso</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead>Nómina</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailProcesses.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.process_order}</TableCell>
                            <TableCell>{p.process_name}</TableCell>
                            <TableCell className="text-xs">{p.suggested_role ?? "—"}</TableCell>
                            <TableCell>{p.adds_to_payroll ? "Sí" : "No"}</TableCell>
                            <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Necesidades origen</h4>
                  {detailLinks.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Sin necesidades vinculadas (orden manual).</div>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {detailLinks.map((l: any) => (
                        <li key={l.id} className="flex justify-between border rounded p-2">
                          <span className="font-mono text-xs">
                            {l.core_production_needs?.variant_sku ?? l.production_need_id}
                          </span>
                          <span>cant. tomada: <b>{l.quantity_taken}</b></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {detailOrder.status === "open" && (
                    <Button size="sm" onClick={() => changeStatus(detailOrder, "in_production")}>
                      Marcar en producción
                    </Button>
                  )}
                  {detailOrder.status === "in_production" && (
                    <Button size="sm" variant="outline" onClick={() => changeStatus(detailOrder, "open")}>
                      Volver a abierta
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled title="Se construye en el siguiente bloque">
                    <QrCode className="h-3 w-3 mr-1" /> Generar QR / Ficha Viajera
                  </Button>
                  {!["closed", "cancelled", "manually_closed"].includes(detailOrder.status) && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setCloseOpen(detailOrder)}>
                        <Lock className="h-3 w-3 mr-1" /> Cerrar manualmente
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setCancelOpen(detailOrder)}>
                        <Ban className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground italic pt-2">
                  QR / ficha viajera / escaneo / nómina / inventario se construirán en bloques posteriores.
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Cerrar manual */}
      <Dialog open={!!closeOpen} onOpenChange={(o) => !o && setCloseOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cerrar orden manualmente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo *</Label>
              <Input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
            </div>
            <div>
              <Label>Observación *</Label>
              <Textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseOpen(null)}>Cancelar</Button>
            <Button onClick={submitClose}>Cerrar orden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <Dialog open={!!cancelOpen} onOpenChange={(o) => !o && setCancelOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar orden</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo *</Label>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(null)}>Volver</Button>
            <Button variant="destructive" onClick={submitCancel}>Confirmar cancelación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk action confirm */}
      <Dialog open={!!bulkOpen} onOpenChange={(o) => { if (!o) { setBulkOpen(null); setBulkReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkOpen === "in_production" && "Marcar en producción"}
              {bulkOpen === "open" && "Volver a abierta"}
              {bulkOpen === "manually_closed" && "Cerrar manualmente (masivo)"}
              {bulkOpen === "cancelled" && "Cancelar órdenes (masivo)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>Se aplicará a <b>{selectedOrders.size}</b> orden(es) seleccionada(s).</div>
            {(bulkOpen === "cancelled" || bulkOpen === "manually_closed") && (
              <div>
                <Label>Motivo *</Label>
                <Textarea value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setBulkOpen(null); setBulkReason(""); }}>Volver</Button>
            <Button
              variant={bulkOpen === "cancelled" ? "destructive" : "default"}
              onClick={runBulk}
              disabled={bulkRunning}
            >
              {bulkRunning ? "Aplicando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
