import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useExtPoMutations, type PendingExternalEvent } from "@/hooks/useExternalPurchaseOrders";
import { formatCurrencySafe } from "@/lib/formatCurrency";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  events: PendingExternalEvent[];
  onCreated: () => void;
}

// overrides shape:
// { events: { [event_id]: { quantity_ordered, unit_cost, notes, supplier_name } },
//   suppliers: { [supplier_norm]: { supplier_name, shipping_cost, other_cost, currency, notes } } }

export function ExternalOrderPreviewDialog({ open, onOpenChange, events, onCreated }: Props) {
  const { createFromEvents } = useExtPoMutations();
  const [overrides, setOverrides] = useState<any>({ events: {}, suppliers: {} });
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) { setOverrides({ events: {}, suppliers: {} }); setPreview(null); }
  }, [open]);

  const eventIds = useMemo(() => events.map(e => e.id), [events]);

  const runPreview = async (overr: any) => {
    if (eventIds.length === 0) return;
    setLoading(true);
    try {
      const res = await createFromEvents.mutateAsync({ event_ids: eventIds, overrides: overr, dry_run: true });
      setPreview(res);
    } catch (e: any) {
      toast({ title: "Error en preview", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (open && eventIds.length > 0) runPreview(overrides);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventIds.length]);

  const setEventOverride = (evId: string, field: string, value: any) => {
    const next = { ...overrides, events: { ...overrides.events, [evId]: { ...(overrides.events[evId] ?? {}), [field]: value } } };
    setOverrides(next);
  };
  const setSupplierOverride = (norm: string, field: string, value: any) => {
    const next = { ...overrides, suppliers: { ...overrides.suppliers, [norm]: { ...(overrides.suppliers[norm] ?? {}), [field]: value } } };
    setOverrides(next);
  };

  const confirm = async () => {
    setConfirming(true);
    try {
      const res = await createFromEvents.mutateAsync({ event_ids: eventIds, overrides, dry_run: false });
      toast({ title: "Órdenes creadas", description: `${(res?.orders ?? []).length} orden(es) en borrador.` });
      onCreated();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setConfirming(false); }
  };

  const orders: any[] = preview?.orders ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview de orden externa</DialogTitle>
          <DialogDescription>
            Se agrupa por proveedor. El backend recalcula todos los subtotales.
          </DialogDescription>
        </DialogHeader>

        {loading && <div className="py-6 flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Recalculando…</div>}

        {orders.map((ord: any, idx: number) => (
          <Card key={idx} className="p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Proveedor</label>
                <Input
                  defaultValue={ord.supplier_name}
                  onBlur={e => {
                    setSupplierOverride(ord.supplier_normalized, "supplier_name", e.target.value);
                    runPreview({ ...overrides, suppliers: { ...overrides.suppliers, [ord.supplier_normalized]: { ...(overrides.suppliers[ord.supplier_normalized] ?? {}), supplier_name: e.target.value } } });
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Envío</label>
                <Input type="number" step="0.01" defaultValue={ord.shipping_cost}
                  onBlur={e => { setSupplierOverride(ord.supplier_normalized, "shipping_cost", Number(e.target.value) || 0); runPreview({ ...overrides, suppliers: { ...overrides.suppliers, [ord.supplier_normalized]: { ...(overrides.suppliers[ord.supplier_normalized] ?? {}), shipping_cost: Number(e.target.value) || 0 } } }); }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Otros costos</label>
                <Input type="number" step="0.01" defaultValue={ord.other_cost}
                  onBlur={e => { setSupplierOverride(ord.supplier_normalized, "other_cost", Number(e.target.value) || 0); runPreview({ ...overrides, suppliers: { ...overrides.suppliers, [ord.supplier_normalized]: { ...(overrides.suppliers[ord.supplier_normalized] ?? {}), other_cost: Number(e.target.value) || 0 } } }); }} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-2 py-1">Producto</th>
                    <th className="px-2 py-1 w-24">Cantidad</th>
                    <th className="px-2 py-1 w-28">Costo unit.</th>
                    <th className="px-2 py-1 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(ord.lines ?? []).map((l: any) => (
                    <tr key={l.policy_event_id} className="border-t">
                      <td className="px-2 py-1">
                        <div>{l.product_name_snapshot ?? l.core_product_id ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{l.variant_label_snapshot ?? l.core_variant_id ?? ""}</div>
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" step="1" defaultValue={l.quantity_ordered}
                          onBlur={e => { const v = Number(e.target.value) || 0; setEventOverride(l.policy_event_id, "quantity_ordered", v); runPreview({ ...overrides, events: { ...overrides.events, [l.policy_event_id]: { ...(overrides.events[l.policy_event_id] ?? {}), quantity_ordered: v } } }); }} />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" step="0.01" defaultValue={l.unit_cost}
                          onBlur={e => { const v = Number(e.target.value) || 0; setEventOverride(l.policy_event_id, "unit_cost", v); runPreview({ ...overrides, events: { ...overrides.events, [l.policy_event_id]: { ...(overrides.events[l.policy_event_id] ?? {}), unit_cost: v } } }); }} />
                      </td>
                      <td className="px-2 py-1 text-right">{formatCurrencySafe(Number(l.line_subtotal), ord.currency, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Notas</label>
              <Textarea rows={2} defaultValue={ord.notes ?? ""}
                onBlur={e => setSupplierOverride(ord.supplier_normalized, "notes", e.target.value)} />
            </div>

            <div className="flex justify-end gap-6 text-sm">
              <div>Subtotal: <b>{formatCurrencySafe(Number(ord.subtotal), ord.currency, { minimumFractionDigits: 2 })}</b></div>
              <div>Envío: <b>{formatCurrencySafe(Number(ord.shipping_cost), ord.currency, { minimumFractionDigits: 2 })}</b></div>
              <div>Otros: <b>{formatCurrencySafe(Number(ord.other_cost), ord.currency, { minimumFractionDigits: 2 })}</b></div>
              <div className="text-base">Total: <b>{formatCurrencySafe(Number(ord.total), ord.currency, { minimumFractionDigits: 2 })}</b></div>
            </div>
          </Card>
        ))}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={confirming || loading || orders.length === 0}>
            {confirming && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Crear {orders.length} orden(es) borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
