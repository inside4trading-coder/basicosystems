import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hammer, Play, Check, X, Loader2, FlaskConical, Archive } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDMY } from "@/lib/dateUtils";

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
  is_legacy: boolean;
  is_test: boolean;
  legacy_reason: string | null;
  test_reason: string | null;
  esp_woo_orders?: { order_number: string | null; customer_name: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "Fabricando",
  ready: "Listo",
  delivered_to_shipping: "Entregado a envío",
  cancelled: "Cancelado",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-600",
  in_progress: "bg-blue-600",
  ready: "bg-emerald-600",
  delivered_to_shipping: "bg-emerald-700",
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

type ViewFilter = "real" | "test" | "legacy" | "cancelled" | "all";

export default function EspanaFabricacion() {
  const [rows, setRows] = useState<FabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewFilter>("real");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("esp_fabrication_requests")
      .select("id,woo_order_id,product_name,variant_label,sku,quantity,status,priority,due_date,created_at,source_order_id,is_legacy,is_test,legacy_reason,test_reason,esp_woo_orders:source_order_id(order_number,customer_name)")
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
      testCount: tests.length,
      testUnits: sum(tests),
      legacyCount: legacy.length,
      legacyUnits: sum(legacy),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    switch (view) {
      case "real":
        return rows.filter(r => !r.is_legacy && !r.is_test && ["pending", "in_progress", "ready"].includes(r.status));
      case "test":
        return rows.filter(r => r.is_test && !r.is_legacy);
      case "legacy":
        return rows.filter(r => r.is_legacy);
      case "cancelled":
        return rows.filter(r => r.status === "cancelled" && !r.is_legacy);
      case "all":
      default:
        return rows;
    }
  }, [rows, view]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Hammer className="h-6 w-6 text-primary" /> Listado de fabricación ES
          </h2>
          <p className="text-sm text-muted-foreground">Cola generada desde pedidos WooCommerce España cuando el producto requiere fabricación.</p>
        </div>
        <a href="/espana/blanks-dtf" className="text-sm text-primary font-semibold underline-offset-2 hover:underline">Blanks / DTF →</a>
      </div>
      <Card className="p-3 border-l-4 border-l-blue-500 text-xs">
        <span className="font-semibold">Blanks / DTF disponible</span> para configurar materiales y recetas. El consumo desde fabricación se activará en el BLOQUE 5B.
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
          <TabsTrigger value="test">Pruebas ({kpis.testCount})</TabsTrigger>
          <TabsTrigger value="legacy">Legacy ({kpis.legacyCount})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
          <TabsTrigger value="all">Todos ({rows.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Talla (raw → normalizada)</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">Sin items en este filtro.</TableCell></TableRow>}
            {filtered.map(r => {
              const raw = r.variant_label || "";
              const norm = normalizeSize(raw);
              return (
                <TableRow key={r.id} className={r.is_legacy ? "opacity-60" : ""}>
                  <TableCell className="text-xs">{formatDMY(r.created_at)}</TableCell>
                  <TableCell className="text-xs font-mono">#{r.esp_woo_orders?.order_number || r.woo_order_id || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {r.product_name || "—"}
                    {r.sku && <span className="text-muted-foreground text-xs font-mono"> · {r.sku}</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {raw ? (
                      <span>
                        <span className="text-muted-foreground">{raw}</span>
                        {raw !== norm && <span className="ml-1">→ <span className="font-semibold">{norm}</span></span>}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.esp_woo_orders?.customer_name || "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{r.quantity}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[r.status]}>{STATUS_LABEL[r.status] || r.status}</Badge></TableCell>
                  <TableCell>
                    {r.is_test && <Badge className="bg-blue-600" title={r.test_reason || ""}><FlaskConical className="h-3 w-3 mr-1" />Prueba</Badge>}
                    {r.is_legacy && <Badge variant="secondary" title={r.legacy_reason || ""}><Archive className="h-3 w-3 mr-1" />Legacy</Badge>}
                    {!r.is_test && !r.is_legacy && <span className="text-xs text-muted-foreground">Real</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {busyId === r.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      {r.status === "pending" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "in_progress")}><Play className="h-3 w-3 mr-1" />Fabricar</Button>}
                      {r.status === "in_progress" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "ready")}><Check className="h-3 w-3 mr-1" />Listo</Button>}
                      {r.status === "ready" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "delivered_to_shipping")}><Check className="h-3 w-3 mr-1" />Entregar</Button>}
                      {!["cancelled","delivered_to_shipping"].includes(r.status) && <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "cancelled")}><X className="h-3 w-3" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
