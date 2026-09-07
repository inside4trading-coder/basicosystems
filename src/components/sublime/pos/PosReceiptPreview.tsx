import { Download, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { variantLabel } from "@/lib/sublimeMock";
import { Money, bsAmount, toRef } from "@/lib/posMoney";
import { posMethod } from "@/lib/posPaymentMethods";
import { posChannelLabel, type PosSalesChannelId } from "@/lib/posSalesChannels";
import { currencyLabel, type PosPaymentLine } from "./PosPaymentSheet";
import type { PosCartLine } from "./usePosCart";
import type { PosCustomer } from "./PosCustomerDialog";
import type { PosSession } from "./PosHeader";

export interface PosSaleDocument {
  number: string;
  at: string;
  session: PosSession;
  customer: PosCustomer | null;
  channel: PosSalesChannelId;
  channelDetail: string;
  lines: PosCartLine[];
  subtotalRegular: number;
  discountTotal: number;
  subtotal: number;
  taxUsd: number;
  total: number;
  payments: PosPaymentLine[];
  status: string;
}

export function PosReceiptPreview({ doc }: { doc: PosSaleDocument }) {
  return (
    <Tabs defaultValue="ticket">
      <TabsList className="w-full">
        <TabsTrigger value="ticket" className="flex-1">Ticket / comprobante</TabsTrigger>
        <TabsTrigger value="factura" className="flex-1">Factura</TabsTrigger>
      </TabsList>
      <TabsContent value="ticket" className="pt-3">
        <DocumentBody doc={doc} invoice={false} />
      </TabsContent>
      <TabsContent value="factura" className="pt-3">
        <DocumentBody doc={doc} invoice />
      </TabsContent>
    </Tabs>
  );
}

function DocumentBody({ doc, invoice }: { doc: PosSaleDocument; invoice: boolean }) {
  const rate = doc.session.rate;
  return (
    <Card className="p-5 rounded-2xl border-border/60 space-y-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {invoice ? "Factura" : "Ticket de venta"}
          </p>
          <p className="font-black text-lg tracking-tight">{doc.number}</p>
          <p className="text-xs text-muted-foreground">{doc.at}</p>
        </div>
        <Badge variant="secondary">{doc.status}</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <Info label="Sede" value={doc.session.locationName} />
        <Info label="Caja" value={doc.session.registerName} />
        <Info label="Sesión" value={doc.session.sessionCode} />
        <Info label="Cajero / vendedor" value={doc.session.cashierName} />
        <Info label="Canal de venta" value={posChannelLabel(doc.channel, doc.channelDetail)} />
        <Info label="Tasa aplicada" value={`Bs. ${bsAmount(1, rate)} / REF`} />
      </div>

      <Separator />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <Info label="Cliente / razón social" value={doc.customer?.name || "Consumidor final"} />
        <Info label="Cédula / RIF" value={doc.customer?.idCard || "—"} />
        <Info label="Teléfono" value={doc.customer?.phone || "—"} />
        {invoice ? <Info label="Dirección" value={doc.customer?.address || "—"} /> : null}
        {invoice ? <Info label="Correo" value={doc.customer?.email || "—"} /> : null}
      </div>

      <Separator />

      <div className="space-y-2">
        {doc.lines.map((l) => (
          <div key={l.variant.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{l.product.title}</p>
              <p className="text-xs text-muted-foreground">
                {variantLabel(l.variant)} · <span className="font-mono">{l.variant.sku}</span> · {l.qty} und.
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {l.unitDiscount > 0 ? (
                  <>
                    <Money value={l.regularPrice} rate={rate} size="xs" align="left" strike />
                    <Money value={l.finalPrice} rate={rate} size="xs" align="left" tone="primary" />
                    <span className="text-[10px] font-bold text-primary">-{l.discountPct}%</span>
                  </>
                ) : (
                  <Money value={l.finalPrice} rate={rate} size="xs" align="left" />
                )}
              </div>
            </div>
            <Money value={l.lineTotal} rate={rate} size="sm" />
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Row label="Subtotal regular">
          <Money value={doc.subtotalRegular} rate={rate} size="xs" />
        </Row>
        <Row label="Descuentos">
          <Money value={doc.discountTotal} rate={rate} size="xs" sign="-" tone="destructive" />
        </Row>
        <Row label="Subtotal final">
          <Money value={doc.subtotal} rate={rate} size="xs" />
        </Row>
        <Row label="Impuesto">
          <Money value={doc.taxUsd} rate={rate} size="xs" />
        </Row>
        <div className="flex items-center justify-between pt-1">
          <span className="font-black uppercase text-xs tracking-wider">Total</span>
          <Money value={doc.total} rate={rate} size="lg" />
        </div>
      </div>

      <Separator />

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagos</p>
        {doc.payments.map((p) => {
          const def = posMethod(p.method);
          const ref = toRef(Number(p.amount) || 0, def.currency, rate);
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate">
                {def.label} ({currencyLabel(def.currency)})
                {p.fields.bank ? ` · ${p.fields.bank}` : ""}
                {p.fields.terminal ? ` · ${p.fields.terminal}` : ""}
                {p.fields.reference ? ` · Ref. ${p.fields.reference}` : ""}
              </span>
              <Money value={ref} rate={rate} size="xs" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground truncate">{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function PosReceiptActions({
  onNewSale,
  onReprint,
}: {
  onNewSale: () => void;
  onReprint: () => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Button variant="outline" onClick={onReprint}>
        <Printer className="h-4 w-4 mr-2" />
        Imprimir
      </Button>
      <Button variant="outline" onClick={onReprint}>
        <Download className="h-4 w-4 mr-2" />
        Descargar
      </Button>
      <Button variant="outline" onClick={onReprint}>
        <Send className="h-4 w-4 mr-2" />
        Enviar
      </Button>
      <Button onClick={onNewSale}>Nueva venta</Button>
    </div>
  );
}
