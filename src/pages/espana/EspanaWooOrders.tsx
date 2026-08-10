import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Globe, RefreshCw, Loader2, ExternalLink, Hammer, Receipt, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WooOrder {
  id: string;
  woo_order_id: number;
  order_number: string | null;
  status: string;
  total_eur: number;
  shipping_total_eur: number;
  payment_method_title: string | null;
  customer_name: string | null;
  customer_email: string | null;
  date_created: string | null;
  esp_sale_id: string | null;
}

interface ItemRow {
  esp_woo_order_id: string;
  name: string;
  quantity: number;
  sku: string | null;
  product_id: string | null;
  variant_id: string | null;
  needs_fabrication: boolean;
  fabrication_request_id: string | null;
  fabrication_status: string | null;
  fabrication_source_type: string | null;
  total_eur: number;
}

type FabStatus = "pending" | "pending_approval" | "in_progress" | "ready" | "delivered_to_shipping" | "cancelled" | "rejected";

const FAB_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  pending_approval: "Pendiente de aprobación",
  in_progress: "En fabricación",
  ready: "Listo",
  delivered_to_shipping: "Entregado",
  cancelled: "Cancelado",
  rejected: "Rechazado",
};

const FAB_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  pending_approval: "bg-amber-400",
  in_progress: "bg-blue-500",
  ready: "bg-violet-500",
  delivered_to_shipping: "bg-emerald-600",
  cancelled: "bg-zinc-400",
  rejected: "bg-zinc-400",
};


const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-600",
  processing: "bg-blue-600",
  "on-hold": "bg-amber-600",
  pending: "bg-zinc-500",
  cancelled: "bg-zinc-400",
  refunded: "bg-rose-600",
  failed: "bg-destructive",
};

export default function EspanaWooOrders() {
  const [orders, setOrders] = useState<WooOrder[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, ItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    let q = supabase.from("esp_woo_orders")
      .select("id,woo_order_id,order_number,status,total_eur,shipping_total_eur,payment_method_title,customer_name,customer_email,date_created,esp_sale_id")
      .order("date_created", { ascending: false, nullsFirst: false })
      .limit(200);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data: o } = await q;
    setOrders((o || []) as WooOrder[]);
    const ids = (o || []).map((x: any) => x.id);
    if (ids.length > 0) {
      const { data: it } = await supabase.from("esp_woo_order_items")
        .select("esp_woo_order_id,name,quantity,sku,product_id,variant_id,needs_fabrication,fabrication_request_id,total_eur")
        .in("esp_woo_order_id", ids);

      // Fabrication request statuses
      const fabIds = (it || []).map((r: any) => r.fabrication_request_id).filter(Boolean);
      const fabStatuses: Record<string, { status: string; source_type: string }> = {};
      if (fabIds.length > 0) {
        const { data: fabData } = await supabase.from("esp_fabrication_requests")
          .select("id,status,source_type")
          .in("id", fabIds);
        (fabData || []).forEach((f: any) => {
          fabStatuses[f.id] = { status: f.status, source_type: f.source_type };
        });
      }

      const map: Record<string, ItemRow[]> = {};
      (it || []).forEach((r: any) => {
        const fab = r.fabrication_request_id ? fabStatuses[r.fabrication_request_id] : null;
        (map[r.esp_woo_order_id] ||= []).push({
          ...r,
          fabrication_status: fab?.status || null,
          fabrication_source_type: fab?.source_type || null,
        });
      });
      setItemsByOrder(map);
    } else {
      setItemsByOrder({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const sync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("esp-woo-sync-orders", {
      body: { action: "sync", status: "any", per_page: 50, max_pages: 10 },
    });
    setSyncing(false);
    if (error) { toast.error(error.message); return; }
    if (data?.ok) {
      toast.success(`Pedidos: ${data.orders_created}+/${data.orders_updated}↻ · Ventas: ${data.sales_created}+/${data.sales_updated}↻ · Fabricación: ${data.fabrication_requests_created}`);
    } else {
      toast.error(data?.error || "Error en sincronización");
    }
    load();
  };

  const filtered = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (o.order_number || "").toLowerCase().includes(s)
      || String(o.woo_order_id).includes(s)
      || (o.customer_name || "").toLowerCase().includes(s)
      || (o.customer_email || "").toLowerCase().includes(s);
  });

  const toggle = (id: string) => {
    const n = new Set(expanded);
    n.has(id) ? n.delete(id) : n.add(id);
    setExpanded(n);
  };

  const getFabricationSummary = (items: ItemRow[]) => {
    const fabItems = items.filter(i => i.needs_fabrication && i.fabrication_request_id);
    if (fabItems.length === 0) return null;
    const statuses = fabItems.map(i => i.fabrication_status || "pending");
    const allDelivered = statuses.every(s => s === "delivered_to_shipping");
    const allDone = statuses.every(s => s === "delivered_to_shipping" || s === "cancelled" || s === "rejected");
    const anyInProgress = statuses.some(s => s === "in_progress");
    const anyReady = statuses.some(s => s === "ready");
    const anyPending = statuses.some(s => s === "pending" || s === "pending_approval");
    const anyCancelled = statuses.some(s => s === "cancelled" || s === "rejected");
    return { allDelivered, allDone, anyInProgress, anyReady, anyPending, anyCancelled, count: fabItems.length };
  };


  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" /> Pedidos WooCommerce España
          </h2>
          <p className="text-sm text-muted-foreground">Lectura desde basicoclothes.es · genera ventas web y cola de fabricación. <a href="/espana/woocommerce" className="text-primary font-semibold underline-offset-2 hover:underline">Catálogo Woo →</a> · <a href="/espana/woocommerce/reclasificar" className="text-primary font-semibold underline-offset-2 hover:underline">Reclasificar Woo ES →</a> · <a href="/espana/woocommerce/problemas" className="text-amber-600 font-semibold underline-offset-2 hover:underline">Problemas →</a></p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on-hold">On hold</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Buscar pedido, cliente…" value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
          <Button onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar pedidos
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Generó</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Sin pedidos. Pulsa “Sincronizar pedidos”.</TableCell></TableRow>}
            {filtered.map(o => {
              const items = itemsByOrder[o.id] || [];
              const fabSummary = getFabricationSummary(items);
              const unmapped = items.filter(i => !i.variant_id).length;
              const isExp = expanded.has(o.id);
              return (
                <>
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/30" onClick={() => toggle(o.id)}>
                    <TableCell className="font-mono text-xs">#{o.order_number || o.woo_order_id}</TableCell>
                    <TableCell className="text-xs">{o.date_created ? new Date(o.date_created).toLocaleString("es-ES") : "—"}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[o.status] || "bg-zinc-500"}>{o.status}</Badge></TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{o.customer_name || "—"}</div>
                      <div className="text-muted-foreground">{o.customer_email}</div>
                    </TableCell>
                    <TableCell className="text-xs">{o.payment_method_title || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">€{Number(o.total_eur).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {o.esp_sale_id && <Badge variant="outline" className="gap-1"><Receipt className="h-3 w-3" /> Venta</Badge>}
                        {unmapped > 0 && <Badge variant="destructive" className="text-[10px]">{unmapped} sin mapear</Badge>}
                        {fabSummary && (
                          <>
                            {fabSummary.allDelivered ? (
                              <Badge className="bg-emerald-600 gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3" /> Fabricado</Badge>
                            ) : fabSummary.anyInProgress ? (
                              <Badge className="bg-blue-500 gap-1 text-[10px]"><Loader2 className="h-3 w-3 animate-spin" /> En fabricación</Badge>
                            ) : fabSummary.anyReady ? (
                              <Badge className="bg-violet-500 gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3" /> Listo</Badge>
                            ) : fabSummary.anyPending ? (
                              <Badge className="bg-amber-500 gap-1 text-[10px]"><AlertCircle className="h-3 w-3" /> Fab pendiente</Badge>
                            ) : fabSummary.anyCancelled ? (
                              <Badge variant="secondary" className="gap-1 text-[10px]"><XCircle className="h-3 w-3" /> Fab cancelada</Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-[10px]"><Hammer className="h-3 w-3" /> Fab ×{fabSummary.count}</Badge>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{isExp ? "▴" : "▾"}</TableCell>
                  </TableRow>
                  {isExp && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30">
                        <div className="text-xs space-y-1 py-2">
                          {items.length === 0 && <p className="text-muted-foreground">Sin items.</p>}
                          {items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 border-b border-border/40 last:border-0 py-1">
                              <div className="flex-1">
                                <span className="font-medium">{it.quantity}× {it.name}</span>
                                {it.sku && <span className="ml-2 text-muted-foreground font-mono">{it.sku}</span>}
                              </div>
                              <div className="flex items-center gap-1">
                                {!it.variant_id && <Badge variant="destructive" className="text-[10px]">No mapeado</Badge>}
                                {it.needs_fabrication && (
                                  <Badge className={it.fabrication_status ? FAB_STATUS_COLORS[it.fabrication_status] || "bg-zinc-500" : "bg-amber-500"}>
                                    {it.fabrication_status ? (
                                      <span className="flex items-center gap-1">
                                        {it.fabrication_status === "delivered_to_shipping" ? <CheckCircle2 className="h-3 w-3" /> : <Hammer className="h-3 w-3" />}
                                        {FAB_STATUS_LABEL[it.fabrication_status] || it.fabrication_status}
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1"><Hammer className="h-3 w-3" />Fabricación</span>
                                    )}
                                  </Badge>
                                )}
                                <span className="ml-2 font-semibold">€{Number(it.total_eur).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
