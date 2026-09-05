import { Search, Loader2, ChevronLeft, ChevronRight, RefreshCw, Calculator, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { CustomerOrdersDialog } from "@/components/crm/CustomerOrdersDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDMY } from "@/lib/dateUtils";

interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  avatar_url: string;
  billing_company: string;
  billing_city: string;
  billing_country: string;
  billing_phone: string;
  orders_count: number;
  total_spent: string;
  date_created: string;
  last_order_date: string | null;
}

const PER_PAGE = 20;

const customerTypes = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Nuevos", desc: "0 compras" },
  { value: "first", label: "Primera compra", desc: "1 compra" },
  { value: "returning", label: "Recurrentes", desc: "2-5 compras" },
  { value: "loyal", label: "Fieles", desc: "6-15 compras" },
  { value: "vip", label: "VIP", desc: "16+ compras" },
];

function ordersCountFilter(type: string): [number, number] | null {
  switch (type) {
    case "new": return [0, 0];
    case "first": return [1, 1];
    case "returning": return [2, 5];
    case "loyal": return [6, 15];
    case "vip": return [16, 999999];
    default: return null;
  }
}

export default function CRM() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [orderby, setOrderby] = useState("registered_date");
  const [order, setOrder] = useState("desc");
  const [customerType, setCustomerType] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [fullSyncing, setFullSyncing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch from customers_cache (for all filters)
  const fetchFromCache = useCallback(async () => {
    let query = supabase
      .from("customers_cache")
      .select("*", { count: "exact" });

    // Apply orders_count filter only for non-"all" types
    const range = ordersCountFilter(customerType);
    if (range) {
      const [min, max] = range;
      query = query.gte("orders_count", min).lte("orders_count", max);
    }

    if (searchDebounced) {
      query = query.or(
        `first_name.ilike.%${searchDebounced}%,last_name.ilike.%${searchDebounced}%,email.ilike.%${searchDebounced}%`
      );
    }

    // Map orderby
    const colMap: Record<string, string> = {
      registered_date: "date_created",
      name: "first_name",
    };
    const col = colMap[orderby] || "date_created";
    query = query.order(col, { ascending: order === "asc" });

    const from = (page - 1) * PER_PAGE;
    query = query.range(from, from + PER_PAGE - 1);

    const { data, count, error: err } = await query;
    if (err) throw err;

    const mapped: Customer[] = (data || []).map((c) => ({
      id: c.id,
      email: c.email || "",
      first_name: c.first_name || "",
      last_name: c.last_name || "",
      username: c.username || "",
      avatar_url: c.avatar_url || "",
      billing_company: c.billing_company || "",
      billing_city: c.billing_city || "",
      billing_country: c.billing_country || "",
      billing_phone: c.billing_phone || "",
      orders_count: c.orders_count ?? 0,
      total_spent: String(c.total_spent ?? "0.00"),
      date_created: c.date_created || "",
      last_order_date: c.last_order_date || null,
    }));

    setCustomers(mapped);
    setTotal(count ?? 0);
    setTotalPages(Math.ceil((count ?? 0) / PER_PAGE));
  }, [page, searchDebounced, orderby, order, customerType]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchFromCache();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFromCache]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { setPage(1); }, [searchDebounced, orderby, order, customerType]);

  const syncCustomers = async () => {
    setSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      let startPage = 1;
      let totalSynced = 0;

      while (startPage) {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/woo-customers-sync?start_page=${startPage}&max_pages=15`,
          { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } }
        );
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Sync failed");
        totalSynced += data.synced;
        startPage = data.next_page;
      }

      toast.success(`${totalSynced} clientes sincronizados`);
      if (customerType !== "all") fetchCustomers();
    } catch (e: any) {
      toast.error(`Error sincronizando: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const syncOrdersHistorical = async () => {
    if (!confirm("Esto sincronizará TODOS los pedidos históricos de WooCommerce. Puede tardar varios minutos. ¿Continuar?")) return;
    setFullSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      let nextPage: number | null = 1;
      let totalOrders = 0;
      let reachedEnd = false;
      let retries = 0;
      const CHUNK = 5; // smaller chunks = more reliable Woo responses
      const MAX_RETRIES_PER_PAGE = 3;
      let lastRetryPage: number | null = null;

      while (nextPage) {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/woo-sync?full=true&start_page=${nextPage}&max_pages=${CHUNK}`,
          { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } }
        );
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

        totalOrders += result.synced?.orders || 0;

        if (result.status === "source_error") {
          // Retry same page up to N times before giving up
          if (lastRetryPage === result.next_page) retries++;
          else { retries = 1; lastRetryPage = result.next_page; }
          if (retries > MAX_RETRIES_PER_PAGE) {
            throw new Error(`WooCommerce devolvió respuesta inválida en página ${result.next_page} tras ${MAX_RETRIES_PER_PAGE} reintentos: ${result.source_error}`);
          }
          toast.warning(`Reintentando página ${result.next_page} (intento ${retries}/${MAX_RETRIES_PER_PAGE})…`);
          await new Promise(r => setTimeout(r, 2000));
          nextPage = result.next_page;
          continue;
        }

        retries = 0;
        lastRetryPage = null;
        toast.info(`Sincronizando… ${totalOrders} pedidos (página ${result.page_range?.end ?? "?"})`);

        if (result.status === "reached_end") {
          reachedEnd = true;
          nextPage = null;
        } else {
          nextPage = result.next_page;
        }
      }

      if (reachedEnd) {
        toast.success(`Histórico completo: ${totalOrders} pedidos. Contadores recalculados.`);
      } else {
        toast.warning(`Sync detenido: ${totalOrders} pedidos importados pero no se confirmó fin del histórico.`);
      }
      fetchCustomers();
    } catch (e: any) {
      toast.error(`Error sync histórico: ${e.message}`);
    } finally {
      setFullSyncing(false);
    }
  };

  const recalculateStats = async () => {
    setRecalculating(true);
    try {
      const { error } = await supabase.rpc("refresh_customers_order_stats");
      if (error) throw error;
      const { count } = await supabase
        .from("customers_cache")
        .select("*", { count: "exact", head: true })
        .gt("orders_count", 0);
      toast.success(`${count?.toLocaleString("es-ES") ?? 0} clientes con compras actualizados`);
      fetchCustomers();
    } catch (e: any) {
      toast.error(`Error recalculando: ${e.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    return formatDMY(d);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="num text-2xl font-black tracking-tight">CRM</h2>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-1">{total.toLocaleString()} clientes{customerType !== "all" ? " en este segmento" : " registrados"}</p>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={recalculateStats}
            disabled={recalculating}
            className="p-2 rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            title="Recalcular contadores de pedidos (rápido, sin re-sincronizar)"
          >
            <Calculator className={`h-4 w-4 ${recalculating ? "animate-pulse" : ""}`} />
          </button>
          <button
            onClick={syncOrdersHistorical}
            disabled={fullSyncing}
            className="p-2 rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            title="Sync histórico completo de pedidos (lento, una sola vez)"
          >
            <History className={`h-4 w-4 ${fullSyncing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={syncCustomers}
            disabled={syncing}
            className="p-2 rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            title="Sincronizar clientes desde WooCommerce"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          </button>
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="pl-9 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={`${orderby}:${order}`}
            onChange={(e) => {
              const [ob, od] = e.target.value.split(":");
              setOrderby(ob);
              setOrder(od);
            }}
            className="text-xs border border-border rounded-md px-2 py-2 bg-card font-semibold"
          >
            <option value="registered_date:desc">Más recientes</option>
            <option value="registered_date:asc">Más antiguos</option>
            <option value="name:asc">Nombre A-Z</option>
            <option value="name:desc">Nombre Z-A</option>
          </select>
        </div>
      </div>

      {/* Customer type filters */}
      <div className="flex flex-wrap gap-2">
        {customerTypes.map((t) => (
          <button
            key={t.value}
            onClick={() => setCustomerType(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              customerType === t.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {t.label}
            {t.desc && <span className="ml-1 opacity-70">({t.desc})</span>}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground font-semibold">Cargando clientes…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-status-error/10 border border-status-error/20 rounded-lg p-4">
          <p className="text-sm font-bold text-status-error">{error}</p>
          <button onClick={fetchCustomers} className="mt-2 text-xs font-semibold text-primary hover:underline">
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
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Teléfono</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Pedidos</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Gastado</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">País</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Registro</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      {customerType !== "all"
                        ? "No hay clientes en este segmento. Pulsa ↻ para sincronizar."
                        : "No se encontraron clientes"}
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {c.first_name || c.last_name
                            ? `${c.first_name} ${c.last_name}`.trim()
                            : c.username || "Sin nombre"}
                        </div>
                        {c.billing_company && (
                          <div className="text-xs text-muted-foreground">{c.billing_company}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.email}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                        {c.billing_phone || "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs font-semibold">
                        {c.orders_count ?? 0}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs font-semibold">
                        ${parseFloat(c.total_spent || "0").toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell text-xs">
                        {c.billing_country || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell text-xs whitespace-nowrap">
                        {fmtDate(c.date_created)}
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
      <CustomerOrdersDialog
        customer={selectedCustomer}
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
      />
    </div>
  );
}
