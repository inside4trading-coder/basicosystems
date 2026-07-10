import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useExtPoMutations, type ExternalPurchaseOrderLine } from "@/hooks/useExternalPurchaseOrders";
import { formatCurrencySafe } from "@/lib/formatCurrency";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  lines: ExternalPurchaseOrderLine[];
  currency: string;
}

export function ExternalOrderReceiveDialog({ open, onOpenChange, orderId, lines, currency }: Props) {
  const { receive } = useExtPoMutations();
  const active = useMemo(() => lines.filter(l => l.status !== "cancelled" && l.status !== "received"), [lines]);
  const [qty, setQty] = useState<Record<string, string>>({});

  const submit = async () => {
    const payload = Object.entries(qty)
      .map(([line_id, v]) => ({ line_id, qty_now: Number(v) || 0 }))
      .filter(x => x.qty_now > 0);
    if (payload.length === 0) { toast({ title: "Ingresa al menos una cantidad", variant: "destructive" }); return; }
    try {
      await receive.mutateAsync({ order_id: orderId, lines: payload });
      toast({ title: "Recepción registrada" });
      setQty({});
      onOpenChange(false);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Registrar recepción</DialogTitle></DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-2 py-1">Producto</th>
                <th className="px-2 py-1 text-right">Pedida</th>
                <th className="px-2 py-1 text-right">Recibida</th>
                <th className="px-2 py-1 text-right">Pendiente</th>
                <th className="px-2 py-1 w-28">Recibir ahora</th>
              </tr>
            </thead>
            <tbody>
              {active.map(l => {
                const pending = Number(l.quantity_ordered) - Number(l.quantity_received);
                return (
                  <tr key={l.id} className="border-t">
                    <td className="px-2 py-1">{l.product_name_snapshot ?? l.core_product_id ?? "—"}</td>
                    <td className="px-2 py-1 text-right">{l.quantity_ordered}</td>
                    <td className="px-2 py-1 text-right">{l.quantity_received}</td>
                    <td className="px-2 py-1 text-right">{pending}</td>
                    <td className="px-2 py-1">
                      <Input type="number" step="1" min="0" max={pending}
                        value={qty[l.id] ?? ""} onChange={e => setQty({ ...qty, [l.id]: e.target.value })} />
                    </td>
                  </tr>
                );
              })}
              {active.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Sin líneas pendientes.</td></tr>}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={submit} disabled={receive.isPending}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
