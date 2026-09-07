import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { mockDashboard, mockSummary, usdFormat } from "@/lib/sublimeMock";

export default function SublimeDashboard() {
  const d = mockDashboard;
  return (
    <div className="space-y-6">
      <HubHeader icon={BarChart3} title="Dashboard" subtitle="Ventas, rotación y comportamiento de inventario" />
      <MockNotice />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Ventas del mes" value={usdFormat(mockSummary.salesMonthUsd)} />
        <Kpi label="Unidades vendidas" value={String(mockSummary.unitsSoldMonth)} />
        <Kpi label="Ticket promedio" value={usdFormat(mockSummary.avgTicketUsd)} />
        <Kpi label="Margen bruto" value={usdFormat(d.grossMarginUsd)} />
        <Kpi label="Rotación media" value={`${d.rotationDays} días`} />
        <Kpi label="Valor de inventario" value={usdFormat(mockSummary.inventoryValueUsd)} />
        <Kpi label="Consignación por liquidar" value={usdFormat(d.consignmentUsd)} />
        <Kpi label="Prendas disponibles" value={String(mockSummary.inventoryAvailable)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ListCard
          title="Productos más vendidos"
          rows={d.topProducts.map((p) => ({ name: p.name, right: `${p.units} uds · ${usdFormat(p.usd)}` }))}
        />
        <ListCard title="Marcas más vendidas" rows={d.topBrands.map((b) => ({ name: b.name, right: `${b.units} uds` }))} />
        <ListCard title="Tallas más vendidas" rows={d.topSizes.map((s) => ({ name: s.name, right: `${s.units} uds` }))} />
        <ListCard title="Colores más vendidos" rows={d.topColors.map((c) => ({ name: c.name, right: `${c.units} uds` }))} />
        <BarCard title="Métodos de pago" rows={d.paymentMix} />
        <BarCard title="Canales de venta" rows={d.channelMix} />
        <ListCard title="Horas con más ventas" rows={d.topHours.map((h) => ({ name: h.name, right: `${h.units} uds` }))} />
        <ListCard title="Días con más ventas" rows={d.topDays.map((x) => ({ name: x.name, right: usdFormat(x.usd) }))} />
        <ListCard
          title="Inventario de baja rotación"
          rows={d.slowInventory.map((s) => ({ name: s.name, right: `${s.days} días` }))}
        />
        <ListCard
          title="Stock crítico"
          rows={d.criticalStock.map((s) => ({ name: s.name, right: `${s.stock} uds` }))}
        />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 rounded-2xl border-border/60">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="num text-2xl font-black tabular-nums mt-1">{value}</p>
    </Card>
  );
}

function ListCard({ title, rows }: { title: string; rows: { name: string; right: string }[] }) {
  return (
    <Card className="p-5 rounded-2xl border-border/60">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{r.name}</span>
            <span className="tabular-nums font-semibold shrink-0">{r.right}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BarCard({ title, rows }: { title: string; rows: { name: string; pct: number }[] }) {
  return (
    <Card className="p-5 rounded-2xl border-border/60">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      <div className="mt-3 space-y-3">
        {rows.map((r) => (
          <div key={r.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{r.name}</span>
              <span className="tabular-nums font-semibold">{r.pct}%</span>
            </div>
            <Progress value={r.pct} />
          </div>
        ))}
      </div>
    </Card>
  );
}
