import { useEffect, useMemo, useState } from "react";
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
import { type PosSaleDocument } from "@/components/sublime/pos/PosReceiptPreview";
import { SaleReceiptActions, SaleReceiptBody } from "@/components/sublime/pos/SaleReceipt";
import { useSublimeSaleByNumber } from "@/hooks/useSublimeSalesHistory";
import { useLinkExchangeSale } from "@/hooks/useSublimeSaleReturns";
import { clearPendingExchange, getPendingExchange } from "@/lib/posExchange";
import { POS_BCV_RATE, usePosCart, type PosManualItem } from "@/components/sublime/pos/usePosCart";
import { useSublimePosCatalog } from "@/components/sublime/pos/useSublimePosCatalog";
import { useRegisterSublimePosSale } from "@/components/sublime/pos/useSublimePosSale";
import {
  useSetSuspendedCartStatus,
  useSublimeSuspendedCarts,
  useSuspendCart,
  type SuspendedCart,
} from "@/components/sublime/pos/useSublimeSuspendedCarts";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const linkExchange = useLinkExchangeSale();
  /** Cambio en curso: la nueva venta se enlazará con su devolución de origen. */
  const [pendingExchange, setPendingExchangeState] = useState(() => getPendingExchange());
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
  /** El comprobante se lee de la venta ya registrada, nunca del carrito. */
  const saleQuery = useSublimeSaleByNumber(doc?.number ?? null);
  const persistedSale = saleQuery.data ?? null;

  // Carritos suspendidos reales (servidor)
  const suspendedQuery = useSublimeSuspendedCarts();
  const suspendCart = useSuspendCart();
  const setCartStatus = useSetSuspendedCartStatus();
  /** Clave del intento de suspensión: el doble clic nunca crea dos carritos. */
  const [suspendKey, setSuspendKey] = useState(() => crypto.randomUUID());
  /** Carrito suspendido que se está cobrando ahora mismo. */
  const [resumedCartId, setResumedCartId] = useState<string | null>(null);
  const [resumeNotices, setResumeNotices] = useState<string[] | null>(null);


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
      if (resumedCartId) {
        try {
          await setCartStatus.mutateAsync({
            cartId: resumedCartId,
            status: "converted_to_sale",
            saleId: result.sale_id,
          });
        } catch {
          /* la venta ya está registrada: el carrito se concilia al recargar */
        }
      }
      if (pendingExchange) {
        try {
          await linkExchange.mutateAsync({
            returnId: pendingExchange.returnId,
            newSaleId: result.sale_id,
          });
          toast.success(`Cambio enlazado con la devolución ${pendingExchange.returnNumber}.`);
        } catch {
          toast.error("La venta quedó registrada, pero no se pudo enlazar el cambio.");
        }
        clearPendingExchange();
        setPendingExchangeState(null);
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
    setSuspendKey(crypto.randomUUID());
    setResumedCartId(null);
    cart.clear();
  };

  /** Suspender: guarda el carrito en el servidor. No toca stock ni ventas. */
  const doSuspend = async () => {
    if (suspendCart.isPending) return;
    if (cart.lines.length === 0) {
      toast.info("No hay carrito que suspender.");
      return;
    }
    try {
      const res = await suspendCart.mutateAsync({
        idempotencyKey: suspendKey,
        items: cart.lines.map((l) => ({
          line_kind: l.kind,
          product_id: l.product?.id ?? null,
          variant_id: l.variant?.id ?? null,
          sku: l.sku ?? null,
          title: l.title,
          subtitle: l.subtitle ?? null,
          qty: l.qty,
          unit_regular_ref: Number(l.regularPrice.toFixed(2)),
          unit_final_ref: Number(l.finalPrice.toFixed(2)),
          line_total_ref: Number(l.lineTotal.toFixed(2)),
        })),
        locationId: location?.id ?? null,
        registerId: registerId,
        registerCode: session.registerName,
        cashSessionId: cashSession?.id ?? null,
        sessionCode: session.sessionCode,
        cashierCode: session.cashierName,
        customer: customer ? { id: (customer as any).id || undefined, name: customer.name } : null,
        saleOrigin: cart.channel,
        originDetail: cart.channelDetail || null,
        note: cart.note || null,
        cartDiscountRef: cart.cartDiscount,
        cartDiscountReason: cart.cartDiscountReason || null,
      });
      posAudit("suspend", `Carrito ${res.cart_number}`, auditCtx);
      setCustomer(null);
      setResumedCartId(null);
      setSuspendKey(crypto.randomUUID());
      cart.clear();
      toast.success(
        res.duplicate
          ? `Este carrito ya estaba suspendido (${res.cart_number}).`
          : `Carrito ${res.cart_number} suspendido.`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo suspender el carrito.");
    }
  };

  /** Recuperar: revalida variante, precio y stock REAL en este momento. */
  const doResume = async (sc: SuspendedCart) => {
    const notices: string[] = [];
    const items: Record<string, number> = {};
    const manual: PosManualItem[] = [];

    for (const it of sc.items) {
      if (it.line_kind === "manual") {
        manual.push({
          id: `man-${it.id}`,
          name: it.title,
          kind: "producto",
          priceRef: it.unit_final_ref,
          qty: it.qty,
        });
        continue;
      }
      const entry = catalog.find((e) => e.variant.id === it.variant_id);
      if (!entry) {
        notices.push(`${it.title} (${it.sku ?? "sin SKU"}) ya no está disponible para vender.`);
        continue;
      }
      if (Math.abs(entry.finalPrice - it.unit_final_ref) > 0.009) {
        notices.push(
          `El precio de ${it.title} cambió desde que se suspendió. Antes REF ${it.unit_final_ref.toFixed(2)} · ahora REF ${entry.finalPrice.toFixed(2)}. Se usará el precio vigente.`
        );
      }
      const qty = Math.min(it.qty, entry.storeStock);
      if (qty <= 0) {
        notices.push(`Stock actualizado: ${it.title} ya no tiene unidades disponibles.`);
        continue;
      }
      if (qty < it.qty) {
        notices.push(
          `Stock actualizado: solicitadas ${it.qty}, disponibles ${qty} de ${it.title}. Se ajustó la cantidad.`
        );
      }
      items[entry.variant.id] = qty;
    }

    if (Object.keys(items).length === 0 && manual.length === 0) {
      toast.error("Este carrito ya no tiene productos disponibles.");
      setResumeNotices(notices.length ? notices : ["El carrito quedó vacío al revalidarlo."]);
      return;
    }

    cart.restore({
      items,
      manual,
      note: sc.note ?? "",
      cartDiscount: sc.cart_discount_ref,
      cartDiscountReason: sc.cart_discount_reason ?? "",
      channel: (sc.sale_origin as any) ?? null,
      channelDetail: sc.origin_detail ?? "",
    });
    setCustomer(
      sc.customer_id
        ? ({
            id: sc.customer_id,
            name: sc.customer_name ?? "Cliente",
            idCard: null,
            phone: null,
            email: null,
            birthDate: null,
            address: null,
          } as any)
        : null
    );
    setResumedCartId(sc.id);
    setAttemptKey(crypto.randomUUID());
    setSuspendedOpen(false);
    try {
      await setCartStatus.mutateAsync({ cartId: sc.id, status: "recovered" });
    } catch {
      /* la recuperación visual ya ocurrió */
    }
    posAudit("resume", `Carrito ${sc.cart_number}`, auditCtx);
    if (notices.length) setResumeNotices(notices);
    else toast.success(`Carrito ${sc.cart_number} recuperado.`);
  };

  const doCancelSuspended = async (sc: SuspendedCart) => {
    if (!window.confirm(`¿Cancelar el carrito ${sc.cart_number}? No se puede deshacer.`)) return;
    try {
      await setCartStatus.mutateAsync({ cartId: sc.id, status: "cancelled" });
      if (resumedCartId === sc.id) setResumedCartId(null);
      posAudit("void", `Carrito cancelado ${sc.cart_number}`, auditCtx);
      toast.success(`Carrito ${sc.cart_number} cancelado.`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cancelar el carrito.");
    }
  };

  const onFunction = (id: PosFunctionId, label: string) => {
    if (id === "closures") return setClosuresOpen(true);
    if (id === "manual_item") return setManualOpen(true);
    if (id === "note") return setNoteOpen(true);
    if (id === "cash") return setDrawerOpen(true);
    if (id === "suspend") return void doSuspend();
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
        carts={suspendedQuery.data ?? []}
        loading={suspendedQuery.isLoading}
        busy={setCartStatus.isPending}
        rate={session.rate}
        onResume={(sc) => void doResume(sc)}
        onCancelCart={(sc) => void doCancelSuspended(sc)}
      />

      <Dialog open={resumeNotices !== null} onOpenChange={(v) => !v && setResumeNotices(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Cambios desde que se suspendió
            </DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            {(resumeNotices ?? []).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <Button onClick={() => setResumeNotices(null)}>Entendido</Button>
        </DialogContent>
      </Dialog>

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
              {persistedSale ? (
                <>
                  <SaleReceiptBody sale={persistedSale} />
                  <SaleReceiptActions sale={persistedSale} phone={persistedSale.customer_phone}>
                    <Button onClick={newSale}>Nueva venta</Button>
                  </SaleReceiptActions>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Venta {doc.number} registrada. Cargando comprobante…
                  </p>
                  <Button onClick={newSale}>Nueva venta</Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
