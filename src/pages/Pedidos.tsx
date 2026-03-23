import { Search, Loader2, ChevronLeft, ChevronRight, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { OrderExpandedDetails } from "@/components/pedidos/OrderExpandedDetails";
import { supabase } from "@/integrations/supabase/client";

const STATUS_OPTIONS = [
  { value: "any", label: "Todos" },
  { value: "on-hold", label: "En espera" },
  { value: "processing", label: "Procesando" },
  { value: "completed", label: "Completado" },
  { value: "pending", label: "Pendiente" },
  { value: "cancelled", label: "Cancelado" },
  { value: "refunded", label: "Reembolsado" },
  { value: "tu-pedido-ha-sido", label: "Enviado" },
  { value: "tu-pago-fue-confi", label: "Pago confirmado" },
  { value: "pedido-listo-para", label: "Listo para envío" },
  { value: "pedido-recibido-p", label: "Recibido" },
];

const statusClass: Record<string, string> = {
  completed: "status-badge-success",
  processing: "status-badge-inactive",
  "on-hold": "status-badge-warning",
  pending: "status-badge-warning",
  cancelled: "status-badge-error",
  refunded: "status-badge-error",
  failed: "status-badge-error",
  "pedido-listo-para": "status-badge-success",
  "pedido-recibido-p": "status-badge-inactive",
  "tu-pago-fue-confi": "status-badge-success",
  "tu-pedido-ha-sido": "status-badge-success",
};

const statusLabel: Record<string, string> = {
  completed: "Completado",
  processing: "Procesando",
  "on-hold": "En espera",
  pending: "Pendiente",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  failed: "Fallido",
  "pedido-listo-para": "Listo para envío",
  "pedido-recibido-p": "Recibido",
  "tu-pago-fue-confi": "Pago confirmado",
  "tu-pedido-ha-sido": "Enviado",
};

const PER_PAGE = 25;

export default function Pedidos() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("any");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<Record<number, any[]>>({});

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("orders").select("*", { count: "exact" });

      if (statusFilter !== "any") query = query.eq("order_status", statusFilter);
      if (searchDebounced) {
        query = query.or(`order_number.ilike.%${searchDebounced}%,customer_email.ilike.%${searchDebounced}%`);
      }

      query = query.order("order_datetime", { ascending: false })
        .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1);

      const { data, error: qErr, count } = await query;
      if (qErr) throw new Error(qErr.message);
      setOrders(data || []);
      setTotal(count || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchDebounced]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setPage(0); }, [statusFilter, searchDebounced]);

  const toggleExpand = async (orderId: number) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    setExpandedOrder(orderId);
    if (!orderItems[orderId]) {
      const { data } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      setOrderItems(prev => ({ ...prev, [orderId]: data || [] }));
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
  const toUsd = (amount: number | null | undefined, order: any) => {
    const value = Number(amount || 0);
    if ((order?.order_currency || "USD") === "USD") return value;
    const rate = Number(order?.exchange_rate || 0);
    if (rate > 0) return value / rate;
    return value;
  };
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "";
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Pedidos</h2>
          {!loading && <p className="text-sm text-muted-foreground mt-1">{total} pedidos</p>}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar nº pedido o email…" className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {STATUS_OPTIONS.map((s) => (
          <button key={s.value} onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${
              statusFilter === s.value ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground font-semibold">Cargando pedidos…</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-status-error/10 border border-status-error/20 rounded-lg p-4">
          <p className="text-sm font-bold text-status-error">{error}</p>
          <button onClick={fetchOrders} className="mt-2 text-xs font-semibold text-primary hover:underline">Reintentar</button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-card rounded-lg border border-border overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-8 px-2"></th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Nº</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Pago</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Canal</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No se encontraron pedidos. Sincroniza primero desde el Dashboard.</td></tr>
                ) : (
                  orders.map((o) => (
                    <>
                      <tr key={o.order_id} onClick={() => toggleExpand(o.order_id)}
                        className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                        <td className="px-2 text-muted-foreground">
                          {expandedOrder === o.order_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                        <td className="px-4 py-3 font-bold">#{o.order_number}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-xs">{o.customer_email || "—"}</div>
                          {o.billing_state && <div className="text-xs text-muted-foreground">{o.billing_state}</div>}
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums">{fmt(o.total_amount_usd ?? toUsd(o.total_amount, o))}</td>
                        <td className="px-4 py-3">
                          <span className={statusClass[o.order_status] || "status-badge-inactive"}>
                            {statusLabel[o.order_status] || o.order_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{o.payment_method || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs capitalize">{o.sale_channel || "web"}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap text-xs">{fmtDate(o.order_datetime)}</td>
                      </tr>
                      {expandedOrder === o.order_id && (
                        <tr key={`${o.order_id}-items`} className="bg-muted/20">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-xs">
                              <div><span className="text-muted-foreground">Subtotal:</span> <span className="font-semibold">{fmt(toUsd(o.subtotal_amount, o))}</span></div>
                              <div><span className="text-muted-foreground">Descuento:</span> <span className="font-semibold">{fmt(toUsd(o.discount_amount, o))}</span></div>
                              <div><span className="text-muted-foreground">Envío:</span> <span className="font-semibold">{fmt(toUsd(o.shipping_amount, o))}</span></div>
                              <div><span className="text-muted-foreground">Impuestos:</span> <span className="font-semibold">{fmt(toUsd(o.tax_amount, o))}</span></div>
                            </div>
                            {orderItems[o.order_id] ? (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border/50">
                                    <th className="text-left py-1.5 font-bold text-muted-foreground">Producto</th>
                                    <th className="text-left py-1.5 font-bold text-muted-foreground">SKU</th>
                                    <th className="text-left py-1.5 font-bold text-muted-foreground">Talla</th>
                                    <th className="text-left py-1.5 font-bold text-muted-foreground">Color</th>
                                    <th className="text-right py-1.5 font-bold text-muted-foreground">Cant</th>
                                    <th className="text-right py-1.5 font-bold text-muted-foreground">Total</th>
                                    <th className="text-left py-1.5 font-bold text-muted-foreground">Categoría</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderItems[o.order_id].map((item: any) => (
                                    <tr key={item.id} className="border-b border-border/30 last:border-0">
                                      <td className="py-1.5 font-semibold">{item.product_name}</td>
                                      <td className="py-1.5 text-muted-foreground">{item.sku || "—"}</td>
                                      <td className="py-1.5">{item.size || "—"}</td>
                                      <td className="py-1.5">{item.color || "—"}</td>
                                      <td className="py-1.5 text-right tabular-nums">{item.quantity}</td>
                                      <td className="py-1.5 text-right tabular-nums font-semibold">{fmt(item.line_total)}</td>
                                      <td className="py-1.5 capitalize">{item.analytic_category || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" /> Cargando items…
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
              <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page <= 0}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
