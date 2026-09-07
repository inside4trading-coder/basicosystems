import { Download, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usdFormat, variantLabel } from "@/lib/sublimeMock";
import { posMethod } from "@/lib/posPaymentMethods";
import type { PosPaymentLine } from "./PosPaymentSheet";
import type { PosCartLine } from "./usePosCart";
import type { PosCustomer } from "./PosCustomerDialog";
import type { PosSession } from "./PosHeader";

export interface PosSaleDocument {
  number: string;
  at: string;
  session: PosSession;
  customer: PosCustomer | null;
  lines: PosCartLine[];
  subtotal: number;
  discountUsd: number;
  taxUsd: number;
  total: number;
  payments: PosPaymentLine[];
}

export function PosReceiptPreview({ doc }: { doc: PosSaleDocument }) {
  return (
    <Tabs defaultValue="ticket">
      <TabsList className="w-full">
        <TabsTrigger value="ticket" className="flex-1">Ticket</TabsTrigger>
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
        <Badge variant="secondary">Emitido</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <Info label="Sede" value={doc.session.storeName} />
        <Info label="Caja" value={doc.session.registerName} />
        <Info label="Cajero / vendedor" value={doc.session.cashier} />
        <Info label="Moneda" value="USD" />
        <Info label="Tasa aplicada" value={`Bs. ${rate.toFixed(2)}`} />
        <Info label="Equivalente VES" value={`Bs. ${(doc.total * rate).toLocaleString("es-VE", { maximumFractionDigits: 2 })}`} />
      </div>

      <Separator />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <Info label="Cliente" value={doc.customer?.name || "Consumidor final"} />
        <Info label="Cédula / RIF" value={doc.customer?.idCard || "—"} />
        <Info label="Teléfono" value={doc.customer?.phone || "—"} />
        {invoice ? <Info label="Dirección" value={doc.customer?.address || "—"} /> : null}
        {invoice ? <Info label="Correo" value={doc.customer?.email || "—"} /> : null}
      </div>

      <Separator />

      <div className="space-y-1.5">
        {doc.lines.map((l) => (
          <div key={l.variant.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{l.product.title}</p>
              <p className="text-xs text-muted-foreground">
                {variantLabel(l.variant)} · <span className="font-mono">{l.variant.sku}</span> ·{" "}
                {l.qty} × {usdFormat(l.variant.pvp)}
              </p>
            </div>
            <span className="num font-bold tabular-nums">{usdFormat(l.lineTotal)}</span>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-1 text-sm">
        <Row label="Subtotal" value={usdFormat(doc.subtotal)} />
        <Row label="Descuento" value={`− ${usdFormat(doc.discountUsd)}`} />
        <Row label="Impuesto" value={usdFormat(doc.taxUsd)} />
        <div className="flex items-center justify-between pt-1">
          <span className="font-black uppercase text-xs tracking-wider">Total</span>
          <span className="num text-xl font-black tabular-nums">{usdFormat(doc.total)}</span>
        </div>
      </div>

      <Separator />

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagos</p>
        {doc.payments.map((p) => {
          const def = posMethod(p.method);
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
              <span>
                {def.label}
                {p.fields.bank ? ` · ${p.fields.bank}` : ""}
                {p.fields.terminal ? ` · ${p.fields.terminal}` : ""}
                {p.fields.reference ? ` · Ref. ${p.fields.reference}` : ""}
              </span>
              <span className="num font-semibold tabular-nums">
                {def.currency === "USD"
                  ? usdFormat(Number(p.amount) || 0)
                  : `Bs. ${(Number(p.amount) || 0).toLocaleString("es-VE")}`}
              </span>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="num tabular-nums">{value}</span>
    </div>
  );
}

export function PosReceiptActions({ onNewSale }: { onNewSale: () => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Button variant="outline">
        <Printer className="h-4 w-4 mr-2" />
        Imprimir
      </Button>
      <Button variant="outline">
        <Download className="h-4 w-4 mr-2" />
        PDF
      </Button>
      <Button variant="outline">
        <Send className="h-4 w-4 mr-2" />
        Enviar
      </Button>
      <Button onClick={onNewSale}>Nueva venta</Button>
    </div>
  );
}
