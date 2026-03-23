import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";

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

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
        orderby,
        order,
      });
      if (searchDebounced) params.set("search", searchDebounced);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/woo-customers?${params}`,
        { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCustomers(data.customers);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, orderby, order]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { setPage(1); }, [searchDebounced, orderby, order]);

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">CRM</h2>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-1">{total.toLocaleString()} clientes registrados</p>
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
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">País</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Registro</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      No se encontraron clientes
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
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
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
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
    </div>
  );
}