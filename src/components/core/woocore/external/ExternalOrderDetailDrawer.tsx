import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useExternalPurchaseOrders,
  useExternalPurchaseOrderLines,
  useExtPoMutations,
} from "@/hooks/useExternalPurchaseOrders";
import { formatCurrencySafe } from "@/lib/formatCurrency";
import { ExternalOrderReceiveDialog } from "./ExternalOrderReceiveDialog";

interface Props { orderId: string | null; onClose: () => void; }

export function ExternalOrderDetailDrawer({ orderId, onClose }: Props) {
  const { data: orders = [] } = useExternalPurchaseOrders();
  const order = useMemo(() => orders.find(o => o.id === orderId) ?? null, [orders, orderId]);
  const { data: lines = [] } = useExternalPurchaseOrderLines(orderId);
  const m = useExtPoMutations();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [orderedRef, setOrderedRef] = useState("");
  const [orderedEta, setOrderedEta] = useState("");
  const [payment, setPayment] = useState<string>("");

  if (!order) return null;
  const isDraft = order.status === "draft";
  const canReceive = order.status === "ordered" || order.status === "partially_received";

  // Draft edit local state
  const [header, setHeader] = useState<any>({});
  const [lineEdits, setLineEdits] = useState<Record<string, any>>({});

  const saveDraft = async () => {
    const linesPayload = Object.entries(lineEdits).map(([line_id, patch]) => ({ line_id, ...patch }));
    try {
      await m.updateDraft.mutateAsync({ order_id: order.id, header, lines: linesPayload });
      toast({ title: "Borrador guardado" });
      setHeader({}); setLineEdits({});
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const doAction = async (fn: () => Promise<any>, label: string) => {
    try { await fn(); toast({ title: label }); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <Sheet open={!!orderId} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{order.order_number} · <Badge variant="secondary">{order.status}</Badge></SheetTitle>
          <SheetDescription>{order.supplier_name_snapshot}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {isDraft ? (
            <Card className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs">Proveedor</label>
                  <Input defaultValue={order.supplier_name_snapshot} onBlur={e => setHeader({ ...header, supplier_name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs">Ref. proveedor</label>
                  <Input defaultValue={order.supplier_order_reference ?? ""} onBlur={e => setHeader({ ...header, supplier_order_reference: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs">Envío</label>
                  <Input type="number" step="0.01" defaultValue={order.shipping_cost} onBlur={e => setHeader({ ...header, shipping_cost: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs">Otros costos</label>
                  <Input type="number" step="0.01" defaultValue={order.other_cost} onBlur={e => setHeader({ ...header, other_cost: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs">ETA</label>
                  <Input type="date" defaultValue={order.estimated_delivery_date ?? ""} onBlur={e => setHeader({ ...header, estimated_delivery_date: e.target.value || null })} />
                </div>
              </div>
              <Textarea rows={2} placeholder="Notas" defaultValue={order.notes ?? ""} onBlur={e => setHeader({ ...header, notes: e.target.value })} />
            </Card>
          ) : (
            <Card className="p-3 text-sm space-y-1">
              <div>Ref. proveedor: <b>{order.supplier_order_reference ?? "—"}</b></div>
              <div>ETA: <b>{order.estimated_delivery_date ?? "—"}</b></div>
              {order.notes && <div className="text-muted-foreground whitespace-pre-line">{order.notes}</div>}
            </Card>
          )}

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-2 py-1">Producto</th>
                  <th className="px-2 py-1 w-20">Ped.</th>
                  <th className="px-2 py-1 w-20">Recib.</th>
                  <th className="px-2 py-1 w-24">Costo</th>
                  <th className="px-2 py-1 text-right">Subtotal</th>
                  <th className="px-2 py-1">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id} className={`border-t ${l.status === "cancelled" ? "opacity-50" : ""}`}>
                    <td className="px-2 py-1">
                      <div>{l.product_name_snapshot ?? l.core_product_id ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{l.variant_label_snapshot ?? l.core_variant_id ?? ""}</div>
                    </td>
                    <td className="px-2 py-1">
                      {isDraft ? (
                        <Input type="number" step="1" defaultValue={l.quantity_ordered}
                          onBlur={e => setLineEdits({ ...lineEdits, [l.id]: { ...(lineEdits[l.id] ?? {}), quantity_ordered: Number(e.target.value) || 0 } })} />
                      ) : l.quantity_ordered}
                    </td>
                    <td className="px-2 py-1">{l.quantity_received}</td>
                    <td className="px-2 py-1">
                      {isDraft ? (
                        <Input type="number" step="0.01" defaultValue={l.unit_cost}
                          onBlur={e => setLineEdits({ ...lineEdits, [l.id]: { ...(lineEdits[l.id] ?? {}), unit_cost: Number(e.target.value) || 0 } })} />
                      ) : formatCurrencySafe(l.unit_cost, order.currency, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1 text-right">{formatCurrencySafe(l.line_subtotal, order.currency, { minimumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1"><Badge variant="secondary">{l.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="flex justify-end gap-4 text-sm">
            <div>Subtotal: <b>{formatCurrencySafe(order.subtotal, order.currency, { minimumFractionDigits: 2 })}</b></div>
            <div>Total: <b>{formatCurrencySafe(order.total, order.currency, { minimumFractionDigits: 2 })}</b></div>
            <div>Pagado: <b>{formatCurrencySafe(order.amount_paid, order.currency, { minimumFractionDigits: 2 })}</b></div>
            <div>Pendiente: <b>{formatCurrencySafe(order.balance_due, order.currency, { minimumFractionDigits: 2 })}</b></div>
          </div>

          {/* Actions */}
          <Card className="p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {isDraft && (
                <>
                  <Button size="sm" onClick={saveDraft} disabled={m.updateDraft.isPending}>Guardar borrador</Button>
                  <Button size="sm" onClick={() => doAction(() => m.approve.mutateAsync(order.id), "Aprobada")}>Aprobar</Button>
                </>
              )}
              {order.status === "approved" && (
                <div className="flex flex-wrap gap-2 items-end w-full">
                  <div className="flex-1"><label className="text-xs">Referencia proveedor</label><Input value={orderedRef} onChange={e => setOrderedRef(e.target.value)} /></div>
                  <div><label className="text-xs">ETA</label><Input type="date" value={orderedEta} onChange={e => setOrderedEta(e.target.value)} /></div>
                  <Button size="sm" onClick={() => doAction(() => m.markOrdered.mutateAsync({ order_id: order.id, reference: orderedRef || undefined, eta: orderedEta || undefined }), "Marcada como pedida")}>Marcar pedida</Button>
                </div>
              )}
              {canReceive && (
                <Button size="sm" onClick={() => setReceiveOpen(true)}>Registrar recepción</Button>
              )}
              {order.status === "cancelled" && (
                <Button size="sm" variant="outline" onClick={() => doAction(() => m.reopen.mutateAsync(order.id), "Reabierta")}>Reabrir como borrador</Button>
              )}
              {order.status === "received" && (
                <Button size="sm" variant="outline" disabled title="Próxima fase">Registrar entrada en inventario</Button>
              )}
            </div>

            {!["cancelled","received"].includes(order.status) && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs">Motivo de cancelación</label>
                  <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Requerido" />
                </div>
                <Button size="sm" variant="destructive" disabled={!cancelReason.trim()}
                  onClick={() => doAction(() => m.cancel.mutateAsync({ order_id: order.id, reason: cancelReason }), "Cancelada")}>Cancelar</Button>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs">Actualizar monto pagado</label>
                <Input type="number" step="0.01" value={payment} onChange={e => setPayment(e.target.value)} placeholder={String(order.amount_paid)} />
              </div>
              <Button size="sm" variant="outline" disabled={!payment}
                onClick={() => doAction(() => m.updatePayment.mutateAsync({ order_id: order.id, amount_paid: Number(payment) || 0 }), "Pago actualizado")}>Guardar pago</Button>
            </div>
          </Card>
        </div>

        <ExternalOrderReceiveDialog open={receiveOpen} onOpenChange={setReceiveOpen} orderId={order.id} lines={lines} currency={order.currency} />
      </SheetContent>
    </Sheet>
  );
}
