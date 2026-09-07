import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PosHeader, type PosSession } from "@/components/sublime/pos/PosHeader";
import { PosCatalog } from "@/components/sublime/pos/PosCatalog";
import { PosCart } from "@/components/sublime/pos/PosCart";
import { PosFunctionsBar } from "@/components/sublime/pos/PosFunctionsBar";
import { PosCustomerDialog, type PosCustomer } from "@/components/sublime/pos/PosCustomerDialog";
import { PosPaymentSheet, type PosPaymentLine } from "@/components/sublime/pos/PosPaymentSheet";
import {
  PosReceiptActions,
  PosReceiptPreview,
  type PosSaleDocument,
} from "@/components/sublime/pos/PosReceiptPreview";
import { POS_BCV_RATE, usePosCart } from "@/components/sublime/pos/usePosCart";

/**
 * POS Sublime — aplicación dedicada a pantalla completa.
 * Consume productos, variantes, precios, inventario, clientes, sede y caja
 * desde el Hub; el Hub sigue siendo la fuente de verdad.
 */
export default function SublimePosApp() {
  const navigate = useNavigate();
  const cart = usePosCart();
  const [session] = useState<PosSession>({
    storeName: "Sublime Barquicenter",
    registerName: "Caja 1",
    cashier: "Mari",
    rate: POS_BCV_RATE,
    online: true,
  });
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payments, setPayments] = useState<PosPaymentLine[]>([]);
  const [doc, setDoc] = useState<PosSaleDocument | null>(null);

  const confirmPayment = () => {
    setDoc({
      number: `POS-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      at: new Date().toLocaleString("es-VE"),
      session,
      customer,
      lines: cart.lines,
      subtotal: cart.subtotal,
      discountUsd: cart.discountUsd,
      taxUsd: cart.taxUsd,
      total: cart.total,
      payments,
    });
    setPayOpen(false);
  };

  const newSale = () => {
    setDoc(null);
    setPayments([]);
    setCustomer(null);
    cart.clear();
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <PosHeader
        session={session}
        onChangeRegister={() => toast.info("Selector de caja: previsto para la versión conectada.")}
        onToggleRegisterState={() => toast.info("Apertura/cierre de caja: aún sin activar.")}
        onExit={() => navigate("/sublime")}
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,68fr)_minmax(340px,32fr)]">
        <section className="flex flex-col min-h-0 p-4 gap-3">
          <PosFunctionsBar />
          <PosCatalog
            onPick={(e) => cart.add(e.variant.id)}
            onScan={() => toast.info("Escaneo: conecta un lector o usa la búsqueda por SKU.")}
          />
        </section>

        <PosCart
          lines={cart.lines}
          units={cart.units}
          subtotal={cart.subtotal}
          discountUsd={cart.discountUsd}
          setDiscountUsd={cart.setDiscountUsd}
          taxEnabled={cart.taxEnabled}
          setTaxEnabled={cart.setTaxEnabled}
          taxUsd={cart.taxUsd}
          total={cart.total}
          rate={session.rate}
          customerName={customer?.name ?? null}
          onPickCustomer={() => setCustomerOpen(true)}
          onClearCustomer={() => setCustomer(null)}
          onChangeQty={cart.changeQty}
          onRemove={cart.remove}
          onCheckout={() => setPayOpen(true)}
        />
      </div>

      <PosCustomerDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        onSelect={(c) => {
          setCustomer(c);
          setCustomerOpen(false);
        }}
      />

      <PosPaymentSheet
        open={payOpen}
        onOpenChange={setPayOpen}
        total={cart.total}
        rate={session.rate}
        payments={payments}
        setPayments={setPayments}
        onConfirm={confirmPayment}
      />

      <Dialog open={doc !== null} onOpenChange={(v) => !v && newSale()}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black tracking-tight">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              Venta completada
            </DialogTitle>
          </DialogHeader>
          {doc ? (
            <div className="space-y-4">
              <PosReceiptPreview doc={doc} />
              <PosReceiptActions onNewSale={newSale} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
