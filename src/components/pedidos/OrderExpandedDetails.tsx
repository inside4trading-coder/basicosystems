import { Loader2, Mail, Phone, MapPin, CreditCard, Truck, MessageSquare } from "lucide-react";

interface OrderExpandedDetailsProps {
  order: any;
  items: any[] | undefined;
  fmt: (n: number) => string;
  toUsd: (amount: number | null | undefined, order: any) => number;
}

export function OrderExpandedDetails({ order, items, fmt, toUsd }: OrderExpandedDetailsProps) {
  const o = order;

  return (
    <div className="space-y-4">
      {/* Billing + Shipping + Meta grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Billing Details */}
        <div className="bg-card rounded-lg border border-border p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Datos de facturación</h4>
          {o.billing_name && <p className="text-sm font-semibold">{o.billing_name}</p>}
          {o.billing_address && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{[o.billing_address, o.billing_city, o.billing_state, o.billing_country].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {o.customer_email && (
            <div className="flex items-center gap-1.5 text-xs">
              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
              <a href={`mailto:${o.customer_email}`} className="text-primary hover:underline">{o.customer_email}</a>
            </div>
          )}
          {o.customer_phone && (
            <div className="flex items-center gap-1.5 text-xs">
              <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
              <a href={`tel:${o.customer_phone}`} className="text-primary hover:underline">{o.customer_phone}</a>
            </div>
          )}
          {o.payment_method && (
            <div className="flex items-center gap-1.5 text-xs">
              <CreditCard className="h-3 w-3 text-muted-foreground shrink-0" />
              <span>{o.payment_method}</span>
            </div>
          )}
        </div>

        {/* Shipping Details */}
        <div className="bg-card rounded-lg border border-border p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Datos de envío</h4>
          {o.shipping_name && <p className="text-sm font-semibold">{o.shipping_name}</p>}
          {o.shipping_address && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{[o.shipping_address, o.shipping_city, o.shipping_country].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {o.shipping_method && (
            <div className="flex items-center gap-1.5 text-xs">
              <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
              <span>{o.shipping_method}</span>
            </div>
          )}
          {!o.shipping_name && !o.shipping_address && !o.shipping_method && (
            <p className="text-xs text-muted-foreground italic">Sin datos de envío</p>
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-card rounded-lg border border-border p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Resumen</h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-semibold">{fmt(toUsd(o.subtotal_amount, o))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Descuento:</span><span className="font-semibold">{fmt(toUsd(o.discount_amount, o))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Envío:</span><span className="font-semibold">{fmt(toUsd(o.shipping_amount, o))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Impuestos:</span><span className="font-semibold">{fmt(toUsd(o.tax_amount, o))}</span></div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <span className="font-bold">Total:</span>
              <span className="font-bold">{fmt(o.total_amount_usd ?? toUsd(o.total_amount, o))}</span>
            </div>
            {o.order_currency !== "USD" && o.exchange_rate > 1 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Monto original:</span>
                <span>{o.order_currency} {Number(o.total_amount || 0).toLocaleString()}</span>
              </div>
            )}
          </div>
          {o.customer_note && (
            <div className="mt-2 pt-2 border-t border-border">
              <div className="flex items-start gap-1.5 text-xs">
                <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground italic">{o.customer_note}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      {items ? (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2 font-bold text-muted-foreground">Producto</th>
                <th className="text-left px-3 py-2 font-bold text-muted-foreground">SKU</th>
                <th className="text-left px-3 py-2 font-bold text-muted-foreground hidden sm:table-cell">Talla</th>
                <th className="text-left px-3 py-2 font-bold text-muted-foreground hidden sm:table-cell">Color</th>
                <th className="text-right px-3 py-2 font-bold text-muted-foreground">Cant</th>
                <th className="text-right px-3 py-2 font-bold text-muted-foreground">Total</th>
                <th className="text-left px-3 py-2 font-bold text-muted-foreground hidden md:table-cell">Categoría</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-border/30 last:border-0">
                  <td className="px-4 py-2 font-semibold">{item.product_name}</td>
                  <td className="px-3 py-2 text-muted-foreground font-mono text-[11px]">{item.sku || "—"}</td>
                  <td className="px-3 py-2 hidden sm:table-cell">{item.size || "—"}</td>
                  <td className="px-3 py-2 hidden sm:table-cell">{item.color || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(item.line_total)}</td>
                  <td className="px-3 py-2 capitalize hidden md:table-cell">{item.analytic_category || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground py-4">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando items…
        </div>
      )}
    </div>
  );
}
