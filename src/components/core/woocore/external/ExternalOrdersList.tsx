import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye } from "lucide-react";
import { useExternalPurchaseOrders, type ExternalPurchaseOrder } from "@/hooks/useExternalPurchaseOrders";
import { formatCurrencySafe } from "@/lib/formatCurrency";
import { ExternalOrderDetailDrawer } from "./ExternalOrderDetailDrawer";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  approved: "Aprobada",
  ordered: "Pedida",
  partially_received: "Parcial",
  received: "Recibida",
  cancelled: "Cancelada",
};

export function ExternalOrdersList({ initialStatus = "all" }: { initialStatus?: string }) {
  const [status, setStatus] = useState(initialStatus);
  const { data: orders = [], isLoading } = useExternalPurchaseOrders(status);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-2 py-2">Nº</th>
                <th className="px-2 py-2">Proveedor</th>
                <th className="px-2 py-2">Estado</th>
                <th className="px-2 py-2 text-right">Subtotal</th>
                <th className="px-2 py-2 text-right">Envío</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2 text-right">Pagado</th>
                <th className="px-2 py-2 text-right">Pendiente</th>
                <th className="px-2 py-2">ETA</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={10} className="text-center py-6 text-muted-foreground">Sin órdenes.</td></tr>}
              {orders.map((o: ExternalPurchaseOrder) => (
                <tr key={o.id} className="border-t hover:bg-muted/20">
                  <td className="px-2 py-2 font-mono">{o.order_number}</td>
                  <td className="px-2 py-2">{o.supplier_name_snapshot}</td>
                  <td className="px-2 py-2"><Badge variant="secondary">{STATUS_LABELS[o.status] ?? o.status}</Badge></td>
                  <td className="px-2 py-2 text-right">{formatCurrencySafe(o.subtotal, o.currency, { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-right">{formatCurrencySafe(o.shipping_cost, o.currency, { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-right"><b>{formatCurrencySafe(o.total, o.currency, { minimumFractionDigits: 2 })}</b></td>
                  <td className="px-2 py-2 text-right">{formatCurrencySafe(o.amount_paid, o.currency, { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-right">{formatCurrencySafe(o.balance_due, o.currency, { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-xs">{o.estimated_delivery_date ?? "—"}</td>
                  <td className="px-2 py-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedId(o.id)}><Eye className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ExternalOrderDetailDrawer orderId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
