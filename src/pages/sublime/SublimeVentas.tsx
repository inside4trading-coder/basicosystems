import { useMemo, useState } from "react";
import { Receipt, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { refFormat } from "@/lib/posMoney";
import { POS_ALL_SALES_CHANNELS, posChannelLabel } from "@/lib/posSalesChannels";
import { POS_PAYMENT_METHODS, posMethod } from "@/lib/posPaymentMethods";
import { posBankLabel } from "@/lib/posBanks";
import { SaleReceiptDialog } from "@/components/sublime/pos/SaleReceipt";
import { SaleReturnDialog } from "@/components/sublime/pos/SaleReturnDialog";
import {
  useSaleInventoryMovements,
  useSublimeSalesHistory,
  type SaleRow,
} from "@/hooks/useSublimeSalesHistory";
import { saleStatusLabel, useSaleReturns } from "@/hooks/useSublimeSaleReturns";

const ALL = "all";

const statusLabel = saleStatusLabel;

const statusVariant = (s: string) =>
  s === "completed" ? "default" : s === "voided" ? "destructive" : "secondary";

const dt = (iso: string) => new Date(iso).toLocaleString("es-VE");

export default function SublimeVentas() {
  const { data: sales = [], isLoading } = useSublimeSalesHistory();
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState(ALL);
  const [method, setMethod] = useState(ALL);
  const [cashier, setCashier] = useState(ALL);
  const [register, setRegister] = useState(ALL);
  const [session, setSession] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<{ id: string; mode: "return" | "void" } | null>(null);

  const uniq = (vals: (string | null)[]) =>
    Array.from(new Set(vals.filter((v): v is string => !!v))).sort();

  const cashiers = uniq(sales.map((s) => s.cashier_code));
  const registers = uniq(sales.map((s) => s.register_code));
  const sessions = uniq(sales.map((s) => s.session_number ?? s.session_code));

  const rows = useMemo(
    () =>
      sales.filter((s) => {
        if (channel !== ALL && s.sale_origin !== channel) return false;
        if (method !== ALL && !s.payments.some((p) => p.method === method)) return false;
        if (cashier !== ALL && s.cashier_code !== cashier) return false;
        if (register !== ALL && s.register_code !== register) return false;
        if (session !== ALL && (s.session_number ?? s.session_code) !== session) return false;
        if (from && s.sold_at < new Date(`${from}T00:00:00`).toISOString()) return false;
        if (to && s.sold_at > new Date(`${to}T23:59:59`).toISOString()) return false;
        if (q.trim()) {
          const hay = [
            s.sale_number,
            s.customer_name,
            s.invoice_number,
            s.cashier_code,
            ...s.items.map((i) => `${i.sku ?? ""} ${i.title} ${i.subtitle ?? ""}`),
          ]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q.trim().toLowerCase())) return false;
        }
        return true;
      }),
    [sales, q, channel, method, cashier, register, session, from, to]
  );

  const sale = sales.find((s) => s.id === openId) ?? null;
  const receipt = sales.find((s) => s.id === receiptId) ?? null;
  const returnSale = sales.find((s) => s.id === returnTarget?.id) ?? null;

  return (
    <div className="space-y-6">
      <HubHeader icon={Receipt} title="Historial de ventas" subtitle="Ventas reales del POS Sublime con su detalle de cobro" />

      <Card className="p-4 rounded-2xl border-border/60 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por SPOS, cliente, SKU o producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
          <Filter value={channel} onChange={setChannel} all="Todos los orígenes"
            options={POS_ALL_SALES_CHANNELS.map((c) => ({ value: c.id, label: c.label }))} />
          <Filter value={method} onChange={setMethod} all="Todos los pagos"
            options={POS_PAYMENT_METHODS.map((m) => ({ value: m.id, label: m.label }))} />
          <Filter value={cashier} onChange={setCashier} all="Todos los cajeros"
            options={cashiers.map((c) => ({ value: c, label: c }))} />
          <Filter value={register} onChange={setRegister} all="Todas las cajas"
            options={registers.map((c) => ({ value: c, label: c }))} />
          <Filter value={session} onChange={setSession} all="Todas las sesiones"
            options={sessions.map((c) => ({ value: c, label: c }))} />
        </div>
      </Card>

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Venta</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Cajero / Caja</TableHead>
              <TableHead>Sesión</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Pagos</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.sale_number}</TableCell>
                <TableCell className="text-sm">{dt(s.sold_at)}</TableCell>
                <TableCell className="text-sm">{s.customer_name ?? "Venta mostrador"}</TableCell>
                <TableCell className="text-sm">{[s.cashier_code, s.register_code].filter(Boolean).join(" · ") || "—"}</TableCell>
                <TableCell className="text-sm">
                  {s.session_number ?? (
                    <span className="text-muted-foreground italic">Sin sesión histórica</span>
                  )}
                </TableCell>
                <TableCell><Badge variant="secondary">{posChannelLabel(s.sale_origin, s.origin_detail ?? undefined)}</Badge></TableCell>
                <TableCell className="text-sm">
                  {s.payments.map((p) => posMethod(p.method).label).join(" + ") || "—"}
                </TableCell>
                <TableCell className="text-sm">{s.invoice_number ?? "—"}</TableCell>
                <TableCell><Badge>{statusLabel(s.status)}</Badge></TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{refFormat(s.total_ref)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setReceiptId(s.id)}>Ver comprobante</Button>
                    <Button size="sm" variant="outline" onClick={() => setOpenId(s.id)}>Ver detalle</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                  {isLoading ? "Cargando ventas…" : "Sin ventas."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <SaleDetailDialog sale={sale} onClose={() => setOpenId(null)} />

      <SaleReceiptDialog
        sale={receipt}
        phone={receipt?.customer_phone}
        open={receipt !== null}
        onOpenChange={(v) => !v && setReceiptId(null)}
      />
    </div>
  );
}

function Filter({
  value,
  onChange,
  all,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  all: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SaleDetailDialog({ sale, onClose }: { sale: SaleRow | null; onClose: () => void }) {
  const { data: movements = [] } = useSaleInventoryMovements(sale?.sale_number ?? null);

  return (
    <Dialog open={sale !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Venta {sale?.sale_number}</DialogTitle></DialogHeader>
        {sale && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Item label="Fecha" value={dt(sale.sold_at)} />
              <Item label="Estado" value={statusLabel(sale.status)} />
              <Item label="Cajero" value={sale.cashier_code ?? "—"} />
              <Item label="Caja" value={sale.register_code ?? "—"} />
              <Item label="Sesión" value={sale.session_number ?? "Sin sesión histórica"} />
              <Item label="Origen" value={posChannelLabel(sale.sale_origin, sale.origin_detail ?? undefined)} />
              <Item label="Cliente" value={sale.customer_name ?? "Venta mostrador"} />
              <Item label="Factura" value={sale.invoice_number ?? "—"} />
              <Item label="Tasa usada" value={sale.bcv_rate ? `Bs. ${sale.bcv_rate} / REF` : "—"} />
            </div>
            {sale.note && (
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Nota</p>
                <p>{sale.note}</p>
              </div>
            )}

            <Section title="Productos">
              {sale.items.map((i) => (
                <div key={i.id} className="rounded-xl border border-border/60 p-3 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{i.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[i.subtitle, i.sku].filter(Boolean).join(" · ") || "Ítem manual"}
                      </p>
                    </div>
                    <span className="tabular-nums font-semibold">{refFormat(i.line_total_ref)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {i.qty} × {refFormat(i.unit_final_ref)}
                    {i.unit_regular_ref > i.unit_final_ref ? ` · full ${refFormat(i.unit_regular_ref)}` : ""}
                    {i.discount_ref > 0 ? ` · descuento ${refFormat(i.discount_ref)}` : ""}
                  </p>
                </div>
              ))}
            </Section>

            <Section title="Pagos">
              {sale.payments.map((p) => (
                <div key={p.id} className="rounded-xl border border-border/60 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{posMethod(p.method).label}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.currency} {p.amount.toLocaleString("es-VE")}
                      {p.bank ? ` · ${posBankLabel(p.bank)}` : ""}
                      {p.reference ? ` · Ref ${p.reference}` : ""}
                    </p>
                  </div>
                  <span className="tabular-nums font-semibold">{refFormat(p.amount_ref)}</span>
                </div>
              ))}
            </Section>

            <div className="rounded-xl border border-border/60 p-3 space-y-1">
              <Row label="Subtotal" value={refFormat(sale.subtotal_regular_ref)} />
              <Row label="Descuentos" value={`− ${refFormat(sale.discount_total_ref)}`} />
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold">Total</span>
                <span className="num text-2xl font-black tabular-nums">{refFormat(sale.total_ref)}</span>
              </div>
            </div>

            <Section title="Trazabilidad">
              <div className="rounded-xl border border-border/60 p-3 text-xs space-y-1">
                <p>
                  Sesión de caja:{" "}
                  {sale.session_number ? (
                    <span className="font-mono">{sale.session_number}</span>
                  ) : (
                    <span className="italic text-muted-foreground">Sin sesión histórica</span>
                  )}
                </p>
                {movements.length === 0 && <p className="text-muted-foreground">Sin movimientos de inventario asociados.</p>}
                {movements.map((m: any) => (
                  <p key={m.id} className="tabular-nums">
                    {m.movement_type} · {m.qty_delta} → {m.qty_result} · {dt(m.created_at)}
                  </p>
                ))}
              </div>
            </Section>

            <p className="text-xs text-muted-foreground">Solo lectura: una venta finalizada no se edita desde esta pantalla.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
