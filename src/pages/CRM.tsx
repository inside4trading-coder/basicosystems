import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { CustomerOrdersDialog } from "@/components/crm/CustomerOrdersDialog";
import { supabase } from "@/integrations/supabase/client";

interface Customer {
  id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  billing_company: string | null;
  billing_city: string | null;
  billing_country: string | null;
  billing_phone: string | null;
  orders_count: number | null;
  total_spent: number | null;
  date_created: string | null;
  last_order_date: string | null;
}

type CustomerType = "all" | "new" | "first" | "returning" | "loyal" | "vip";

const CUSTOMER_TYPES: { value: CustomerType; label: string; desc?: string }[] = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Nuevos", desc: "0 compras" },
  { value: "first", label: "Primera compra", desc: "1 compra" },
  { value: "returning", label: "Recurrentes", desc: "2-5 compras" },
  { value: "loyal", label: "Fieles", desc: "6-15 compras" },
  { value: "vip", label: "VIP", desc: "16+ compras" },
];

const PER_PAGE = 25;

function buildTypeFilter(query: any, type: CustomerType) {
  switch (type) {
    case "new": return query.eq("orders_count", 0);
    case "first": return query.eq("orders_count", 1);
    case "returning": return query.gte("orders_count", 2).lte("orders_count", 5);
    case "loyal": return query.gte("orders_count", 6).lte("orders_count", 15);
    case "vip": return query.gte("orders_count", 16);
    default: return query;
  }
}

export default function CRM() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [orderby, setOrderby] = useState("date_created");
  const [ascending, setAscending] = useState(false);
  const [customerType, setCustomerType] = useState<CustomerType>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [counts, setCounts] = useState<Record<CustomerType, number>>({
    all: 0, new: 0, first: 0, returning: 0, loyal: 0, vip: 0,
  });

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch category counts once on mount
  useEffect(() => {
    async function fetchCounts() {
      const { count: allCount } = await supabase.from("customers_cache").select("*", { count: "exact", head: true });
      const { count: newCount } = await supabase.from("customers_cache").select("*", { count: "exact", head: true }).eq("orders_count", 0);
      const { count: firstCount } = await supabase.from("customers_cache").select("*", { count: "exact", head: true }).eq("orders_count", 1);
      const { count: retCount } = await supabase.from("customers_cache").select("*", { count: "exact", head: true }).gte("orders_count", 2).lte("orders_count", 5);
      const { count: loyalCount } = await supabase.from("customers_cache").select("*", { count: "exact", head: true }).gte("orders_count", 6).lte("orders_count", 15);
      const { count: vipCount } = await supabase.from("customers_cache").select("*", { count: "exact", head: true }).gte("orders_count", 16);
      setCounts({
        all: allCount || 0,
        new: newCount || 0,
        first: firstCount || 0,
        returning: retCount || 0,
        loyal: loyalCount || 0,
        vip: vipCount || 0,
      });
    }
    fetchCounts();
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("customers_cache")
        .select("*", { count: "exact" });

      query = buildTypeFilter(query, customerType);

      if (searchDebounced) {
        query = query.or(
          `email.ilike.%${searchDebounced}%,first_name.ilike.%${searchDebounced}%,last_name.ilike.%${searchDebounced}%,billing_phone.ilike.%${searchDebounced}%`
        );
      }

      query = query
        .order(orderby, { ascending })
        .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1);

      const { data, error: qErr, count } = await query;
      if (qErr) throw new Error(qErr.message);
      setCustomers(data || []);
      setTotal(count || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, orderby, ascending, customerType]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { setPage(0); }, [searchDebounced, orderby, ascending, customerType]);

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">CRM</h2>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-1">{total.toLocaleString()} clientes</p>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
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
            value={`${orderby}:${ascending ? "asc" : "desc"}`}
            onChange={(e) => {
              const [ob, dir] = e.target.value.split(":");
              setOrderby(ob);
              setAscending(dir === "asc");
            }}
            className="text-xs border border-border rounded-md px-2 py-2 bg-card font-semibold"
          >
            <option value="date_created:desc">Más recientes</option>
            <option value="date_created:asc">Más antiguos</option>
            <option value="first_name:asc">Nombre A-Z</option>
            <option value="first_name:desc">Nombre Z-A</option>
            <option value="total_spent:desc">Mayor gasto</option>
            <option value="orders_count:desc">Más pedidos</option>
          </select>
        </div>
      </div>

      {/* Customer type filters with counts */}
      <div className="flex flex-wrap gap-2">
        {CUSTOMER_TYPES.map((t) => (
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
            <span className="ml-1 opacity-70">({counts[t.value].toLocaleString()})</span>
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
                      No se encontraron clientes
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomer(c as any)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {c.first_name || c.last_name
                            ? `${c.first_name || ""} ${c.last_name || ""}`.trim()
                            : c.username || "Sin nombre"}
                        </div>
                        {c.billing_company && (
                          <div className="text-xs text-muted-foreground">{c.billing_company}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                        {c.billing_phone || "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs font-semibold">
                        {c.orders_count ?? 0}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs font-semibold">
                        ${(c.total_spent ?? 0).toFixed(2)}
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
                Página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page <= 0}
                  className="p-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
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
