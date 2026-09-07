import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  PackageCheck,
  ArrowLeftRight,
  Sparkles,
  Wallet,
  Boxes,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { MoveMerchandiseDialog } from "@/components/sublime/hub/MoveMerchandiseDialog";
import { ReceiveMerchandiseDialog } from "@/components/sublime/hub/ReceiveMerchandiseDialog";
import { mockSummary, usdFormat } from "@/lib/sublimeMock";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4 rounded-2xl border-border/60">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="num text-2xl font-black tabular-nums text-foreground mt-1">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
    </Card>
  );
}

export default function SublimeResumen() {
  const navigate = useNavigate();
  const [openMove, setOpenMove] = useState(false);
  const [openReceive, setOpenReceive] = useState(false);
  const s = mockSummary;

  return (
    <div className="space-y-6">
      <HubHeader icon={LayoutDashboard} title="Resumen Sublime" subtitle="Estado operativo de la tienda en un vistazo" />
      <MockNotice />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Ventas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Metric label="Hoy" value={usdFormat(s.salesTodayUsd)} />
          <Metric label="Semana" value={usdFormat(s.salesWeekUsd)} />
          <Metric label="Mes" value={usdFormat(s.salesMonthUsd)} />
          <Metric label="Unidades vendidas" value={String(s.unitsSoldMonth)} hint="Mes en curso" />
          <Metric label="Ticket promedio" value={usdFormat(s.avgTicketUsd)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Inventario</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Metric label="Disponible" value={String(s.inventoryAvailable)} hint="Estado, no ubicación" />
          <Metric label="Almacén" value={String(s.inventoryWarehouse)} hint="Ubicación" />
          <Metric label="Tienda" value={String(s.inventoryStore)} hint="Ubicación" />
          <Metric label="En camino" value={String(s.incoming)} />
          <Metric label="Por preparar" value={String(s.pendingPreparation)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Administración</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Metric label="Cierres pendientes" value={String(s.pendingClosures)} />
          <Metric label="Pagos por conciliar" value={String(s.pendingReconciliation)} />
          <Metric label="Obligaciones próximas" value={String(s.upcomingObligations)} />
          <Metric label="Inventario valorizado" value={usdFormat(s.inventoryValueUsd)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Acciones rápidas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Button variant="outline" className="h-14 justify-start" onClick={() => navigate("/sublime/pos")}>
            <ShoppingCart className="h-4 w-4 mr-2" /> Nueva venta
          </Button>
          <Button variant="outline" className="h-14 justify-start" onClick={() => setOpenReceive(true)}>
            <PackageCheck className="h-4 w-4 mr-2" /> Recibir mercancía
          </Button>
          <Button variant="outline" className="h-14 justify-start" onClick={() => setOpenMove(true)}>
            <ArrowLeftRight className="h-4 w-4 mr-2" /> Mover mercancía
          </Button>
          <Button variant="outline" className="h-14 justify-start" onClick={() => navigate("/sublime/mercancia/preparacion")}>
            <Sparkles className="h-4 w-4 mr-2" /> Preparar producto
          </Button>
          <Button variant="outline" className="h-14 justify-start" onClick={() => navigate("/sublime/cierres")}>
            <Wallet className="h-4 w-4 mr-2" /> Cerrar caja
          </Button>
          <Button variant="outline" className="h-14 justify-start" onClick={() => navigate("/sublime/inventario/almacen")}>
            <Boxes className="h-4 w-4 mr-2" /> Ver inventario
          </Button>
        </div>
      </section>

      <MoveMerchandiseDialog open={openMove} onOpenChange={setOpenMove} />
      <ReceiveMerchandiseDialog
        open={openReceive}
        onOpenChange={setOpenReceive}
        productTitle="Franela de rayas blanca"
        expected={[
          { size: "S", expected: 4 },
          { size: "M", expected: 6 },
          { size: "L", expected: 2 },
          { size: "XL", expected: 2 },
        ]}
      />
    </div>
  );
}
