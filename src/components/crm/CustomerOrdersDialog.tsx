import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Package, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDMY } from "@/lib/dateUtils";

interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  billing_company: string;
  billing_city: string;
  billing_country: string;
  billing_phone: string;
  orders_count: number;
  total_spent: string;
  date_created: string;
}

interface Order {
  order_id: number;
  order_number: string | null;
  order_status: string | null;
  total_amount: number | null;
  total_amount_usd: number | null;
  order_currency: string | null;
  exchange_rate: number | null;
  order_datetime: string | null;
  payment_method: string | null;
  billing_name: string | null;
}

const statusLabel: Record<string, string> = {
  completed: "Completado",
  processing: "Procesando",
  "on-hold": "En espera",
  pending: "Pendiente",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  failed: "Fallido",
  "pedido-listo-para": "Listo para envío",
  "pedido-recibido-p": "Recibido",
  "tu-pago-fue-confi": "Pago confirmado",
  "tu-pedido-ha-sido": "Enviado",
};

const statusClass: Record<string, string> = {
  completed: "status-badge-success",
  processing: "status-badge-inactive",
  "on-hold": "status-badge-warning",
  pending: "status-badge-warning",
  cancelled: "status-badge-error",
  refunded: "status-badge-error",
  "pedido-listo-para": "status-badge-success",
  "tu-pago-fue-confi": "status-badge-success",
  "tu-pedido-ha-sido": "status-badge-success",
};

interface Props {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerOrdersDialog({ customer, open, onOpenChange }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !customer?.email) return;
    setLoading(true);
    supabase
      .from("orders")
      .select("order_id, order_number, order_status, total_amount, total_amount_usd, order_currency, exchange_rate, order_datetime, payment_method, billing_name")
      .eq("customer_email", customer.email)
      .order("order_datetime", { ascending: false })
      .then(({ data }) => {
        setOrders(data || []);
        setLoading(false);
      });
  }, [open, customer?.email]);

  if (!customer) return null;

  const name = (customer.first_name || customer.last_name)
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : customer.username || "Sin nombre";

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
  const toUsd = (o: Order) => {
    if (o.total_amount_usd) return o.total_amount_usd;
    const val = Number(o.total_amount || 0);
    if ((o.order_currency || "USD") === "USD") return val;
    const rate = Number(o.exchange_rate || 0);
    return rate > 0 ? val / rate : val;
  };
  const fmtDate = (d: string | null) =>
    d ? formatDMY(d) : "—";

  const totalUsd = orders.reduce((sum, o) => sum + toUsd(o), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">{name}</DialogTitle>
          <DialogDescription className="sr-only">Historial de pedidos del cliente</DialogDescription>
        </DialogHeader>

        {/* Customer info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{customer.email}</span>
          </div>
          {customer.billing_phone && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{customer.billing_phone}</span>
            </div>
          )}
          {customer.billing_city && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{customer.billing_city}, {customer.billing_country}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{fmtDate(customer.date_created)}</span>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex gap-3 mt-1">
          <div className="bg-muted rounded-lg px-3 py-2 text-center flex-1">
            <div className="text-lg font-black">{orders.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Pedidos</div>
          </div>
          <div className="bg-muted rounded-lg px-3 py-2 text-center flex-1">
            <div className="text-lg font-black">{fmt(totalUsd)}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total gastado</div>
          </div>
          {customer.billing_company && (
            <div className="bg-muted rounded-lg px-3 py-2 text-center flex-1">
              <div className="text-sm font-bold truncate">{customer.billing_company}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Empresa</div>
            </div>
          )}
        </div>

        {/* Orders list */}
        <div className="flex-1 overflow-y-auto mt-2 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No hay pedidos sincronizados para este cliente
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Nº</th>
                  <th className="text-left py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</th>
                  <th className="text-right py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</th>
                  <th className="text-left py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Pago</th>
                  <th className="text-right py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_id} className="border-b border-border last:border-0">
                    <td className="py-2.5 font-bold">#{o.order_number}</td>
                    <td className="py-2.5">
                      <span className={statusClass[o.order_status || ""] || "status-badge-inactive"}>
                        {statusLabel[o.order_status || ""] || o.order_status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{fmt(toUsd(o))}</td>
                    <td className="py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{o.payment_method || "—"}</td>
                    <td className="py-2.5 text-right text-muted-foreground text-xs whitespace-nowrap">{fmtDate(o.order_datetime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
