import { TrendingUp, TrendingDown, ShoppingBag, Users, DollarSign, Package, Loader2, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useState, useCallback, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const periods = ["Hoy", "Esta semana", "Este mes", "Este año"] as const;
type Period = typeof periods[number];

const periodMap: Record<Period, string> = {
  "Hoy": "today",
  "Esta semana": "week",
  "Este mes": "month",
  "Este año": "year",
};

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

interface DashboardData {
  kpis: {
    revenue: { value: number; change: number };
    orders: { value: number; change: number };
    avgTicket: { value: number; change: number };
    newCustomers: { value: number; change: number };
  };
  statuses: Record<string, number>;
  topProducts: { name: string; product_id: number; quantity: number }[];
  lowStock: { name: string; stock: number; id: number }[];
  dailyRevenue: Record<string, number>;
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("Hoy");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/woo-dashboard?period=${periodMap[p]}`,
        {
          headers: {
            "Authorization": `Bearer ${anonKey}`,
            "apikey": anonKey,
          },
        }
      );

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Error ${res.status}: ${errBody.substring(0, 200)}`);
      }

      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const fmt = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

  const chartData = data
    ? Object.entries(data.dailyRevenue)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({
          date: new Date(date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
          revenue: Math.round(value * 100) / 100,
        }))
    : [];

  const kpiCards = data
    ? [
        { label: "Revenue", value: fmt(data.kpis.revenue.value), change: data.kpis.revenue.change, icon: DollarSign },
        { label: "Total Pedidos", value: String(data.kpis.orders.value), change: data.kpis.orders.change, icon: ShoppingBag },
        { label: "Ticket Medio", value: fmt(data.kpis.avgTicket.value), change: data.kpis.avgTicket.change, icon: Package },
        { label: "Clientes Nuevos", value: String(data.kpis.newCustomers.value), change: data.kpis.newCustomers.change, icon: Users },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight">Dashboard</h2>
        <div className="flex gap-1 bg-card rounded-lg border border-border p-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground font-semibold">Cargando datos de WooCommerce…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-status-error/10 border border-status-error/20 rounded-lg p-4">
          <p className="text-sm font-bold text-status-error flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
          <button onClick={() => fetchData(period)} className="mt-2 text-xs font-semibold text-primary hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Data loaded */}
      {data && !loading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((kpi, i) => (
              <div
                key={kpi.label}
                className="kpi-card animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {kpi.label}
                  </span>
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

          {/* Order statuses */}
          <div className="flex flex-wrap gap-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            {Object.entries(data.statuses).map(([status, count]) => {
              const info = statusLabels[status] || { label: status, className: "status-badge-inactive" };
              return (
                <span key={status} className={info.className}>
                  {info.label}: {count}
                </span>
              );
            })}
          </div>

          {/* Low stock alerts */}
          {data.lowStock.length > 0 && (
            <div className="bg-status-error/10 border border-status-error/20 rounded-lg p-4 animate-fade-in" style={{ animationDelay: "0.35s" }}>
              {data.lowStock.map((p) => (
                <p key={p.id} className="text-sm font-bold text-status-error">
                  ⚠ Stock bajo: "{p.name}" tiene solo {p.stock} unidades
                </p>
              ))}
            </div>
          )}

          {/* Chart + top products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Revenue diario
              </h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `€${v}`} />
                    <Tooltip
                      formatter={(value: number) => [`€${value.toFixed(2)}`, "Revenue"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Sin datos de revenue para este período
                </div>
              )}
            </div>

            <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.45s" }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Top 5 productos
              </h3>
              {data.topProducts.length > 0 ? (
                <div className="space-y-3">
                  {data.topProducts.map((p, i) => (
                    <div key={p.product_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-muted-foreground w-5">{i + 1}</span>
                        <span className="text-sm font-semibold">{p.name}</span>
                      </div>
                      <span className="text-sm font-bold text-muted-foreground">{p.quantity} uds</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Sin datos de productos para este período
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
