import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hammer, Play, Check, X, Loader2, FlaskConical, Archive, Package, AlertTriangle, CheckCircle2, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDMY } from "@/lib/dateUtils";
import ManualFabricationDialog, { MANUAL_REASON_LABEL } from "@/components/espana/ManualFabricationDialog";

interface FabRow {
  id: string;
  woo_order_id: number | null;
  product_name: string | null;
  variant_label: string | null;
  sku: string | null;
  quantity: number;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  source_order_id: string | null;
  source_type: string;
  is_legacy: boolean;
  is_test: boolean;
  legacy_reason: string | null;
  test_reason: string | null;
  notes: string | null;
  manual_reason: string | null;
  manual_reason_detail: string | null;
  requires_shipping: boolean | null;
  ship_to_name: string | null;
  ship_to_phone: string | null;
  ship_to_address: string | null;
  ship_to_city: string | null;
  ship_to_province: string | null;
  ship_to_postal_code: string | null;
  ship_to_country: string | null;
  pos_sale_id: string | null;
  pos_sale_item_id: string | null;
  pos_sale_number: string | null;
  pos_location_id: string | null;
  pos_location_name: string | null;
  esp_woo_orders?: { order_number: string | null; customer_name: string | null } | null;
}


const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pendiente de aprobación",
  pending: "Pendiente",
  in_progress: "Fabricando",
  ready: "Listo",
  delivered_to_shipping: "Entregado a envío",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-teal-600",
  pending: "bg-amber-600",
  in_progress: "bg-blue-600",
  ready: "bg-emerald-600",
  delivered_to_shipping: "bg-emerald-700",
  rejected: "bg-zinc-600",
  cancelled: "bg-zinc-500",
};

/** Normaliza etiquetas de talla provenientes de Woo (quita "Talla", trim, uppercase). */
export function normalizeSize(label: string | null | undefined): string {
  if (!label) return "";
  return label
    .replace(/^\s*talla\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

type ViewFilter = "real" | "delivered" | "test" | "legacy" | "cancelled" | "all";
type OriginFilter = "all" | "woo" | "pos" | "restock" | "manual";

const ORIGIN_CHIPS: { key: OriginFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "woo", label: "WooCommerce" },
  { key: "pos", label: "POS" },
  { key: "restock", label: "RESTOCK" },
  { key: "manual", label: "Manual" },
];

const PRIORITY_LABEL: Record<string, string> = { normal: "Normal", alta: "Alta", urgente: "Urgente", high: "Alta", urgent: "Urgente", low: "Baja" };
const PRIORITY_CLASS: Record<string, string> = { alta: "bg-amber-600", high: "bg-amber-600", urgente: "bg-red-600", urgent: "bg-red-600" };

export default function EspanaFabricacion() {
  const [rows, setRows] = useState<FabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewFilter>("real");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [manualOpen, setManualOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<{ open: boolean; request?: FabRow; data?: any; loading?: boolean }>({ open: false });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("esp_fabrication_requests")
      .select("id,woo_order_id,product_name,variant_label,sku,quantity,status,priority,due_date,created_at,source_order_id,source_type,is_legacy,is_test,legacy_reason,test_reason,notes,manual_reason,manual_reason_detail,requires_shipping,ship_to_name,ship_to_phone,ship_to_address,ship_to_city,ship_to_province,ship_to_postal_code,ship_to_country,pos_sale_id,pos_sale_item_id,pos_sale_number,pos_location_id,pos_location_name,esp_woo_orders:source_order_id(order_number,customer_name)")
      .order("created_at", { ascending: false }).limit(1000);
    if (error) toast.error(error.message);
    setRows((data || []) as any);
    setLoading(false);
  };


  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    const patch: any = { status };
    if (status === "cancelled") {
      const reason = window.prompt("Motivo de cancelación:");
      if (!reason) { setBusyId(null); return; }
      patch.cancel_reason = reason;
      patch.cancelled_at = new Date().toISOString();
    }
    const { error } = await supabase.from("esp_fabrication_requests").update(patch).eq("id", id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else { toast.success("Actualizado"); load(); }
  };

  const openPreflight = async (r: FabRow) => {
    setPreflight({ open: true, request: r, loading: true });
    const { data, error } = await supabase.rpc("esp_resolve_fabrication_materials" as any, { p_request_id: r.id });
    if (error) { toast.error(error.message); setPreflight({ open: false }); return; }
    setPreflight({ open: true, request: r, data, loading: false });
  };

  const confirmConsume = async () => {
    if (!preflight.request) return;
    setPreflight(p => ({ ...p, loading: true }));
    const { data, error } = await supabase.rpc("esp_consume_materials_for_fabrication_request" as any, {
      p_request_id: preflight.request.id,
    });
    if (error) { toast.error(error.message); setPreflight(p => ({ ...p, loading: false })); return; }
    toast.success(`Consumidos ${(data as any)?.materials_consumed || 0} materiales · solicitud en fabricación`);
    setPreflight({ open: false });
    load();
  };

  const markReady = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("esp_fabrication_request_mark_ready" as any, { p_request_id: id });
    setBusyId(null);
    if (error) toast.error(error.message);
    else { toast.success("Solicitud lista"); load(); }
  };


  // KPIs separados
  const kpis = useMemo(() => {
    const real = rows.filter(r => !r.is_legacy && !r.is_test);
    const tests = rows.filter(r => r.is_test && !r.is_legacy);
    const legacy = rows.filter(r => r.is_legacy);
    const sum = (arr: FabRow[]) => arr.reduce((a, r) => a + (r.quantity || 0), 0);
    return {
      realPending: real.filter(r => r.status === "pending").length,
      realInProgress: real.filter(r => r.status === "in_progress").length,
      realReady: real.filter(r => r.status === "ready").length,
      restockPending: real.filter(r => r.status === "pending_approval").length,
      restockUnits: sum(real.filter(r => r.status === "pending_approval")),
      testCount: tests.length,
      testUnits: sum(tests),
      legacyCount: legacy.length,
      legacyUnits: sum(legacy),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    let base: FabRow[];
    switch (view) {
      case "real":
        base = rows.filter(r => !r.is_legacy && !r.is_test && ["pending_approval", "pending", "in_progress", "ready"].includes(r.status)); break;
      case "delivered":
        base = rows.filter(r => !r.is_legacy && r.status === "delivered_to_shipping"); break;
      case "test":
        base = rows.filter(r => r.is_test && !r.is_legacy); break;
      case "legacy":
        base = rows.filter(r => r.is_legacy); break;
      case "cancelled":
        base = rows.filter(r => ["cancelled", "rejected"].includes(r.status) && !r.is_legacy); break;
      case "all":
      default:
        base = rows;
    }
    if (origin === "manual") return base.filter(r => r.source_type === "manual");
    if (origin === "pos" || origin === "restock") return base.filter(r => r.source_type === "pos_restock");
    if (origin === "woo") return base.filter(r => r.source_type !== "manual" && r.source_type !== "pos_restock");
    return base;
  }, [rows, view, origin]);


  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Hammer className="h-6 w-6 text-primary" /> Listado de fabricación ES
          </h2>
          <p className="text-sm text-muted-foreground">Cola generada desde pedidos WooCommerce España cuando el producto requiere fabricación.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4 mr-1" />Nueva orden manual</Button>
          <a href="/espana/blanks-dtf" className="text-sm text-primary font-semibold underline-offset-2 hover:underline">Blanks / DTF →</a>
        </div>
      </div>

      <Card className="p-3 border-l-4 border-l-emerald-500 text-xs">
        <span className="font-semibold">BLOQUE 5B activo:</span> al pulsar <span className="font-semibold">Fabricar</span> se valida la receta, se calcula el stock requerido y se consumen los materiales atómicamente. No se toca WooCommerce, ni inventario físico, ni POS.
      </Card>

      {/* KPIs separados: real / pruebas / legacy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 border-l-4 border-l-primary">
          <p className="text-[10px] uppercase text-muted-foreground font-bold">Producción real</p>
          <div className="flex gap-4 mt-2">
            <div><p className="text-2xl font-black">{kpis.realPending}</p><p className="text-[10px] text-muted-foreground">pendientes</p></div>
            <div><p className="text-2xl font-black">{kpis.realInProgress}</p><p className="text-[10px] text-muted-foreground">fabricando</p></div>
            <div><p className="text-2xl font-black">{kpis.realReady}</p><p className="text-[10px] text-muted-foreground">listas</p></div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500">
          <p className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1"><FlaskConical className="h-3 w-3" /> Pruebas</p>
          <div className="flex gap-4 mt-2">
            <div><p className="text-2xl font-black">{kpis.testCount}</p><p className="text-[10px] text-muted-foreground">solicitudes</p></div>
            <div><p className="text-2xl font-black">{kpis.testUnits}</p><p className="text-[10px] text-muted-foreground">unidades</p></div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-zinc-500">
          <p className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1"><Archive className="h-3 w-3" /> Histórico / Legacy</p>
          <div className="flex gap-4 mt-2">
            <div><p className="text-2xl font-black">{kpis.legacyCount}</p><p className="text-[10px] text-muted-foreground">solicitudes</p></div>
            <div><p className="text-2xl font-black">{kpis.legacyUnits}</p><p className="text-[10px] text-muted-foreground">unidades</p></div>
          </div>
        </Card>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as ViewFilter)}>
        <TabsList>
          <TabsTrigger value="real">Activos reales ({rows.filter(r => !r.is_legacy && !r.is_test && ["pending","in_progress","ready"].includes(r.status)).length})</TabsTrigger>
          <TabsTrigger value="delivered">Entregados / Enviados ({rows.filter(r => !r.is_legacy && r.status === "delivered_to_shipping").length})</TabsTrigger>
          <TabsTrigger value="test">Pruebas ({kpis.testCount})</TabsTrigger>
          <TabsTrigger value="legacy">Legacy ({kpis.legacyCount})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
          <TabsTrigger value="all">Todos ({rows.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Origen</span>
        <Select value={origin} onValueChange={(v) => setOrigin(v as OriginFilter)}>
          <SelectTrigger className="h-8 w-[240px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="auto">Automático / WooCommerce</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Talla (raw → normalizada)</TableHead>
              <TableHead>Cliente / destinatario</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-6">Sin items en este filtro.</TableCell></TableRow>}
            {filtered.map(r => {
              const raw = r.variant_label || "";
              const norm = normalizeSize(raw);
              const isManual = r.source_type === "manual";
              return (
                <TableRow key={r.id} className={r.is_legacy ? "opacity-60" : ""}>
                  <TableCell className="text-xs">{formatDMY(r.created_at)}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {isManual ? <span className="text-muted-foreground">Manual</span> : `#${r.esp_woo_orders?.order_number || r.woo_order_id || "—"}`}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {r.product_name || "—"}
                    {r.sku && <span className="text-muted-foreground text-xs font-mono"> · {r.sku}</span>}
                    {isManual && r.manual_reason && (
                      <div className="text-[11px] text-muted-foreground">
                        Motivo: {MANUAL_REASON_LABEL[r.manual_reason] || r.manual_reason}
                        {r.manual_reason === "otro" && r.manual_reason_detail ? ` · ${r.manual_reason_detail}` : ""}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {raw ? (
                      <span>
                        <span className="text-muted-foreground">{raw}</span>
                        {raw !== norm && <span className="ml-1">→ <span className="font-semibold">{norm}</span></span>}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {isManual ? (
                      r.requires_shipping ? (
                        <div>
                          <span className="font-medium">{r.ship_to_name || "—"}</span>
                          <div className="text-[11px] text-muted-foreground">
                            {[r.ship_to_address, r.ship_to_postal_code, r.ship_to_city, r.ship_to_province, r.ship_to_country].filter(Boolean).join(", ")}
                          </div>
                          {r.ship_to_phone && <div className="text-[11px] text-muted-foreground">{r.ship_to_phone}</div>}
                        </div>
                      ) : <span className="text-muted-foreground">Recogida interna</span>
                    ) : (r.esp_woo_orders?.customer_name || "—")}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{r.quantity}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[r.status]}>{STATUS_LABEL[r.status] || r.status}</Badge></TableCell>
                  <TableCell>
                    {PRIORITY_CLASS[r.priority]
                      ? <Badge className={PRIORITY_CLASS[r.priority]}>{PRIORITY_LABEL[r.priority] || r.priority}</Badge>
                      : <span className="text-xs text-muted-foreground">{PRIORITY_LABEL[r.priority] || r.priority}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      {isManual && <Badge className="bg-purple-600"><Wrench className="h-3 w-3 mr-1" />MANUAL</Badge>}
                      {r.is_test && <Badge className="bg-blue-600" title={r.test_reason || ""}><FlaskConical className="h-3 w-3 mr-1" />Prueba</Badge>}
                      {r.is_legacy && <Badge variant="secondary" title={r.legacy_reason || ""}><Archive className="h-3 w-3 mr-1" />Legacy</Badge>}
                      {!isManual && !r.is_test && !r.is_legacy && <span className="text-xs text-muted-foreground">Real</span>}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      {busyId === r.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      {r.status === "pending" && !r.is_legacy && (
                        <Button size="sm" variant="outline" onClick={() => openPreflight(r)}>
                          <Play className="h-3 w-3 mr-1" />Fabricar
                        </Button>
                      )}
                      {r.status === "in_progress" && !r.is_legacy && (
                        <Button size="sm" variant="outline" onClick={() => markReady(r.id)}>
                          <Check className="h-3 w-3 mr-1" />Marcar listo
                        </Button>
                      )}
                      {r.status === "ready" && !r.is_legacy && (
                        <Button size="sm" variant="outline" onClick={async () => { await setStatus(r.id, "delivered_to_shipping"); setView("delivered"); }}>
                          <Check className="h-3 w-3 mr-1" />Entregar
                        </Button>
                      )}
                      {!["cancelled","delivered_to_shipping"].includes(r.status) && !r.is_legacy && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "cancelled")}><X className="h-3 w-3" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Preflight modal */}
      <Dialog open={preflight.open} onOpenChange={(o) => !o && setPreflight({ open: false })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Fabricar solicitud</DialogTitle>
          </DialogHeader>
          {preflight.loading && !preflight.data && <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /> Resolviendo receta...</div>}
          {preflight.data && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-3 rounded">
                <div><span className="text-muted-foreground">Pedido:</span> <span className="font-mono">#{preflight.request?.esp_woo_orders?.order_number || preflight.request?.woo_order_id || "—"}</span></div>
                <div><span className="text-muted-foreground">Producto:</span> <span className="font-semibold">{preflight.request?.product_name}</span></div>
                <div><span className="text-muted-foreground">Talla raw:</span> {preflight.request?.variant_label || "—"}</div>
                <div><span className="text-muted-foreground">Talla normalizada:</span> <span className="font-bold">{preflight.data.normalized_size || "—"}</span></div>
                <div><span className="text-muted-foreground">Cantidad:</span> {preflight.request?.quantity}</div>
                <div><span className="text-muted-foreground">Receta:</span> {preflight.data.recipe_id ? <span className="text-emerald-600">✓ encontrada</span> : <span className="text-amber-600">no encontrada</span>}</div>
              </div>

              {!preflight.data.ok && preflight.data.reason === "no_recipe" && (
                <Card className="p-3 border-l-4 border-l-amber-500 bg-amber-500/5 text-xs">
                  <p className="font-bold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Producto sin receta activa</p>
                  <p className="text-muted-foreground mt-1">No se puede fabricar automáticamente. Crea una receta en Blanks / DTF → Recetas.</p>
                </Card>
              )}

              {preflight.data.materials && (preflight.data.materials as any[]).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Materiales requeridos</p>
                  <div className="border rounded overflow-hidden">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-xs">Material</TableHead>
                        <TableHead className="text-xs">Estrategia</TableHead>
                        <TableHead className="text-xs text-right">Requerido</TableHead>
                        <TableHead className="text-xs text-right">Disponible</TableHead>
                        <TableHead className="text-xs text-center">OK</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {(preflight.data.materials as any[]).map((m, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">
                              {m.material_name ? (
                                <>
                                  <span className="font-medium">{m.material_name}</span>
                                  {m.material_size && <span className="text-muted-foreground"> · talla {m.material_size}</span>}
                                  {m.material_sku && <div className="font-mono text-[10px] text-muted-foreground">{m.material_sku}</div>}
                                </>
                              ) : <span className="text-amber-600 italic">No resuelto · {m.reason || "—"}</span>}
                            </TableCell>
                            <TableCell className="text-xs">{m.size_strategy}</TableCell>
                            <TableCell className="text-right text-xs font-mono">{Number(m.planned_quantity).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-xs font-mono">{Number(m.available).toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              {m.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" /> : <AlertTriangle className="h-4 w-4 text-amber-600 inline" />}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {preflight.data.already_consumed > 0 && (
                <p className="text-xs text-amber-600">⚠ Esta solicitud ya tiene materiales consumidos. No se puede volver a consumir.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreflight({ open: false })}>Cancelar</Button>
            <Button
              onClick={confirmConsume}
              disabled={
                preflight.loading
                || !preflight.data
                || !preflight.data.recipe_id
                || !preflight.data.all_ok
                || preflight.data.already_consumed > 0
              }
            >
              {preflight.loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Consumir materiales y fabricar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManualFabricationDialog open={manualOpen} onOpenChange={setManualOpen} onCreated={() => { setOrigin("manual"); setView("real"); load(); }} />
    </div>
  );
}
