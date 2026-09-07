import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PosHeader, type PosSession } from "@/components/sublime/pos/PosHeader";
import { PosCatalog } from "@/components/sublime/pos/PosCatalog";
import { PosCart } from "@/components/sublime/pos/PosCart";
import { PosFunctionsBar, type PosFunctionId } from "@/components/sublime/pos/PosFunctionsBar";
import { PosCustomerDialog, type PosCustomer } from "@/components/sublime/pos/PosCustomerDialog";
import { PosPaymentSheet, type PosPaymentLine } from "@/components/sublime/pos/PosPaymentSheet";
import {
  PosCashierDialog,
  PosClosuresDialog,
  PosRegisterDialog,
  PosSuspendedDialog,
} from "@/components/sublime/pos/PosSessionDialogs";
import {
  PosReceiptActions,
  PosReceiptPreview,
  type PosSaleDocument,
} from "@/components/sublime/pos/PosReceiptPreview";
import { POS_BCV_RATE, usePosCart } from "@/components/sublime/pos/usePosCart";
import { POS_STORE, posCashier, posRegister, posSessionOf } from "@/lib/posSession";
import { posAudit } from "@/lib/posAudit";
import { posChannelLabel } from "@/lib/posSalesChannels";

/**
 * POS Sublime — aplicación dedicada a pantalla completa.
 * Sede → caja → sesión → cajero → ventas. Cada caja mantiene su carrito
 * activo; el inventario es único por sede.
 */
export default function SublimePosApp() {
  const navigate = useNavigate();

  const [registerId, setRegisterId] = useState("reg-1");
  const [cashierId, setCashierId] = useState("csh-1");
  const [registerOpen, setRegisterOpen] = useState(true);

  const cart = usePosCart(registerId);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cashierOpen, setCashierOpen] = useState(false);
  const [registerPickerOpen, setRegisterPickerOpen] = useState(false);
  const [closuresOpen, setClosuresOpen] = useState(false);
  const [suspendedOpen, setSuspendedOpen] = useState(false);
  const [payments, setPayments] = useState<PosPaymentLine[]>([]);
  const [doc, setDoc] = useState<PosSaleDocument | null>(null);

  const session: PosSession = useMemo(() => {
    const reg = posRegister(registerId);
    const ses = posSessionOf(registerId);
    const csh = posCashier(cashierId);
    return {
      locationId: POS_STORE.id,
      locationName: POS_STORE.name,
      registerId: reg.id,
      registerName: reg.name,
      posSessionId: ses.id,
      sessionCode: ses.code,
      cashierId: csh.id,
      cashierName: csh.name,
      registerOpen,
      rate: POS_BCV_RATE,
      online: true,
    };
  }, [registerId, cashierId, registerOpen]);

  const auditCtx = {
    cashierId: session.cashierId,
    cashierName: session.cashierName,
    registerId: session.registerId,
    registerName: session.registerName,
    posSessionId: session.posSessionId,
    locationId: session.locationId,
  };

  const confirmPayment = () => {
    const sale: PosSaleDocument = {
      number: `POS-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      at: new Date().toLocaleString("es-VE"),
      session,
      customer,
      channel: cart.channel,
      channelDetail: cart.channelDetail,
      lines: cart.lines,
      subtotalRegular: cart.subtotalRegular,
      discountTotal: cart.discountTotal,
      subtotal: cart.subtotal - cart.cartDiscount,
      taxUsd: cart.taxUsd,
      total: cart.total,
      payments,
      status: "Emitida",
    };
    setDoc(sale);
    setPayOpen(false);
    posAudit(
      "sale",
      `${sale.number} · ${posChannelLabel(sale.channel, sale.channelDetail)} · ${payments.length} método(s)`,
      auditCtx
    );
    if (cart.discountTotal > 0) {
      posAudit("discount", `${sale.number} · descuento ${cart.discountTotal.toFixed(2)} REF`, auditCtx);
    }
  };

  const newSale = () => {
    setDoc(null);
    setPayments([]);
    setCustomer(null);
    cart.clear();
  };

  const onFunction = (id: PosFunctionId, label: string) => {
    if (id === "closures") {
      setClosuresOpen(true);
      return;
    }
    if (id === "suspend") {
      const entry = cart.suspend({
        registerName: session.registerName,
        cashierName: session.cashierName,
        customerName: customer?.name ?? null,
      });
      if (!entry) {
        toast.info("No hay carrito que suspender.");
        return;
      }
      posAudit("suspend", `Carrito ${entry.id}`, auditCtx);
      setCustomer(null);
      toast.success(`Carrito ${entry.id} suspendido.`);
      return;
    }
    if (id === "resume") {
      setSuspendedOpen(true);
      return;
    }
    toast.info(`${label}: función prevista, aún sin activar.`);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <PosHeader
        session={session}
        onChangeCashier={() => setCashierOpen(true)}
        onChangeRegister={() => setRegisterPickerOpen(true)}
        onToggleRegisterState={() => {
          setRegisterOpen((v) => !v);
          posAudit(registerOpen ? "close_register" : "open_register", session.registerName, auditCtx);
          toast.success(registerOpen ? "Caja cerrada." : "Caja abierta.");
        }}
        onExit={() => navigate("/sublime")}
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,68fr)_minmax(340px,32fr)]">
        <section className="flex flex-col min-h-0 p-4 gap-3">
          <PosFunctionsBar onAction={onFunction} />
          <PosCatalog
            rate={session.rate}
            onPick={(e) => cart.add(e.variant.id)}
            onScan={() => toast.info("Escaneo: conecta un lector o usa la búsqueda por SKU.")}
          />
        </section>

        <PosCart
          cart={cart}
          rate={session.rate}
          customerName={customer?.name ?? null}
          onPickCustomer={() => setCustomerOpen(true)}
          onClearCustomer={() => setCustomer(null)}
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

      <PosCashierDialog
        open={cashierOpen}
        onOpenChange={setCashierOpen}
        currentCashierId={cashierId}
        onSelect={(id) => {
          setCashierId(id);
          setCashierOpen(false);
          posAudit("change_cashier", posCashier(id).name, auditCtx);
        }}
      />

      <PosRegisterDialog
        open={registerPickerOpen}
        onOpenChange={setRegisterPickerOpen}
        currentRegisterId={registerId}
        onSelect={(id) => {
          setRegisterId(id);
          setRegisterPickerOpen(false);
          posAudit("change_register", posRegister(id).name, auditCtx);
        }}
      />

      <PosClosuresDialog
        open={closuresOpen}
        onOpenChange={setClosuresOpen}
        rate={session.rate}
        date={new Date().toLocaleDateString("es-VE")}
      />

      <PosSuspendedDialog
        open={suspendedOpen}
        onOpenChange={setSuspendedOpen}
        carts={cart.suspended}
        rate={session.rate}
        onResume={(id) => {
          const found = cart.resume(id);
          if (found) {
            posAudit("resume", `Carrito ${found.id}`, auditCtx);
            toast.success(`Carrito ${found.id} recuperado.`);
          }
          setSuspendedOpen(false);
        }}
      />

      <PosPaymentSheet
        open={payOpen}
        onOpenChange={setPayOpen}
        total={cart.total}
        rate={session.rate}
        payments={payments}
        setPayments={setPayments}
        channel={cart.channel}
        setChannel={cart.setChannel}
        channelDetail={cart.channelDetail}
        setChannelDetail={cart.setChannelDetail}
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
              <PosReceiptActions
                onNewSale={newSale}
                onReprint={() => {
                  posAudit("reprint", doc.number, auditCtx);
                  toast.info("Impresión y envío: previstos para la versión conectada.");
                }}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
