/**
 * Comprobante de una venta ya registrada.
 * Se alimenta exclusivamente de la venta persistida: nunca del carrito.
 */
import { useState } from "react";
import { Download, Printer, Receipt, Share2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { refFormat } from "@/lib/posMoney";
import type { SaleRow } from "@/hooks/useSublimeSalesHistory";
import {
  downloadSaleReceiptPdf,
  printSaleReceipt,
  receiptHeaderRows,
  receiptPaymentLabel,
  receiptText,
  saleReceiptPdfFile,
  whatsappReceiptUrl,
} from "@/lib/posReceipt";

export function SaleReceiptBody({ sale }: { sale: SaleRow }) {
  return (
    <Card className="p-5 rounded-2xl border-border/60 space-y-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Sublime</p>
          <p className="font-black text-lg tracking-tight">{sale.sale_number}</p>
        </div>
        <Badge variant="secondary">{sale.status === "completed" ? "Completada" : sale.status}</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {receiptHeaderRows(sale).map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="font-semibold text-foreground break-words">{v}</p>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        {sale.items.map((i) => (
          <div key={i.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{i.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {[i.subtitle, i.sku].filter(Boolean).join(" · ") || "Ítem manual"}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {i.qty} × {refFormat(i.unit_final_ref)}
                {i.discount_ref > 0 ? ` · descuento ${refFormat(i.discount_ref)}` : ""}
              </p>
            </div>
            <span className="tabular-nums font-semibold">{refFormat(i.line_total_ref)}</span>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-1">
        {sale.discount_total_ref > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Descuentos</span>
            <span className="tabular-nums">− {refFormat(sale.discount_total_ref)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-black uppercase text-xs tracking-wider">Total</span>
          <span className="text-2xl font-black tabular-nums">{refFormat(sale.total_ref)}</span>
        </div>
      </div>

      <Separator />

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagos</p>
        {sale.payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate">{receiptPaymentLabel(p)}</span>
            <span className="tabular-nums">{refFormat(p.amount_ref)}</span>
          </div>
        ))}
      </div>

      {sale.note ? (
        <>
          <Separator />
          <p className="text-xs whitespace-pre-line">{sale.note}</p>
        </>
      ) : null}

      <p className="text-[10px] text-muted-foreground">Precios con IVA incluido.</p>
    </Card>
  );
}

export function SaleReceiptActions({
  sale,
  phone,
  children,
}: {
  sale: SaleRow;
  phone?: string | null;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      const file = saleReceiptPdfFile(sale);
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: sale.sale_number, text: receiptText(sale) });
      } else if (nav.share) {
        await nav.share({ title: sale.sale_number, text: receiptText(sale) });
      } else {
        downloadSaleReceiptPdf(sale);
        toast.info("Tu navegador no permite compartir: se descargó el comprobante.");
      }
    } catch {
      /* el usuario canceló */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Button
        variant="outline"
        onClick={() => {
          if (!printSaleReceipt(sale)) toast.error("Permite las ventanas emergentes para imprimir.");
        }}
      >
        <Printer className="h-4 w-4 mr-2" />
        Imprimir
      </Button>
      <Button variant="outline" onClick={() => downloadSaleReceiptPdf(sale)}>
        <Download className="h-4 w-4 mr-2" />
        Descargar PDF
      </Button>
      <Button variant="outline" onClick={share} disabled={busy}>
        <Share2 className="h-4 w-4 mr-2" />
        Compartir
      </Button>
      {phone ? (
        <Button variant="outline" onClick={() => window.open(whatsappReceiptUrl(phone, sale), "_blank")}>
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp
        </Button>
      ) : null}
      {children}
    </div>
  );
}

export function SaleReceiptDialog({
  sale,
  phone,
  open,
  onOpenChange,
}: {
  sale: SaleRow | null;
  phone?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Comprobante {sale?.sale_number}
          </DialogTitle>
        </DialogHeader>
        {sale ? (
          <div className="space-y-4">
            <SaleReceiptBody sale={sale} />
            <SaleReceiptActions sale={sale} phone={phone} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
