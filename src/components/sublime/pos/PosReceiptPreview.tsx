import { Download, FileText, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Money, bsAmount, toRef } from "@/lib/posMoney";
import { posMethod } from "@/lib/posPaymentMethods";
import { posBankLabel } from "@/lib/posBanks";
import { posChannelLabel, type PosSalesChannelId } from "@/lib/posSalesChannels";
import { currencyLabel, type PosPaymentLine } from "./PosPaymentSheet";
import { POS_TAX_PCT, type PosCartLine } from "./usePosCart";
import type { PosCustomer } from "./PosCustomerDialog";
import type { PosSession } from "./PosHeader";

export interface PosSaleDocument {
  number: string;
  at: string;
  session: PosSession;
  customer: PosCustomer | null;
  channel: PosSalesChannelId | null;
  channelDetail: string;
  lines: PosCartLine[];
  subtotalRegular: number;
  discountTotal: number;
  /** Total final, IVA incluido. */
  total: number;
  /** IVA contenido en el total (informativo, no se suma). */
  taxIncluded: number;
  note: string;
  payments: PosPaymentLine[];
  status: string;
}

export function PosReceiptPreview({ doc }: { doc: PosSaleDocument }) {
  return (
    <Tabs defaultValue="factura">
      <TabsList className="w-full">
        <TabsTrigger value="factura" className="flex-1">Factura</TabsTrigger>
        <TabsTrigger value="ticket" className="flex-1">Ticket / comprobante</TabsTrigger>
      </TabsList>
      <TabsContent value="factura" className="pt-3">
        <DocumentBody doc={doc} invoice />
      </TabsContent>
      <TabsContent value="ticket" className="pt-3">
        <DocumentBody doc={doc} invoice={false} />
      </TabsContent>
    </Tabs>
  );
}

function DocumentBody({ doc, invoice }: { doc: PosSaleDocument; invoice: boolean }) {
  const rate = doc.session.rate;
  const base = doc.total - doc.taxIncluded;
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
        <Info label="Origen de la venta" value={posChannelLabel(doc.channel, doc.channelDetail)} />
        <Info label="Tasa aplicada" value={`Bs. ${bsAmount(1, rate)} / REF`} />
      </div>

      <Separator />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <Info label="Cliente / razón social" value={doc.customer?.name || "Consumidor final"} />
        <Info label="Cédula / RIF" value={doc.customer?.idCard || "—"} />
        <Info label="Teléfono" value={doc.customer?.phone || "—"} />
        <Info label="Dirección" value={doc.customer?.address || "—"} />
        <Info label="Correo" value={doc.customer?.email || "—"} />
      </div>

      <Separator />

      <div className="space-y-2">
        {doc.lines.map((l) => (
          <div key={l.key} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{l.title}</p>
              <p className="text-xs text-muted-foreground">
                {l.subtitle}
                {l.sku ? <> · <span className="font-mono">{l.sku}</span></> : null} · {l.qty} und.
              </p>
              <div className="flex items-end gap-3 mt-0.5 flex-wrap">
                {l.unitDiscount > 0 ? (
                  <>
                    <Labelled label="Precio full">
                      <Money value={l.regularPrice} rate={rate} size="xs" align="left" strike />
                    </Labelled>
                    <Labelled label="Precio final">
                      <Money value={l.finalPrice} rate={rate} size="xs" align="left" tone="primary" />
                    </Labelled>
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
        <div className="flex items-center justify-between pt-1">
          <span className="font-black uppercase text-xs tracking-wider">Total final</span>
          <Money value={doc.total} rate={rate} size="lg" />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Todos los precios incluyen IVA {POS_TAX_PCT}%.
        </p>
        {invoice ? (
          <div className="rounded-xl bg-muted/50 p-3 space-y-1 mt-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Desglose fiscal (informativo)
            </p>
            <Row label="Base imponible">
              <Money value={base} rate={rate} size="xs" />
            </Row>
            <Row label={`IVA ${POS_TAX_PCT}% incluido`}>
              <Money value={doc.taxIncluded} rate={rate} size="xs" />
            </Row>
          </div>
        ) : null}
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
                {p.fields.bank ? ` · ${posBankLabel(p.fields.bank)}` : ""}
                {p.fields.terminal ? ` · ${p.fields.terminal}` : ""}
                {p.fields.reference ? ` · Ref. ${p.fields.reference}` : ""}
              </span>
              <Money value={ref} rate={rate} size="xs" />
            </div>
          );
        })}
      </div>

      {doc.note ? (
        <>
          <Separator />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nota</p>
            <p className="text-xs text-foreground whitespace-pre-line">{doc.note}</p>
          </div>
        </>
      ) : null}
    </Card>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="leading-tight">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
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
  onViewInvoice,
}: {
  onNewSale: () => void;
  onReprint: () => void;
  onViewInvoice: () => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <Button variant="outline" onClick={onViewInvoice}>
        <FileText className="h-4 w-4 mr-2" />
        Ver factura
      </Button>
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
