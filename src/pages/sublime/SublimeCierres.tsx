import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { refFormat } from "@/lib/posMoney";
import { posChannelLabel } from "@/lib/posSalesChannels";
import { posMethod } from "@/lib/posPaymentMethods";
import { SaleReceiptDialog } from "@/components/sublime/pos/SaleReceipt";
import { SaleDetailDialog } from "@/pages/sublime/SublimeVentas";
import { useSublimeSalesHistory } from "@/hooks/useSublimeSalesHistory";
import { saleStatusLabel } from "@/hooks/useSublimeSaleReturns";
import {
  useClosureData,
  useClosureTotals,
  usePosLocations,
  type ClosureSession,
} from "@/hooks/useSublimeClosures";
import {
  cashMovementLabel,
  useCashMovements,
  useCashSessionSummary,
} from "@/components/sublime/pos/useSublimeCashSession";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const dt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("es-VE") : "—");
const hm = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }) : "—";
const bs = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `Bs. ${Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SublimeCierres() {
  const [date, setDate] = useState(today());
  const [locationId, setLocationId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<ClosureSession | null>(null);
  const [saleDetailId, setSaleDetailId] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const { data: locations = [] } = usePosLocations();
  useEffect(() => {
    if (!locationId && locations.length) setLocationId(locations[0].id);
  }, [locations, locationId]);

  const { sales, returns, sessions } = useClosureData(date, locationId);
  const saleRows = sales.data ?? [];
  const returnRows = returns.data ?? [];
  const sessionRows = sessions.data ?? [];
  const totals = useClosureTotals(saleRows, returnRows);

  const openSessions = sessionRows.filter((s) => s.status === "open");
  const loading = sales.isLoading || returns.isLoading || sessions.isLoading;

  const { data: allSales = [] } = useSublimeSalesHistory();
  const saleDetail = allSales.find((s) => s.id === saleDetailId) ?? null;
  const receipt = allSales.find((s) => s.id === receiptId) ?? null;

  const returnsBySession = useMemo(() => {
    const m = new Map<string, number>();
    returnRows.forEach((r) =>
      r.refunds.forEach((f) => {
        const key = f.cash_session_id ?? r.cash_session_id;
        if (!key) return;
        m.set(key, (m.get(key) ?? 0) + f.amount_ref);
      })
    );
    return m;
  }, [returnRows]);

  const salesBySession = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    saleRows
      .filter((s) => s.status !== "voided" && s.cash_session_id)
      .forEach((s) => {
        const e = m.get(s.cash_session_id!) ?? { count: 0, total: 0 };
        m.set(s.cash_session_id!, { count: e.count + 1, total: e.total + s.total_ref });
      });
    return m;
  }, [saleRows]);

  return (
    <div className="space-y-6">
      <HubHeader
        icon={Scale}
        title="Cierres y conciliación"
        subtitle="Cierre diario calculado desde las ventas, pagos, devoluciones y sesiones reales del POS"
        actions={
          <div className="flex items-center gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[160px]" aria-label="Fecha del cierre" />
            <Select value={locationId ?? ""} onValueChange={setLocationId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sede" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {openSessions.length > 0 && (
        <Card className="p-4 rounded-2xl border-destructive/60 bg-destructive/5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">Cierre pendiente</p>
            <p className="text-muted-foreground">
              {openSessions.length === 1 ? "Hay 1 sesión de caja abierta" : `Hay ${openSessions.length} sesiones de caja abiertas`}
              {" "}({openSessions.map((s) => s.session_number).join(", ")}). El día no se considera cuadrado hasta cerrarlas.
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Kpi label="Ventas brutas" value={refFormat(totals.gross)} />
        <Kpi label="Descuentos" value={`− ${refFormat(totals.discounts)}`} />
        <Kpi label="Devoluciones" value={`− ${refFormat(totals.refunds)}`} />
        <Kpi label="Ventas netas" value={refFormat(totals.net)} strong />
        <Kpi label="Tickets" value={String(totals.tickets)} />
        <Kpi label="Ticket promedio" value={refFormat(totals.avgTicket)} />
      </div>

      <Tabs defaultValue="origin">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="origin">Por origen</TabsTrigger>
          <TabsTrigger value="method">Por método de pago</TabsTrigger>
          <TabsTrigger value="sessions">Cajas y sesiones</TabsTrigger>
          <TabsTrigger value="sales">Ventas del día</TabsTrigger>
          <TabsTrigger value="returns">Devoluciones</TabsTrigger>
        </TabsList>

        <TabsContent value="origin" className="mt-4">
          <Card className="rounded-2xl border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.byOrigin.map((o) => (
                  <TableRow key={o.origin}>
                    <TableCell><Badge variant="secondary">{posChannelLabel(o.origin)}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{o.sales}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{refFormat(o.total)}</TableCell>
                  </TableRow>
                ))}
                <Empty show={totals.byOrigin.length === 0} cols={3} loading={loading} />
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="method" className="mt-4">
          <Card className="rounded-2xl border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Cobrado ({"moneda"})</TableHead>
                  <TableHead className="text-right">Cobrado REF</TableHead>
                  <TableHead className="text-right">Devuelto REF</TableHead>
                  <TableHead className="text-right">Neto REF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.byMethod.map((m) => (
                  <TableRow key={`${m.method}-${m.currency}`}>
                    <TableCell className="text-sm">{posMethod(m.method as any).label}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {m.currency === "VES" ? bs(m.amount) : refFormat(m.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{refFormat(m.amountRef)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {m.refundRef > 0 ? `− ${refFormat(m.refundRef)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{refFormat(m.netRef)}</TableCell>
                  </TableRow>
                ))}
                <Empty show={totals.byMethod.length === 0} cols={5} loading={loading} />
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <Card className="rounded-2xl border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sesión</TableHead>
                  <TableHead>Caja</TableHead>
                  <TableHead>Cajero</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Devuelto</TableHead>
                  <TableHead className="text-right">Esperado REF / Bs</TableHead>
                  <TableHead className="text-right">Contado REF / Bs</TableHead>
                  <TableHead className="text-right">Diferencia REF / Bs</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionRows.map((s) => {
                  const v = salesBySession.get(s.id);
                  const ret = returnsBySession.get(s.id) ?? 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.session_number}</TableCell>
                      <TableCell className="text-sm">{s.register_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{s.cashier_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{hm(s.opened_at)}</TableCell>
                      <TableCell className="text-sm">{s.closed_at ? hm(s.closed_at) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {v ? `${v.count} · ${refFormat(v.total)}` : "0"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-destructive">
                        {ret > 0 ? `− ${refFormat(ret)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {s.expected_ref === null ? "—" : `${refFormat(s.expected_ref)} / ${bs(s.expected_bs)}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {s.counted_ref === null ? "—" : `${refFormat(s.counted_ref)} / ${bs(s.counted_bs)}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {s.difference_ref === null ? "—" : `${refFormat(s.difference_ref)} / ${bs(s.difference_bs)}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status === "open" ? "destructive" : "secondary"}>
                          {s.status === "open" ? "Cierre pendiente" : "Cerrada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSessionDetail(s)}>Ver sesión</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <Empty show={sessionRows.length === 0} cols={12} loading={loading} />
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <Card className="rounded-2xl border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venta</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Cajero / Caja</TableHead>
                  <TableHead>Pagos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {saleRows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.sale_number}</TableCell>
                    <TableCell className="text-sm">{hm(s.sold_at)}</TableCell>
                    <TableCell className="text-sm">{s.customer_name ?? "Venta mostrador"}</TableCell>
                    <TableCell className="text-sm">{posChannelLabel(s.sale_origin, s.origin_detail ?? undefined)}</TableCell>
                    <TableCell className="text-sm">{[s.cashier_code, s.register_code].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="text-sm">{s.payments.map((p) => posMethod(p.method as any).label).join(" + ") || "—"}</TableCell>
                    <TableCell><Badge variant={s.status === "completed" ? "default" : s.status === "voided" ? "destructive" : "secondary"}>{saleStatusLabel(s.status)}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{refFormat(s.total_ref)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSaleDetailId(s.id)}>Detalle</Button>
                        <Button size="sm" variant="ghost" onClick={() => setReceiptId(s.id)}>Comprobante</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <Empty show={saleRows.length === 0} cols={9} loading={loading} />
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="mt-4">
          <Card className="rounded-2xl border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Venta</TableHead>
                  <TableHead>Reembolso</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.return_number}</TableCell>
                    <TableCell className="text-sm">{hm(r.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={r.kind === "void" ? "destructive" : "secondary"}>
                        {r.kind === "void" ? "Anulación" : r.kind === "exchange" ? "Cambio" : "Devolución"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.sale_number ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {r.refunds.map((f) => posMethod(f.method as any).label).join(" + ") || "Sin reembolso"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.units}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-destructive">− {refFormat(r.total_refund_ref)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSaleDetailId(r.sale_id)}
                      >
                        Ver venta
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <Empty show={returnRows.length === 0} cols={8} loading={loading} />
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <SessionDetailDialog session={sessionDetail} onClose={() => setSessionDetail(null)} />
      <SaleDetailDialog sale={saleDetail} onClose={() => setSaleDetailId(null)} />
      <SaleReceiptDialog
        sale={receipt}
        phone={receipt?.customer_phone}
        open={receipt !== null}
        onOpenChange={(v) => !v && setReceiptId(null)}
      />
    </div>
  );
}

function Kpi({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Card className="p-4 rounded-2xl border-border/60">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num tabular-nums mt-1 ${strong ? "text-2xl font-black" : "text-xl font-bold"}`}>{value}</p>
    </Card>
  );
}

function Empty({ show, cols, loading }: { show: boolean; cols: number; loading: boolean }) {
  if (!show) return null;
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-center text-muted-foreground py-10">
        {loading ? "Cargando…" : "Sin datos para esta fecha."}
      </TableCell>
    </TableRow>
  );
}

function SessionDetailDialog({ session, onClose }: { session: ClosureSession | null; onClose: () => void }) {
  const { data: summary } = useCashSessionSummary(session?.id ?? null);
  const { data: movements = [] } = useCashMovements(session?.id ?? null);

  return (
    <Dialog open={session !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Sesión {session?.session_number}</DialogTitle></DialogHeader>
        {session && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Caja" value={session.register_name ?? "—"} />
              <Field label="Cajero" value={session.cashier_name ?? "—"} />
              <Field label="Estado" value={session.status === "open" ? "Cierre pendiente" : "Cerrada"} />
              <Field label="Apertura" value={dt(session.opened_at)} />
              <Field label="Cierre" value={dt(session.closed_at)} />
              <Field label="Fondo inicial" value={`${refFormat(session.opening_ref)} / ${bs(session.opening_bs)}`} />
            </div>

            {summary && (
              <div className="rounded-xl border border-border/60 p-3 space-y-1">
                <Row label="Tickets" value={String(summary.sales_count)} />
                <Row label="Bruto" value={refFormat(Number(summary.gross_ref))} />
                <Row label="Descuentos" value={`− ${refFormat(Number(summary.discount_ref))}`} />
                <Row label="Neto" value={refFormat(Number(summary.net_ref))} />
                <Row label="Efectivo esperado" value={`${refFormat(Number(summary.expected_ref))} / ${bs(Number(summary.expected_bs))}`} />
              </div>
            )}

            <div className="rounded-xl border border-border/60 p-3 space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Movimientos de efectivo</p>
              {movements.length === 0 && <p className="text-muted-foreground">Sin movimientos.</p>}
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <span>{cashMovementLabel(m.movement_type)}{m.note ? ` · ${m.note}` : ""}</span>
                  <span className="tabular-nums">
                    {m.currency === "VES" ? bs(m.amount) : refFormat(m.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/60 p-3 space-y-1">
              <Row label="Contado" value={session.counted_ref === null ? "Pendiente" : `${refFormat(session.counted_ref)} / ${bs(session.counted_bs)}`} />
              <Row label="Diferencia" value={session.difference_ref === null ? "Pendiente" : `${refFormat(session.difference_ref)} / ${bs(session.difference_bs)}`} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}
