import { TrendingUp, TrendingDown, ShoppingBag, Users, DollarSign, Package, Loader2, AlertTriangle, RefreshCw, ShoppingCart, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDashboardData, type Period } from "@/hooks/useDashboardData";
import { isQuickAccess } from "@/config/orderStatuses";
import { useBlurSales } from "@/hooks/useBlurSales";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDMY } from "@/lib/dateUtils";
import { ModuleHeader } from "@/components/brand/ModuleHeader";
import { BRAND_CHART_COLORS } from "@/lib/brandChartColors";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "actualizado hace un momento";
  if (diffMin < 60) return `actualizado hace ${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (diffHrs < 24) {
    return remMin > 1 ? `actualizado hace ${diffHrs} h ${remMin} min` : `actualizado hace ${diffHrs} h`;
  }
  const diffDays = Math.floor(diffHrs / 24);
  return `actualizado hace ${diffDays} d`;
}

const periods: { key: Period; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "last_month", label: "Mes pasado" },
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

const PIE_COLORS = BRAND_CHART_COLORS;

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("month");
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | undefined>();
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { data, loading, error, refetch } = useDashboardData(period, customRange);
  const blurSales = useBlurSales();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const fetchLastSync = async () => {
    const { data: d, error } = await supabase
      .from("orders")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && d?.synced_at) setLastSyncedAt(d.synced_at);
  };

  useEffect(() => { fetchLastSync(); }, []);

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
        const timeout = setTimeout(() => controller.abort(), 300000);
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
      fetchLastSync();
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
        { label: "Total Sales", value: fmt(data.kpis.revenue.value), change: data.kpis.revenue.change, changeYoY: data.kpis.revenue.changeYoY, icon: DollarSign },
        { label: "Pedidos", value: String(data.kpis.orders.value), change: data.kpis.orders.change, changeYoY: data.kpis.orders.changeYoY, icon: ShoppingBag },
        { label: "Products Sold", value: String(data.kpis.productsSold.value), change: data.kpis.productsSold.change, changeYoY: data.kpis.productsSold.changeYoY, icon: ShoppingCart },
        { label: "Ticket Medio", value: fmt(data.kpis.avgTicket.value), change: data.kpis.avgTicket.change, changeYoY: data.kpis.avgTicket.changeYoY, icon: Package },
        { label: "Clientes Nuevos", value: String(data.kpis.newCustomers.value), change: data.kpis.newCustomers.change, changeYoY: data.kpis.newCustomers.changeYoY, icon: Users },
      ]
    : [];

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <ModuleHeader
        eyebrow="01 · VENTAS"
        title="Resumen de ventas"
        subtitle={lastSyncedAt ? <span className="mono-cap text-[10px] text-primary">{timeAgo(lastSyncedAt)}</span> : undefined}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center">
            <Button variant="destructive" size="sm" onClick={() => handleSync(30)} disabled={syncing} className="gap-2 rounded-r-none">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Sincronizar"}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => handleSync(7)} disabled={syncing} className="rounded-none border-l-0 px-2 text-xs">7d</Button>
            <Button variant="destructive" size="sm" onClick={() => handleSync(30)} disabled={syncing} className="rounded-l-none border-l-0 px-2 text-xs">30d</Button>
          </div>
          <div className="flex gap-1 bg-card rounded-lg border border-border p-1">
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => { setPeriod(p.key); setCustomRange(undefined); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  period === p.key && !customRange
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <button className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                  period === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                  <Calendar className="h-3 w-3" /> Personalizado
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3 space-y-3" align="end">
                <div className="flex items-center gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Desde</label>
                    <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Hasta</label>
                    <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 text-xs" disabled={!customFrom || !customTo} onClick={() => {
                    const start = new Date(customFrom + "T00:00:00");
                    const end = new Date(customTo + "T23:59:59");
                    if (end < start) { toast.error("La fecha final debe ser posterior a la inicial"); return; }
                    setCustomRange({ start, end });
                    setPeriod("custom");
                  }}>Aplicar</Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1" disabled={!customFrom || !customTo || syncing} onClick={() => {
                    const start = new Date(customFrom + "T00:00:00");
                    const end = new Date(customTo + "T23:59:59");
                    if (end < start) { toast.error("La fecha final debe ser posterior a la inicial"); return; }
                    setCustomRange({ start, end });
                    setPeriod("custom");
                    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    handleSync(days);
                  }}>
                    <RefreshCw className="h-3 w-3" /> Sync
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
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
            {kpiCards.map((kpi, i) => {
              const isSales = kpi.label === "Total Sales";
              const blurred = blurSales && isSales;
              return (
              <div key={kpi.label} className="kpi-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="mono-cap text-[10px] text-muted-foreground">{kpi.label}</span>
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className={`num text-2xl font-black tracking-tight transition-all ${blurred ? "blur-md select-none" : ""}`}>{kpi.value}</div>
                <div className={`mt-1 space-y-0.5 ${blurred ? "blur-md select-none" : ""}`}>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${kpi.change >= 0 ? "text-status-success" : "text-status-error"}`} title="Período inmediatamente anterior de la misma duración">
                    {kpi.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {fmtPct(kpi.change)} <span className="font-normal text-muted-foreground">vs período anterior</span>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-semibold opacity-70 ${kpi.changeYoY >= 0 ? "text-status-success" : "text-status-error"}`} title="Mismo rango el año pasado (interanual)">
                    {kpi.changeYoY >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {fmtPct(kpi.changeYoY)} <span className="font-normal text-muted-foreground">vs año anterior</span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            {Object.entries(data.statuses)
              .sort(([a], [b]) => {
                const qa = isQuickAccess(a) ? 0 : 1;
                const qb = isQuickAccess(b) ? 0 : 1;
                return qa - qb;
              })
              .map(([status, count]) => {
                const info = statusLabels[status] || { label: status, className: "status-badge-inactive" };
                return <span key={status} className={info.className}>{info.label}: {count}</span>;
              })}
          </div>

          {/* Row 1: Ventas netas + Pedidos por día (matching WooCommerce layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.35s" }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Ventas netas</h3>
              <div className={blurSales ? "blur-md select-none pointer-events-none" : ""}>

              {data.dailyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => formatDMY(v)} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Ventas"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="revenue" fill="hsl(var(--blue-500))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              )}
              </div>
            </div>

            <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Pedidos por día</h3>
              {data.dailyOrders.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.dailyOrders}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => formatDMY(v)} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => [v, "Pedidos"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="hsl(var(--status-success))" radius={[4, 4, 0, 0]} />
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Métodos de pago</h3>
                <span className="text-xs text-muted-foreground">Transacciones analizadas: <span className="font-bold text-foreground">{data.transactionsAnalyzed}</span></span>
              </div>
              {data.ordersByPayment.length > 0 ? (
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                  <div className="w-full md:w-1/2 h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.ordersByPayment} dataKey="count" nameKey="method" cx="50%" cy="50%" outerRadius={70} strokeWidth={2}>
                        {data.ordersByPayment.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, name: string, entry: any) => [`${v} (${entry.payload.pct}%)`, name]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 flex-1">
                    {data.ordersByPayment.map((p, i) => (
                      <div key={p.method} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-semibold truncate">{p.method}</span>
                        <span className="ml-auto text-muted-foreground tabular-nums">{p.count} ({p.pct}%)</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-xs border-t border-border pt-2 mt-2">
                      <div className="w-3 h-3 shrink-0" />
                      <span className="font-black">Total apariciones</span>
                      <span className="ml-auto font-black tabular-nums">
                        {data.ordersByPayment.reduce((s, p) => s + p.count, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos de métodos de pago</div>
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
                  <Bar dataKey="count" fill="hsl(var(--blue-300))" radius={[3, 3, 0, 0]} />
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

          {/* Row 4: Sizes breakdown (variantes de tallas) */}
          <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.65s" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Top tallas vendidas</h3>
              <span className="text-xs text-muted-foreground">
                Items con talla: <span className="font-bold text-foreground">{data.totalSizedItems}</span>
              </span>
            </div>
            {data.sizeBreakdown.length > 0 ? (
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                <div className="w-full md:w-1/2 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.sizeBreakdown}
                        dataKey="quantity"
                        nameKey="size"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        strokeWidth={2}
                        label={(e: any) => `${e.size} ${e.pct}%`}
                        labelLine={false}
                      >
                        {data.sizeBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, _name: string, entry: any) => [`${v} unid. (${entry.payload.pct}%)`, `Talla ${entry.payload.size}`]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {data.sizeBreakdown.map((s, i) => (
                    <div key={s.size}>
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-bold tracking-wide">Talla {s.size}</span>
                        <span className="ml-auto text-muted-foreground tabular-nums">
                          {s.quantity} <span className="font-bold text-foreground">({s.pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden ml-5">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${s.pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No hay tallas registradas en los items del período
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
