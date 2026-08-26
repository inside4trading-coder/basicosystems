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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ClipboardList, Plus, Layers, QrCode, X, Ban, Lock, Eye, ShieldAlert, PackageCheck, PackageOpen, FileDown, Search,
} from "lucide-react";
import { toast } from "sonner";
import { logCoreAudit } from "@/lib/coreAudit";
import { normalizeSize } from "@/lib/coreNormalize";
import { ProductionPipelineSection } from "@/components/core/ProductionPipelineSection";
import { PolicyBlockedDialog } from "@/components/core/woocore/PolicyBlockedDialog";
import { parsePolicyBlocked, type BlockedLine } from "@/lib/policyBlocked";
import { downloadProductionOrderBackupPdf } from "@/lib/coreProductionOrderPdf";
import { CancelledUnitsTab } from "@/components/core/CancelledUnitsTab";

type Unit = {
  id: string;
  unit_code: string;
  production_order_id: string;
  core_variant_id: string | null;
  variant_sku: string | null;
  variant_label: string | null;
  size: string | null;
  status: string;
  entered_inventory_at: string | null;
  entered_inventory_by: string | null;
  inventory_entry_source: string | null;
  updated_at: string | null;
};

type OrderInvStats = {
  total: number;              // unidades activas (excluye canceladas)
  completed: number;          // terminadas de producción (listas + ingresadas)
  entered: number;            // ingresadas a inventario
  cancelled: number;          // canceladas / descartadas
  closed: number;             // terminadas + canceladas
  pending: number;            // faltantes reales (en producción + sin iniciar)
  pending_inventory: number;  // listas sin ingresar
  in_production: number;      // con procesos iniciados, sin terminar
  not_started: number;        // sin iniciar
  has_units: boolean;
  status: "not_ready" | "pending_inventory" | "partially_entered" | "fully_entered";
};

const CANCELLED_UNIT_STATUSES = ["cancelled", "discarded"];
const INVENTORIED_UNIT_STATUSES = ["entered_inventory", "sent_to_store"];

function computeInvStats(units: Unit[], totalQuantityFallback: number): OrderInvStats {
  const cancelled = units.filter((u) => CANCELLED_UNIT_STATUSES.includes(u.status)).length;
  const active = units.filter((u) => !CANCELLED_UNIT_STATUSES.includes(u.status));
  const has_units = units.length > 0;
  const total = has_units ? active.length : totalQuantityFallback;
  const entered = active.filter((u) => INVENTORIED_UNIT_STATUSES.includes(u.status)).length;
  const pending_inventory = active.filter((u) => u.status === "completed").length;
  const in_production = active.filter((u) => u.status === "in_production").length;
  const not_started = Math.max(0, active.length - entered - pending_inventory - in_production);
  const completed = entered + pending_inventory;
  const pending = in_production + not_started;
  const closed = completed + cancelled;
  let status: OrderInvStats["status"] = "not_ready";
  if (total > 0 && entered === total) status = "fully_entered";
  else if (entered > 0) status = "partially_entered";
  else if (pending_inventory > 0) status = "pending_inventory";
  return {
    total, completed, entered, cancelled, closed, pending, pending_inventory,
    in_production, not_started, has_units, status,
  };
}

function summarizeOrderUnits(inv: OrderInvStats | undefined): string | null {
  if (!inv || !inv.has_units) return null;
  const parts = [`Inventario ${inv.entered}/${inv.total}`];
  parts.push(`Faltan ${inv.pending}`);
  if (inv.pending_inventory > 0) parts.push(`${inv.pending_inventory} lista${inv.pending_inventory === 1 ? "" : "s"} sin ingresar`);
  if (inv.cancelled > 0) parts.push(`${inv.cancelled} cancelada${inv.cancelled === 1 ? "" : "s"}`);
  return parts.join(" · ");
}


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

type ManualItemLine = {
  core_variant_id: string;
  quantity: number;
  size: string | null;
  color: string | null;
  variant_label: string | null;
  variant_sku: string | null;
};

const buildVariantDisplayLabel = (v: { size?: string | null; color?: string | null; variant_label?: string | null; variant_sku?: string | null }) => {
  const size = v.size?.trim() || null;
  const color = v.color?.trim() || null;
  const label = v.variant_label?.trim() || null;
  if (color && size) return `${color} / ${size}`;
  if (label && size) return `${label} / ${size}`;
  if (label) return label;
  if (color) return color;
  if (size) return size;
  return v.variant_sku?.trim() || "Variante";
};

type ManualItem = {
  core_product_id: string;
  core_sku: string | null;
  product_name: string | null;
  notes: string | null;
  lines: ManualItemLine[];
};

export default function CoreProductionOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allLines, setAllLines] = useState<Line[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
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
  const [manualItemNotes, setManualItemNotes] = useState("");
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [manualReason, setManualReason] = useState("");
  const [manualPriority, setManualPriority] = useState("media");
  const [manualNotes, setManualNotes] = useState("");
  const [manualExpected, setManualExpected] = useState("");


  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailLines, setDetailLines] = useState<Line[]>([]);
  const [detailProcesses, setDetailProcesses] = useState<Process[]>([]);
  const [detailLinks, setDetailLinks] = useState<any[]>([]);
  const [detailUnits, setDetailUnits] = useState<Unit[]>([]);
  const [detailUserMap, setDetailUserMap] = useState<Record<string, string>>({});

  const [closeOpen, setCloseOpen] = useState<Order | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const [cancelOpen, setCancelOpen] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [policyBlocked, setPolicyBlocked] = useState<BlockedLine[] | null>(null);

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
      const [{ data: lns }, { data: uns }] = await Promise.all([
        supabase.from("core_production_order_lines").select("*").in("production_order_id", ids),
        supabase
          .from("core_production_units")
          .select(
            "id, unit_code, production_order_id, core_variant_id, variant_sku, variant_label, size, status, entered_inventory_at, entered_inventory_by, inventory_entry_source, updated_at",
          )
          .in("production_order_id", ids),
      ]);
      setAllLines((lns as any) ?? []);
      setAllUnits((uns as any) ?? []);
    } else {
      setAllLines([]);
      setAllUnits([]);
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

  const unitsByOrder = useMemo(() => {
    const m: Record<string, Unit[]> = {};
    for (const u of allUnits) (m[u.production_order_id] ||= []).push(u);
    return m;
  }, [allUnits]);

  const invByOrder = useMemo(() => {
    const m: Record<string, OrderInvStats> = {};
    for (const o of orders) {
      m[o.id] = computeInvStats(unitsByOrder[o.id] ?? [], Number(o.total_quantity || 0));
    }
    return m;
  }, [orders, unitsByOrder]);

  // Alerta de custodia global: derivada de la MISMA fuente (invByOrder),
  // excluyendo OP canceladas para no inflar los totales.
  const custody = useMemo(() => {
    let ready = 0, entered = 0;
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const inv = invByOrder[o.id];
      if (!inv?.has_units) continue;
      ready += inv.pending_inventory;
      entered += inv.entered;
    }
    return { ready, entered };
  }, [orders, invByOrder]);
  const pendingInventoryUnits = custody.ready;
  const enteredInventoryUnits = custody.entered;


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

  // Una OP sale de "En producción" solo cuando no quedan faltantes reales
  // (en producción + sin iniciar) NI listas sin ingresar. Derivado de la misma
  // fuente única de cálculo (invByOrder / computeInvStats).
  const productionDoneByOrder = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const o of orders) {
      const inv = invByOrder[o.id];
      m[o.id] = !!inv?.has_units && inv.pending === 0 && inv.pending_inventory === 0;
    }
    return m;
  }, [orders, invByOrder]);

  const bucketOf = (o: Order): "open" | "prod" | "done" | "closed" | "cancelled" => {
    if (o.status === "cancelled") return "cancelled";
    if (CLOSED_STATUSES.includes(o.status)) return "closed";
    if (DONE_STATUSES.includes(o.status)) return "done";
    if (PROD_STATUSES.includes(o.status)) {
      return productionDoneByOrder[o.id] ? "done" : "prod";
    }
    if (OPEN_STATUSES.includes(o.status)) return "open";
    return "open";
  };

  const kpis = useMemo(() => {
    const open: Order[] = [], prod: Order[] = [], done: Order[] = [], closed: Order[] = [], cancelled: Order[] = [];
    for (const o of orders) {
      const b = bucketOf(o);
      if (b === "open") open.push(o);
      else if (b === "prod") prod.push(o);
      else if (b === "done") done.push(o);
      else if (b === "closed") closed.push(o);
      else if (b === "cancelled") cancelled.push(o);
    }
    const sumProd = (pick: (inv: OrderInvStats) => number) =>
      prod.reduce((a, o) => {
        const inv = invByOrder[o.id];
        return a + (inv?.has_units ? pick(inv) : 0);
      }, 0);
    return {
      // Órdenes (OP)
      open_orders: open.length,
      prod_orders: prod.length,
      done_orders: done.length,
      closed: closed.length,
      cancelled: cancelled.length,
      // Unidades (prendas) — misma definición que la tabla y el detalle
      prod_pending_units: sumProd((inv) => inv.pending),                  // en producción + sin iniciar
      prod_completed_units: sumProd((inv) => inv.completed),              // ingresadas + listas
      last: orders[0]?.created_at ?? null,
    };
  }, [orders, productionDoneByOrder, invByOrder]);


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
      const blocked = await parsePolicyBlocked(error, data);
      if (blocked) {
        setPolicyBlocked(blocked.blocked);
        toast.warning(blocked.message ?? "Bloqueado por política de reposición");
        return;
      }
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
    setManualItemNotes("");
    setManualItems([]);
    setProductSearch("");
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
      .select("id, variant_sku, variant_label, size, color")
      .eq("core_product_id", manualProductId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setManualVariants(data ?? []));
  }, [manualProductId]);

  const filteredManualProducts = useMemo(() => {
    const terms = productSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(Boolean);
    if (!terms.length) return products;
    return products.filter((p) => {
      const hay = `${p.core_sku ?? ""} ${p.name ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return terms.every((t) => hay.includes(t));
    });
  }, [products, productSearch]);

  const manualTotalUnits = useMemo(
    () => manualItems.reduce((a, it) => a + it.lines.reduce((s, l) => s + l.quantity, 0), 0),
    [manualItems],
  );

  const addManualItem = () => {
    if (!manualProductId) { toast.error("Selecciona producto"); return; }
    const lines = manualVariants
      .filter((v) => Number(manualQuantities[v.id] ?? 0) > 0)
      .map((v) => ({
        core_variant_id: v.id as string,
        quantity: Number(manualQuantities[v.id]),
        size: (v.size ?? null) as string | null,
        color: (v.color ?? null) as string | null,
        variant_label: (v.variant_label ?? null) as string | null,
        variant_sku: (v.variant_sku ?? null) as string | null,
      }));
    if (!lines.length) { toast.error("Agrega al menos una talla con cantidad"); return; }
    const prod = products.find((p) => p.id === manualProductId);
    setManualItems((prev) => {
      const idx = prev.findIndex((i) => i.core_product_id === manualProductId);
      if (idx === -1) {
        return [...prev, {
          core_product_id: manualProductId,
          core_sku: prod?.core_sku ?? null,
          product_name: prod?.name ?? null,
          notes: manualItemNotes || null,
          lines,
        }];
      }
      const merged = [...prev];
      const existing = merged[idx];
      const byVariant = new Map(existing.lines.map((l) => [l.core_variant_id, { ...l }]));
      for (const l of lines) {
        const prevLine = byVariant.get(l.core_variant_id);
        if (prevLine) prevLine.quantity += l.quantity;
        else byVariant.set(l.core_variant_id, { ...l });
      }
      merged[idx] = {
        ...existing,
        notes: manualItemNotes || existing.notes,
        lines: Array.from(byVariant.values()),
      };
      toast.info("Se sumaron cantidades a un producto ya agregado");
      return merged;
    });
    setManualProductId("");
    setManualVariants([]);
    setManualQuantities({});
    setManualItemNotes("");
    setProductSearch("");
  };

  const editManualItem = (item: ManualItem) => {
    setManualItems((prev) => prev.filter((i) => i.core_product_id !== item.core_product_id));
    setManualProductId(item.core_product_id);
    setManualQuantities(Object.fromEntries(item.lines.map((l) => [l.core_variant_id, l.quantity])));
    setManualItemNotes(item.notes ?? "");
  };

  const removeManualItem = (id: string) =>
    setManualItems((prev) => prev.filter((i) => i.core_product_id !== id));

  const closeManual = (open: boolean) => {
    if (!open && (manualItems.length > 0 || Object.values(manualQuantities).some((q) => Number(q) > 0))) {
      if (!window.confirm("Tienes productos cargados sin crear la orden. ¿Descartar cambios?")) return;
    }
    setManualOpen(open);
  };

  const submitManual = async () => {
    if (!manualReason) { toast.error("Motivo obligatorio"); return; }
    if (!manualItems.length) { toast.error("Agrega al menos un producto"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "core-create-production-order",
        {
          body: {
            mode: "manual",
            items: manualItems.map((i) => ({
              core_product_id: i.core_product_id,
              notes: i.notes,
              lines: i.lines.map((l) => ({ core_variant_id: l.core_variant_id, quantity: l.quantity })),
            })),
            reason: manualReason,
            priority: manualPriority,
            notes: manualNotes || null,
            expected_date: manualExpected || null,
          },
        },
      );
      const blocked = await parsePolicyBlocked(error, data);
      if (blocked) {
        setPolicyBlocked(blocked.blocked);
        toast.warning(blocked.message ?? "Bloqueado por política de reposición");
        return;
      }
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Orden manual creada: ${(data as any).created?.[0]?.order_code}`);
      setManualItems([]);
      setManualOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error creando orden manual");
    } finally {
      setCreating(false);
    }
  };


  const handleBackupPdf = async (o: Order) => {
    try {
      await downloadProductionOrderBackupPdf(o);
      toast.success(`PDF de respaldo generado: ${o.order_code}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error generando PDF de respaldo");
    }
  };

  const openDetail = async (o: Order) => {
    setDetailOrder(o);
    const [{ data: lines }, { data: procs }, { data: links }, { data: uns }] = await Promise.all([
      supabase.from("core_production_order_lines").select("*").eq("production_order_id", o.id),
      supabase.from("core_production_order_processes").select("*").eq("production_order_id", o.id).order("process_order"),
      supabase.from("core_production_order_need_links").select("*, core_production_needs(variant_sku, product_name, size)").eq("production_order_id", o.id),
      supabase
        .from("core_production_units")
        .select(
          "id, unit_code, production_order_id, core_variant_id, variant_sku, variant_label, size, status, entered_inventory_at, entered_inventory_by, inventory_entry_source, updated_at",
        )
        .eq("production_order_id", o.id)
        .order("unit_code"),
    ]);
    setDetailLines((lines as any) ?? []);
    setDetailProcesses((procs as any) ?? []);
    setDetailLinks((links as any) ?? []);
    const unitsArr = ((uns as any) ?? []) as Unit[];
    setDetailUnits(unitsArr);
    const userIds = Array.from(
      new Set(unitsArr.map((u) => u.entered_inventory_by).filter(Boolean) as string[]),
    );
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      const map: Record<string, string> = {};
      for (const p of (profiles as any[]) ?? []) {
        map[p.id] = p.full_name || p.email || p.id;
      }
      setDetailUserMap(map);
    } else {
      setDetailUserMap({});
    }
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

    // Liberar necesidades vinculadas: devolverlas a 'approved' con su pending restaurado
    const { data: links } = await supabase
      .from("core_production_order_need_links")
      .select("production_need_id, quantity_taken")
      .eq("production_order_id", cancelOpen.id);

    if (links && links.length) {
      const needIds = links.map((l: any) => l.production_need_id);
      const { data: needs } = await supabase
        .from("core_production_needs")
        .select("id, quantity_approved, quantity_converted_to_order, quantity_needed")
        .in("id", needIds);
      const takenByNeed = new Map<string, number>();
      for (const l of links) {
        takenByNeed.set(
          l.production_need_id,
          (takenByNeed.get(l.production_need_id) ?? 0) + Number(l.quantity_taken ?? 0),
        );
      }
      for (const n of needs ?? []) {
        const taken = takenByNeed.get(n.id) ?? 0;
        const newConverted = Math.max(0, Number(n.quantity_converted_to_order ?? 0) - taken);
        const approved = Number(n.quantity_approved ?? 0);
        const newPending = Math.max(0, approved - newConverted);
        const newStatus =
          newConverted <= 0
            ? "approved"
            : newConverted >= Number(n.quantity_needed ?? approved)
            ? "converted_to_order"
            : "partially_converted";
        await supabase
          .from("core_production_needs")
          .update({
            quantity_converted_to_order: newConverted,
            quantity_pending: newPending,
            status: newStatus,
          })
          .eq("id", n.id);
      }
      await supabase
        .from("core_production_order_need_links")
        .delete()
        .eq("production_order_id", cancelOpen.id);
    }

    await logCoreAudit({
      table: "core_production_orders", recordId: cancelOpen.id,
      action: "cancel", field: "status",
      oldValue: cancelOpen.status, newValue: "cancelled",
    });
    toast.success("Orden cancelada y necesidades liberadas");
    setCancelOpen(null); setCancelReason("");
    await load();
  };


  const renderInventoryBadge = (inv: OrderInvStats | undefined) => {
    if (!inv || inv.total === 0) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    if (inv.status === "fully_entered") {
      return (
        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
          <PackageCheck className="h-3 w-3 mr-1" /> {inv.entered}/{inv.total} ingresadas
        </Badge>
      );
    }
    if (inv.status === "pending_inventory") {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300" title="Prendas listas sin ingresar">
          <ShieldAlert className="h-3 w-3 mr-1" /> {inv.pending_inventory} sin ingresar
        </Badge>
      );
    }
    if (inv.status === "partially_entered") {
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300" title="Parcialmente ingresadas a inventario">
          <PackageOpen className="h-3 w-3 mr-1" /> {inv.entered}/{inv.total} · {inv.pending_inventory} pend.
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
        Sin producir
      </Badge>
    );
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
        <TableCell className="font-mono text-sm">
          <div>{o.order_code}</div>
          {(() => {
            const inv = invByOrder[o.id];
            const summary = summarizeOrderUnits(inv);
            if (!summary) {
              return (
                <div className="text-[10px] font-sans text-muted-foreground whitespace-nowrap">
                  Sin unidades generadas · {o.total_quantity} planificadas
                </div>
              );
            }
            return (
              <div className="text-[10px] font-sans text-muted-foreground whitespace-nowrap">
                Inventario {inv!.entered}/{inv!.total} ·{" "}
                <span className={inv!.pending > 0 ? "text-red-700 font-semibold" : ""}>
                  Faltan {inv!.pending}
                </span>
                {inv!.pending_inventory > 0 && ` · ${inv!.pending_inventory} lista${inv!.pending_inventory === 1 ? "" : "s"} sin ingresar`}
              </div>
            );
          })()}
        </TableCell>

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
          {(() => {
            const distinctProducts = Array.from(
              new Set(lines.map((l) => l.sku).filter(Boolean)),
            );
            if (distinctProducts.length > 1) {
              return (
                <div>
                  <div className="font-medium">
                    {distinctProducts.length} productos / {o.total_quantity} unidades
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate max-w-[260px]">
                    {distinctProducts.join(" + ")}
                  </div>
                </div>
              );
            }
            return (
              <>
                <div className="font-medium">{o.product_name}</div>
                <div className="text-xs text-muted-foreground font-mono">{o.sku}</div>
              </>
            );
          })()}
        </TableCell>
        <TableCell className="max-w-[220px]">
          <div className="flex items-center flex-nowrap gap-1 overflow-hidden">
            {lines.length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : (() => {
              const groups = new Map<string, number>();
              for (const l of lines) {
                const key = normalizeSize(l.size ?? l.variant_label ?? "?") || (l.size ?? l.variant_label ?? "?");
                groups.set(key, (groups.get(key) || 0) + (l.quantity_ordered || 0));
              }
              const sorted = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
              const visible = sorted.slice(0, 4);
              const hidden = sorted.length - visible.length;
              return (
                <>
                  {visible.map(([size, qty]) => (
                    <Badge
                      key={size}
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/30 font-bold text-[10px] px-1.5 py-0.5 whitespace-nowrap shrink-0"
                      title={`${size}: ${qty}`}
                    >
                      {size}
                      <span className="ml-1 font-semibold text-foreground/80">×{qty}</span>
                    </Badge>
                  ))}
                  {hidden > 0 && (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground border-border font-semibold text-[10px] px-1.5 py-0.5 whitespace-nowrap shrink-0"
                      title={sorted.slice(4).map(([s, q]) => `${s} ×${q}`).join(" · ")}
                    >
                      +{hidden} más
                    </Badge>
                  )}
                </>
              );
            })()}
          </div>
        </TableCell>
        <TableCell className="text-right">{invByOrder[o.id]?.has_units ? invByOrder[o.id].total : o.total_quantity}</TableCell>
        <TableCell className="text-right">
          <span className={(invByOrder[o.id]?.pending ?? 0) > 0 ? "text-red-700 font-semibold" : ""}>
            {invByOrder[o.id]?.has_units ? invByOrder[o.id].pending : o.pending_quantity}
          </span>
        </TableCell>
        <TableCell className="text-right">{invByOrder[o.id]?.has_units ? invByOrder[o.id].completed : o.completed_quantity}</TableCell>

        <TableCell>{renderInventoryBadge(invByOrder[o.id])}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{o.source}</TableCell>
        <TableCell className="text-xs">{new Date(o.created_at).toLocaleString()}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="outline" onClick={() => openDetail(o)}>
              <Eye className="h-3 w-3 mr-1" /> Ver
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBackupPdf(o)}>
              <FileDown className="h-3 w-3 mr-1" /> PDF respaldo
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const filterTable = (bucket: "open" | "prod" | "done" | "closed" | "cancelled") => {
    const rows = orders.filter((o) => bucketOf(o) === bucket);
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
              <TableHead className="text-right">Faltantes reales</TableHead>
              <TableHead className="text-right">Terminadas prod.</TableHead>

              <TableHead>Inventario</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Creada</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
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

      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="col-span-2 md:col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Órdenes</div>
          <Card className="p-3"><div className="text-xs text-muted-foreground">OP abiertas</div><div className="text-2xl font-bold">{kpis.open_orders}</div><div className="text-[10px] text-muted-foreground">órdenes</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">OP en producción</div><div className="text-2xl font-bold">{kpis.prod_orders}</div><div className="text-[10px] text-muted-foreground">órdenes activas/parciales</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">OP cerradas / canceladas</div><div className="text-xl font-bold">{kpis.closed} / {kpis.cancelled}</div><div className="text-[10px] text-muted-foreground">órdenes</div></Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
          <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Producción activa</div>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Unid. faltantes prod.</div><div className="text-2xl font-bold">{kpis.prod_pending_units}</div><div className="text-[10px] text-muted-foreground">faltantes en OP en producción</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Unid. terminadas prod.</div><div className="text-2xl font-bold">{kpis.prod_completed_units}</div><div className="text-[10px] text-muted-foreground">terminadas en OP en producción</div></Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 gap-3 border-l-4 border-amber-200 pl-3 -ml-1">
          <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> Inventario / custodia — global de OP cargadas
          </div>
          <Card className={`p-3 ${pendingInventoryUnits > 0 ? "border-red-300 bg-red-50" : ""}`}>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Listas sin ingresar
            </div>
            <div className={`text-2xl font-bold ${pendingInventoryUnits > 0 ? "text-red-700" : ""}`}>{pendingInventoryUnits}</div>
            <div className="text-[10px] text-muted-foreground">Global de OP cargadas</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <PackageCheck className="h-3 w-3" /> Ingresadas a inventario
            </div>
            <div className="text-2xl font-bold text-emerald-700">{enteredInventoryUnits}</div>
            <div className="text-[10px] text-muted-foreground">Global de OP cargadas</div>
          </Card>
        </div>
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
          <TabsTrigger value="cancelled_units">Prendas canceladas</TabsTrigger>
        </TabsList>
        <TabsContent value="open">{filterTable("open")}</TabsContent>
        <TabsContent value="prod">{filterTable("prod")}</TabsContent>
        <TabsContent value="done">{filterTable("done")}</TabsContent>
        <TabsContent value="closed">{filterTable("closed")}</TabsContent>
        <TabsContent value="cancelled">{filterTable("cancelled")}</TabsContent>
        <TabsContent value="cancelled_units">
          <CancelledUnitsTab
            onOpenOrder={(orderId) => {
              const o = orders.find((x) => x.id === orderId);
              if (o) openDetail(o);
            }}
          />
        </TabsContent>
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
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary text-primary-foreground font-bold text-sm px-2.5 py-0.5">
                            {n.size ?? "—"}
                          </Badge>
                          <div className="font-medium">{n.product_name}</div>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {n.variant_sku}
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
      <Dialog open={manualOpen} onOpenChange={closeManual}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva orden manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* A. Formulario de agregado */}
            <div className="rounded-md border p-3 space-y-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Agregar producto</div>
              <div>
                <Label>Producto de fabricación *</Label>
                <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {manualProductId
                          ? `${products.find((p) => p.id === manualProductId)?.core_sku ?? ""} — ${products.find((p) => p.id === manualProductId)?.name ?? ""}`
                          : "Selecciona producto"}
                      </span>
                      <Search className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-[95vw]" align="start">
                    <div className="p-2 border-b">
                      <Input
                        autoFocus
                        placeholder="Buscar producto por nombre o SKU…"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredManualProducts.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                          No se encontraron productos
                        </div>
                      ) : (
                        filteredManualProducts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                            onClick={() => {
                              setManualProductId(p.id);
                              setManualQuantities({});
                              setProductPickerOpen(false);
                            }}
                          >
                            <span className="font-mono text-xs text-muted-foreground mr-2">{p.core_sku}</span>
                            {p.name}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {manualVariants.length > 0 && (
                <div>
                  <Label>Tallas / Variaciones</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-auto">
                    {manualVariants.map((v) => {
                      const label = buildVariantDisplayLabel(v);
                      return (
                        <div key={v.id} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm min-w-0" title={label}>
                            <span className="text-sm font-medium truncate">{label}</span>
                            {v.variant_sku && (
                              <span className="font-mono text-xs text-muted-foreground truncate">{v.variant_sku}</span>
                            )}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={manualQuantities[v.id] ?? ""}
                            onChange={(e) => setManualQuantities((p) => ({
                              ...p, [v.id]: Number(e.target.value),
                            }))}
                            className="h-8 w-24 shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <Label>Observaciones del ítem</Label>
                <Input
                  value={manualItemNotes}
                  onChange={(e) => setManualItemNotes(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <Button type="button" variant="secondary" className="w-full" onClick={addManualItem}>
                <Plus className="h-4 w-4 mr-1" /> Agregar producto
              </Button>
            </div>

            {/* B. Lista de productos agregados */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  Productos agregados
                </div>
                <div className="text-xs text-muted-foreground">
                  {manualItems.length} producto(s) · {manualTotalUnits} unidad(es)
                </div>
              </div>
              {manualItems.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center">
                  Aún no has agregado productos a esta orden.
                </div>
              ) : (
                manualItems.map((it) => (
                  <div key={it.core_product_id} className="rounded-md border p-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium break-words">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{it.core_sku}</span>
                          {it.product_name}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {it.lines.map((l) => (
                            <Badge key={l.core_variant_id} variant="outline" className="text-xs" title={buildVariantDisplayLabel(l)}>
                              {buildVariantDisplayLabel(l)}: {l.quantity}
                            </Badge>
                          ))}
                        </div>
                        {it.notes && (
                          <div className="mt-1 text-xs text-muted-foreground break-words">{it.notes}</div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => editManualItem(it)}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => removeManualItem(it.core_product_id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Datos de la orden */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <Button variant="ghost" onClick={() => closeManual(false)}>Cancelar</Button>
            <Button onClick={submitManual} disabled={creating || !manualItems.length}>
              {creating ? "Creando..." : "Crear orden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Detalle */}
      <Sheet open={!!detailOrder} onOpenChange={(o) => !o && setDetailOrder(null)}>
        <SheetContent className="w-full max-w-full sm:w-[640px] sm:max-w-[640px] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          {detailOrder && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="flex flex-wrap items-center gap-2 pr-8">
                  <span className="font-mono break-all">{detailOrder.order_code}</span>
                  <Badge variant="outline" className={STATUS_BADGE[detailOrder.status]}>
                    {STATUS_LABEL[detailOrder.status] ?? detailOrder.status}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => handleBackupPdf(detailOrder)}>
                  <FileDown className="h-3 w-3 mr-1" /> PDF respaldo
                </Button>
              </div>
              <div className="space-y-4 mt-4 min-w-0">
                <Card className="p-3 min-w-0">
                  <div className="font-medium break-words">{detailOrder.product_name}</div>
                  <div className="text-xs text-muted-foreground font-mono break-all">{detailOrder.sku}</div>
                  {(() => {
                    const inv = invByOrder[detailOrder.id];
                    if (!inv?.has_units) {
                      return (
                        <div className="text-xs text-muted-foreground mt-2">
                          Sin unidades generadas · {detailOrder.total_quantity} planificadas
                        </div>
                      );
                    }
                    const estado =
                      inv.pending === 0 && inv.pending_inventory === 0
                        ? "Completa"
                        : inv.pending === 0
                          ? "Lista para inventario"
                          : "Parcial";
                    return (
                      <>
                        <div className="text-xs text-muted-foreground mt-2">
                          <span className="font-semibold text-foreground">{estado}</span> · Inventario {inv.entered}/{inv.total} ·{" "}
                          <span className={inv.pending > 0 ? "text-red-700 font-semibold" : ""}>Faltan {inv.pending}</span>
                          {inv.pending_inventory > 0 && ` · ${inv.pending_inventory} lista${inv.pending_inventory === 1 ? "" : "s"} sin ingresar`}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-sm">
                          <div><div className="text-xs text-muted-foreground">Total unidades</div>{inv.total}</div>
                          <div>
                            <div className="text-xs text-muted-foreground">Ingresadas a inventario</div>
                            <span className="text-emerald-700 font-semibold">{inv.entered}</span>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Listas para ingresar</div>
                            <span className={inv.pending_inventory > 0 ? "text-red-700 font-semibold" : ""}>{inv.pending_inventory}</span>
                          </div>
                          <div><div className="text-xs text-muted-foreground">En producción</div>{inv.in_production}</div>
                          <div><div className="text-xs text-muted-foreground">Sin iniciar</div>{inv.not_started}</div>
                          <div>
                            <div className="text-xs text-muted-foreground">Faltantes reales</div>
                            <span className={inv.pending > 0 ? "text-red-700 font-semibold" : ""}>{inv.pending}</span>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground" title="Ingresadas + listas para ingresar">Terminadas de producción</div>
                            {inv.completed}
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Canceladas</div>
                            <span className={inv.cancelled > 0 ? "text-red-700 font-semibold" : ""}>{inv.cancelled}</span>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Estado inventario</div>
                            {renderInventoryBadge(inv)}
                          </div>
                        </div>
                      </>
                    );
                  })()}


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

                <div className="min-w-0">
                  <h4 className="text-sm font-semibold mb-2">Líneas ({detailLines.length})</h4>
                  {/* Móvil: cards */}
                  <div className="grid gap-2 sm:hidden">
                    {detailLines.map((l) => (
                      <div key={l.id} className="rounded-lg border p-3 text-sm min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-xs break-all">{l.sku ?? "—"}</span>
                          <Badge variant="outline" className="shrink-0">{l.size ?? l.variant_label}</Badge>
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground break-all mt-1">{l.variant_sku}</div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                          <div><div className="text-muted-foreground">Ord.</div>{l.quantity_ordered}</div>
                          <div><div className="text-muted-foreground">Compl.</div>{l.quantity_completed}</div>
                          <div><div className="text-muted-foreground">Faltantes</div>{l.quantity_pending}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: tabla */}
                  <div className="hidden sm:block w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Talla</TableHead>
                          <TableHead>SKU variante</TableHead>
                          <TableHead className="text-right">Ord.</TableHead>
                          <TableHead className="text-right">Compl.</TableHead>
                          <TableHead className="text-right">Faltantes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailLines.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-mono text-xs">{l.sku ?? "—"}</TableCell>
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
                </div>

                <div className="min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <PackageCheck className="h-4 w-4" /> Pipeline de producción
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => window.open("/core/inventario", "_blank")}
                    >
                      Abrir inventario
                    </Button>
                  </div>
                  <ProductionPipelineSection
                    productionOrderId={detailOrder.id}
                    orderCode={detailOrder.order_code}
                    onRepair={() => openDetail(detailOrder)}
                  />
                </div>



                <div className="min-w-0">
                  <h4 className="text-sm font-semibold mb-2">Procesos requeridos</h4>
                  {detailProcesses.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Sin procesos asociados a la estructura de costos.
                    </div>
                  ) : (
                    <>
                      {/* Móvil: cards */}
                      <div className="grid gap-2 sm:hidden">
                        {detailProcesses.map((p) => (
                          <div key={p.id} className="rounded-lg border p-3 text-sm min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium break-words">
                                {p.process_order}. {p.process_name}
                              </span>
                              <Badge variant="outline" className="shrink-0">{p.status}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 break-words">
                              Rol: {p.suggested_role ?? "—"} · Nómina: {p.adds_to_payroll ? "Sí" : "No"}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop: tabla */}
                      <div className="hidden sm:block w-full overflow-x-auto">
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
                      </div>
                    </>
                  )}
                </div>

                <div className="min-w-0">
                  <h4 className="text-sm font-semibold mb-2">Necesidades origen</h4>
                  {detailLinks.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Sin necesidades vinculadas (orden manual).</div>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {detailLinks.map((l: any) => (
                        <li key={l.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 border rounded p-2 min-w-0">
                          <span className="font-mono text-xs break-all">
                            {l.core_production_needs?.variant_sku ?? l.production_need_id}
                          </span>
                          <span className="text-xs sm:text-sm">cant. tomada: <b>{l.quantity_taken}</b></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 pt-2 border-t">
                  {detailOrder.status === "open" && (
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => changeStatus(detailOrder, "in_production")}>
                      Marcar en producción
                    </Button>
                  )}
                  {detailOrder.status === "in_production" && (
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => changeStatus(detailOrder, "open")}>
                      Volver a abierta
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled title="Se construye en el siguiente bloque">
                    <QrCode className="h-3 w-3 mr-1" /> Generar QR / Ficha Viajera
                  </Button>
                  {!["closed", "cancelled", "manually_closed"].includes(detailOrder.status) && (
                    <>
                      <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setCloseOpen(detailOrder)}>
                        <Lock className="h-3 w-3 mr-1" /> Cerrar manualmente
                      </Button>
                      <Button size="sm" variant="destructive" className="w-full sm:w-auto" onClick={() => setCancelOpen(detailOrder)}>
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

      <PolicyBlockedDialog
        open={!!policyBlocked}
        onClose={() => setPolicyBlocked(null)}
        lines={policyBlocked ?? []}
      />
    </div>
  );
}
