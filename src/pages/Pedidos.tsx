import { Search, Loader2, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";

interface Order {
  id: number;
  number: string;
  status: string;
  total: string;
  currency: string;
  date_created: string;
  billing: { first_name: string; last_name: string; email: string; phone: string };
  shipping: { city: string; country: string };
  line_items: { name: string; quantity: number; total: string }[];
  payment_method_title: string;
}

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

export default function Pedidos() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("any");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
        status: statusFilter,
      });
      if (searchDebounced) params.set("search", searchDebounced);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/woo-orders?${params}`,
        { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOrders(data.orders);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchDebounced]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset page on filter/search change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchDebounced]);

  const fmt = (val: string) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(parseFloat(val || "0"));

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Pedidos</h2>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-1">{total} pedidos encontrados</p>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pedido..."
              className="pl-9 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${
              statusFilter === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground font-semibold">Cargando pedidos…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-status-error/10 border border-status-error/20 rounded-lg p-4">
          <p className="text-sm font-bold text-status-error">{error}</p>
          <button onClick={fetchOrders} className="mt-2 text-xs font-semibold text-primary hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-card rounded-lg border border-border overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Nº</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Productos</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Pago</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No se encontraron pedidos
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-bold">#{order.number}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {order.billing.first_name} {order.billing.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">{order.billing.email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs">
                        <div className="truncate">
                          {order.line_items.map((li) => `${li.name} x${li.quantity}`).join(", ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold">{fmt(order.total)}</td>
                      <td className="px-4 py-3">
                        <span className={statusClass[order.status] || "status-badge-inactive"}>
                          {statusLabel[order.status] || order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
                        {order.payment_method_title}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                        {fmtDate(order.date_created)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
              <span className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
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
