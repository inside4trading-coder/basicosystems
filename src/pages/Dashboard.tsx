import { TrendingUp, TrendingDown, ShoppingBag, Users, DollarSign, Package, Loader2, AlertTriangle, RefreshCw, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { useDashboardData, type Period } from "@/hooks/useDashboardData";
import { toast } from "sonner";

const periods: { key: Period; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "year", label: "Este año" },
];

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "status-badge-warning" },
  processing: { label: "Procesando", className: "status-badge-inactive" },
  "on-hold": { label: "En espera", className: "status-badge-warning" },
  completed: { label: "Completado", className: "status-badge-success" },
  cancelled: { label: "Cancelado", className: "status-badge-error" },
  refunded: { label: "Reembolsado", className: "status-badge-error" },
  failed: { label: "Fallido", className: "status-badge-error" },
  "pedido-listo-para": { label: "Listo para envío", className: "status-badge-success" },
  "pedido-recibido-p": { label: "Recibido", className: "status-badge-inactive" },
  "tu-pago-fue-confi": { label: "Pago confirmado", className: "status-badge-success" },
  "tu-pedido-ha-sido": { label: "Pedido enviado", className: "status-badge-success" },
};

const PIE_COLORS = [
  "hsl(354, 100%, 44%)",
  "hsl(142, 71%, 45%)",
  "hsl(45, 93%, 47%)",
  "hsl(200, 70%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 0%, 50%)",
];

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("month");
  const { data, loading, error, refetch } = useDashboardData(period);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async (totalDays = 7) => {
    setSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // For periods > 10 days, split into batches of 7 days
      const batchSize = 7;
      const batches = totalDays <= 10 ? [totalDays] : [];
      if (totalDays > 10) {
        for (let d = totalDays; d > 0; d -= batchSize) {
          batches.push(Math.min(d, batchSize));
        }
      }
      
      let totalSynced = { orders: 0, items: 0, payments: 0 };
      
      for (let i = 0; i < batches.length; i++) {
        const days = batches[i];
        // For multi-batch, calculate the offset
        const offsetDays = totalDays > 10 ? totalDays - (i * batchSize) : days;
        const sinceDays = totalDays > 10 ? offsetDays : days;
        
        toast.info(`Sincronizando lote ${i + 1}/${batches.length}...`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 55000);
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/woo-sync?days=${sinceDays}`,
          { 
            headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        totalSynced.orders += json.synced?.orders || 0;
        totalSynced.items += json.synced?.items || 0;
        totalSynced.payments += json.synced?.payments || 0;
      }
      
      toast.success(`Sincronización completada: ${totalSynced.orders} pedidos, ${totalSynced.items} items, ${totalSynced.payments} pagos`);
      refetch();
    } catch (e: any) {
      if (e.name === "AbortError") {
        toast.error("La sincronización tardó demasiado. Intenta con un período más corto.");
      } else {
        toast.error(e.message || "Error al sincronizar");
      }
    } finally {
      setSyncing(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

  const kpiCards = data
    ? [
        { label: "Total Sales", value: fmt(data.kpis.revenue.value), change: data.kpis.revenue.change, icon: DollarSign },
        { label: "Pedidos", value: String(data.kpis.orders.value), change: data.kpis.orders.change, icon: ShoppingBag },
        { label: "Products Sold", value: String(data.kpis.productsSold.value), change: data.kpis.productsSold.change, icon: ShoppingCart },
        { label: "Ticket Medio", value: fmt(data.kpis.avgTicket.value), change: data.kpis.avgTicket.change, icon: Package },
        { label: "Clientes Nuevos", value: String(data.kpis.newCustomers.value), change: data.kpis.newCustomers.change, icon: Users },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight">Dashboard</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync(1)}
              disabled={syncing}
              className="gap-2 rounded-r-none"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Sync Hoy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync(7)}
              disabled={syncing}
              className="rounded-none border-l-0 px-2 text-xs"
            >
              7d
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync(30)}
              disabled={syncing}
              className="rounded-l-none border-l-0 px-2 text-xs"
            >
              30d
            </Button>
          </div>
          <div className="flex gap-1 bg-card rounded-lg border border-border p-1">
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  period === p.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground font-semibold">Cargando datos…</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-status-error/10 border border-status-error/20 rounded-lg p-4">
          <p className="text-sm font-bold text-status-error flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
          <button onClick={refetch} className="mt-2 text-xs font-semibold text-primary hover:underline">Reintentar</button>
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {kpiCards.map((kpi, i) => (
              <div key={kpi.label} className="kpi-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-black tracking-tight">{kpi.value}</div>
                <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${kpi.change >= 0 ? "text-status-success" : "text-status-error"}`}>
                  {kpi.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {fmtPct(kpi.change)} vs período anterior
                </div>
              </div>
            ))}
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            {Object.entries(data.statuses).map(([status, count]) => {
              const info = statusLabels[status] || { label: status, className: "status-badge-inactive" };
              return <span key={status} className={info.className}>{info.label}: {count}</span>;
            })}
          </div>

          {/* Row 1: Ventas netas + Pedidos por día (matching WooCommerce layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.35s" }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Ventas netas</h3>
              {data.dailyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => new Date(v).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Ventas"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              )}
            </div>

            <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Pedidos por día</h3>
              {data.dailyOrders.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.dailyOrders}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => new Date(v).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => [v, "Pedidos"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              )}
            </div>
          </div>

          {/* Row 2: Payment methods + Hourly distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.45s" }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Métodos de pago</h3>
              {data.revenueByPayment.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={data.revenueByPayment} dataKey="revenue" nameKey="method" cx="50%" cy="50%" outerRadius={70} strokeWidth={2}>
                        {data.revenueByPayment.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {data.revenueByPayment.map((p, i) => (
                      <div key={p.method} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-semibold truncate">{p.method}</span>
                        <span className="ml-auto text-muted-foreground tabular-nums">${p.revenue.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-xs border-t border-border pt-2 mt-2">
                      <div className="w-3 h-3 shrink-0" />
                      <span className="font-black">Total</span>
                      <span className="ml-auto font-black tabular-nums">
                        ${data.revenueByPayment.reduce((s, p) => s + p.revenue, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              )}
            </div>

            <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.5s" }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Pedidos por hora</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}h`} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => [v, "Pedidos"]} labelFormatter={(l) => `${l}:00 - ${l}:59`}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 3: Top categories + Top products (matching WooCommerce layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.55s" }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Top categorías — Items sold</h3>
              {data.categoryBreakdown.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-xs font-bold uppercase text-muted-foreground">Categoría</th>
                        <th className="text-right py-2 text-xs font-bold uppercase text-muted-foreground">Items sold</th>
                        <th className="text-right py-2 text-xs font-bold uppercase text-muted-foreground">Net sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.categoryBreakdown.map((c) => (
                        <tr key={c.category} className="border-b border-border/50">
                          <td className="py-2 font-semibold capitalize">{c.category}</td>
                          <td className="py-2 text-right tabular-nums">{c.quantity}</td>
                          <td className="py-2 text-right tabular-nums font-semibold">{fmt(c.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Sube un CSV de costos para ver categorías
                </div>
              )}
            </div>

            <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.6s" }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Top productos — Items sold</h3>
              {data.topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-xs font-bold uppercase text-muted-foreground">Producto</th>
                        <th className="text-right py-2 text-xs font-bold uppercase text-muted-foreground">Items sold</th>
                        <th className="text-right py-2 text-xs font-bold uppercase text-muted-foreground">Net sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p) => (
                        <tr key={p.name} className="border-b border-border/50">
                          <td className="py-2 font-semibold truncate max-w-[200px]">{p.name}</td>
                          <td className="py-2 text-right tabular-nums">{p.quantity}</td>
                          <td className="py-2 text-right tabular-nums font-semibold">{fmt(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
