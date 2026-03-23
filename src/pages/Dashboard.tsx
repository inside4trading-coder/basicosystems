import { TrendingUp, TrendingDown, ShoppingBag, Users, DollarSign, Package } from "lucide-react";
import { useState } from "react";

const periods = ["Hoy", "Esta semana", "Este mes", "Este año"] as const;

const mockKpis = [
  { label: "Revenue", value: "€2,847", change: "+12.5%", up: true, icon: DollarSign },
  { label: "Total Pedidos", value: "34", change: "+8.2%", up: true, icon: ShoppingBag },
  { label: "Ticket Medio", value: "€83.74", change: "-2.1%", up: false, icon: Package },
  { label: "Clientes Nuevos", value: "7", change: "+40%", up: true, icon: Users },
];

const mockStatuses = [
  { label: "Pendiente", count: 5, className: "status-badge-warning" },
  { label: "Procesando", count: 8, className: "status-badge-inactive" },
  { label: "Completado", count: 21, className: "status-badge-success" },
  { label: "Cancelado", count: 2, className: "status-badge-error" },
];

const mockTopProducts = [
  { name: "Camiseta Basic White", units: 23 },
  { name: "Hoodie Oversize Black", units: 18 },
  { name: "Jogger Essential Grey", units: 15 },
  { name: "Cap Basico Red", units: 12 },
  { name: "Tote Bag Logo", units: 9 },
];

export default function Dashboard() {
  const [period, setPeriod] = useState<typeof periods[number]>("Hoy");

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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockKpis.map((kpi, i) => (
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
            <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${kpi.up ? "text-status-success" : "text-status-error"}`}>
              {kpi.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {kpi.change} vs período anterior
            </div>
          </div>
        ))}
      </div>

      {/* Order statuses */}
      <div className="flex flex-wrap gap-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
        {mockStatuses.map((s) => (
          <span key={s.label} className={s.className}>
            {s.label}: {s.count}
          </span>
        ))}
      </div>

      {/* Low stock alert */}
      <div className="bg-status-error/10 border border-status-error/20 rounded-lg p-4 animate-fade-in" style={{ animationDelay: "0.35s" }}>
        <p className="text-sm font-bold text-status-error">
          ⚠ Stock bajo: "Cap Basico Red" tiene solo 3 unidades
        </p>
      </div>

      {/* Chart placeholder + top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Revenue diario
          </h3>
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Gráfica disponible al conectar WooCommerce
          </div>
        </div>

        <div className="kpi-card animate-fade-in" style={{ animationDelay: "0.45s" }}>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Top 5 productos
          </h3>
          <div className="space-y-3">
            {mockTopProducts.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-muted-foreground w-5">{i + 1}</span>
                  <span className="text-sm font-semibold">{p.name}</span>
                </div>
                <span className="text-sm font-bold text-muted-foreground">{p.units} uds</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
