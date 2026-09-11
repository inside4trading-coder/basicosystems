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
import { PosManualItemDialog } from "@/components/sublime/pos/PosManualItemDialog";
import { PosNoteDialog } from "@/components/sublime/pos/PosNoteDialog";
import { PosCashDrawerDialog } from "@/components/sublime/pos/PosCashDrawerDialog";
import {
  useActiveCashSession,
  useCashMovements,
  useCashSessionSummary,
  useCloseCashSession,
  useOpenCashSession,
  useRegisterCashMovement,
  useSublimeRegisters,
} from "@/components/sublime/pos/useSublimeCashSession";
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
import { useSublimePosCatalog } from "@/components/sublime/pos/useSublimePosCatalog";
import { useRegisterSublimePosSale } from "@/components/sublime/pos/useSublimePosSale";
import { posCashier } from "@/lib/posSession";
import { posAudit } from "@/lib/posAudit";
import { posChannelLabel } from "@/lib/posSalesChannels";

/**
 * POS Sublime — aplicación dedicada a pantalla completa.
 * Sede → caja → sesión → cajero → ventas. Cada caja mantiene su carrito
 * activo; el inventario es único por sede.
 */
export default function SublimePosApp() {
  const navigate = useNavigate();

  const [cashierId, setCashierId] = useState("csh-1");

  const catalogQuery = useSublimePosCatalog();
  const catalog = catalogQuery.data?.entries ?? [];
  const categories = catalogQuery.data?.categories ?? [];
  const location = catalogQuery.data?.location ?? null;
  const registerSale = useRegisterSublimePosSale();
  /** Identificador del intento de cobro: protege contra dobles ventas. */
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());

  // Cajas reales de la sede. La caja elegida se recuerda solo como comodidad:
  // el dato oficial (sesión, efectivo, ventas) siempre viene del servidor.
  const registersQuery = useSublimeRegisters(location?.id);
  const registers = registersQuery.data ?? [];
  const [registerId, setRegisterId] = useState<string | null>(
    () => localStorage.getItem("sublime_pos_register")
  );
  useEffect(() => {
    if (!registers.length) return;
    if (!registerId || !registers.some((r) => r.id === registerId)) {
      setRegisterId(registers[0].id);
    }
  }, [registers, registerId]);
  useEffect(() => {
    if (registerId) localStorage.setItem("sublime_pos_register", registerId);
  }, [registerId]);

  const activeSessionQuery = useActiveCashSession(registerId);
  const cashSession = activeSessionQuery.data ?? null;
  const movementsQuery = useCashMovements(cashSession?.id);
  const summaryQuery = useCashSessionSummary(cashSession?.id);
  const openSession = useOpenCashSession();
  const cashMovement = useRegisterCashMovement();
  const closeSession = useCloseCashSession();

  const cart = usePosCart(registerId ?? "sin-caja", catalog);

  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cashierOpen, setCashierOpen] = useState(false);
  const [registerPickerOpen, setRegisterPickerOpen] = useState(false);
  const [closuresOpen, setClosuresOpen] = useState(false);
  const [suspendedOpen, setSuspendedOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [payments, setPayments] = useState<PosPaymentLine[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [doc, setDoc] = useState<PosSaleDocument | null>(null);


  const register = registers.find((r) => r.id === registerId) ?? null;

  const session: PosSession = useMemo(() => {
    const csh = posCashier(cashierId);
    return {
      locationId: location?.id ?? "",
      locationName: location?.name ?? "Sin sede",
      registerId: register?.id ?? "",
      registerName: register?.name ?? "Sin caja",
      posSessionId: cashSession?.id ?? "",
      sessionCode: cashSession?.session_number ?? "Sin sesión",
      cashierId: csh.id,
      cashierName: cashSession?.cashier_name ?? csh.name,
      registerOpen: !!cashSession,
      rate: POS_BCV_RATE,
      online: true,
    };
  }, [cashierId, location, register, cashSession]);

  const auditCtx = {
    cashierId: session.cashierId,
    cashierName: session.cashierName,
    registerId: session.registerId,
    registerName: session.registerName,
    posSessionId: session.posSessionId,
    locationId: session.locationId,
  };

  const confirmPayment = async () => {
    if (registerSale.isPending) return;
    if (!location) {
      toast.error("No hay una tienda configurada para vender.");
      return;
    }
    if (!cart.channel) {
      toast.error("Selecciona el origen de la venta.");
      return;
    }
    if (!cashSession) {
      toast.error("Debes abrir caja antes de vender.");
      setPayOpen(false);
      setDrawerOpen(true);
      return;
    }

    try {
      const result = await registerSale.mutateAsync({
        idempotencyKey: attemptKey,
        locationId: location.id,
        channel: cart.channel,
        channelDetail: cart.channelDetail,
        lines: cart.lines,
        payments,
        customer,
        invoiceNumber: invoiceNumber.trim(),
        note: cart.note,
        rate: session.rate,
        registerCode: session.registerName,
        cashierCode: session.cashierName,
        sessionCode: session.sessionCode,
        cashSessionId: cashSession.id,
      });

      const sale: PosSaleDocument = {
        number: result.sale_number,
        invoiceNumber: invoiceNumber.trim() || null,
        at: new Date().toLocaleString("es-VE"),
        session,
        customer,
        channel: cart.channel,
        channelDetail: cart.channelDetail,

        lines: cart.lines,
        subtotalRegular: cart.subtotalRegular,
        discountTotal: cart.discountTotal,
        total: cart.total,
        taxIncluded: cart.taxIncluded,
        note: cart.note,
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
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo completar la venta.");
    }
  };

  const newSale = () => {
    setDoc(null);
    setPayments([]);
    setCustomer(null);
    setInvoiceNumber("");
    setAttemptKey(crypto.randomUUID());
    cart.clear();
  };


  const onFunction = (id: PosFunctionId, label: string) => {
    if (id === "closures") return setClosuresOpen(true);
    if (id === "manual_item") return setManualOpen(true);
    if (id === "note") return setNoteOpen(true);
    if (id === "cash") return setDrawerOpen(true);
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
    if (id === "resume") return setSuspendedOpen(true);
    toast.info(`${label}: función prevista, aún sin activar.`);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <PosHeader
        session={session}
        onChangeCashier={() => setCashierOpen(true)}
        onChangeRegister={() => setRegisterPickerOpen(true)}
        onOpenDrawer={() => setDrawerOpen(true)}
        onExit={() => navigate("/sublime")}
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,68fr)_minmax(340px,32fr)]">
        <section className="flex flex-col min-h-0 p-4 gap-3">
          <PosFunctionsBar onAction={onFunction} />
          <PosCatalog
            rate={session.rate}
            entries={catalog}
            categories={categories}
            loading={catalogQuery.isLoading}
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
          onEditNote={() => setNoteOpen(true)}
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

      <PosManualItemDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        rate={session.rate}
        onAdd={(item) => {
          cart.addManual(item);
          toast.success(`${item.name} añadido al carrito.`);
        }}
      />

      <PosNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        note={cart.note}
        onSave={(n) => {
          cart.setNote(n);
          if (n) posAudit("note", n.slice(0, 60), auditCtx);
        }}
      />

      <PosCashDrawerDialog
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        registerName={session.registerName}
        cashierName={session.cashierName}
        session={cashSession}
        movements={movementsQuery.data ?? []}
        summary={summaryQuery.data ?? null}
        busy={openSession.isPending || cashMovement.isPending || closeSession.isPending}
        onOpenSession={async (p) => {
          if (!registerId) return toast.error("Selecciona una caja.");
          try {
            const r = await openSession.mutateAsync({
              registerId,
              openingRef: p.ref,
              openingBs: p.bs,
              cashierName: session.cashierName,
              note: p.note,
            });
            posAudit("open_register", `${session.registerName} · ${r.session_number}`, auditCtx);
            toast.success(r.already_open ? "Esta caja ya estaba abierta." : "Caja abierta.");
          } catch (e: any) {
            toast.error(e?.message ?? "No se pudo abrir la caja.");
          }
        }}
        onMovement={async (p) => {
          if (!cashSession) return;
          try {
            await cashMovement.mutateAsync({
              sessionId: cashSession.id,
              type: p.type,
              currency: p.currency,
              amount: p.amount,
              note: p.note,
              idempotencyKey: crypto.randomUUID(),
            });
            toast.success(
              p.type === "cash_in" ? "Entrada de efectivo registrada." : "Retiro de efectivo registrado."
            );
          } catch (e: any) {
            toast.error(e?.message ?? "No se pudo registrar el movimiento.");
          }
        }}
        onCloseSession={async (p) => {
          if (!cashSession) return;
          try {
            const r = await closeSession.mutateAsync({
              sessionId: cashSession.id,
              countedRef: p.countedRef,
              countedBs: p.countedBs,
              note: p.note,
            });
            posAudit("close_register", `${session.registerName} · ${cashSession.session_number}`, auditCtx);
            toast.success(
              `Caja cerrada. Diferencia REF ${r.difference_ref} · Bs. ${r.difference_bs}`
            );
            setDrawerOpen(false);
          } catch (e: any) {
            toast.error(e?.message ?? "No se pudo cerrar la caja.");
          }
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
        registers={registers}
        currentRegisterId={registerId}
        onSelect={(id) => {
          setRegisterId(id);
          setRegisterPickerOpen(false);
          posAudit("change_register", registers.find((r) => r.id === id)?.name ?? id, auditCtx);
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
        customer={customer}
        onSelectCustomer={setCustomer}
        invoiceNumber={invoiceNumber}
        setInvoiceNumber={setInvoiceNumber}
        onConfirm={confirmPayment}
        busy={registerSale.isPending}
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
                onViewInvoice={() =>
                  toast.info("Estás viendo la factura de la venta en esta misma pantalla.")
                }
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
