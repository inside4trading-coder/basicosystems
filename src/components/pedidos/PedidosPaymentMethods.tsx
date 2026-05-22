import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2, ExternalLink, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERIOD_OPTIONS, periodBounds, type PeriodKey, CUTOFF } from "./periodFilters";
import { isExcludedFromRevenue } from "@/config/orderStatuses";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type OrderRow = {
  order_id: number;
  order_number: string | null;
  customer_email: string | null;
  order_status: string | null;
  order_date: string | null;
  order_datetime: string | null;
  total_amount: number | null;
  total_amount_usd: number | null;
  exchange_rate: number | null;
  order_currency: string | null;
  pago_metodo_1: string | null;
  pago_metodo_2: string | null;
  pago_metodo_3: string | null;
  pago_metodo_4: string | null;
};

type PaymentRow = {
  order_id: number;
  payment_slot: number | null;
  payment_method: string | null;
  payment_amount: number | null;
  payment_currency: string | null;
};

const statusClass: Record<string, string> = {
  completed: "status-badge-success",
  processing: "status-badge-inactive",
  "on-hold": "status-badge-warning",
  pending: "status-badge-warning",
  cancelled: "status-badge-error",
  refunded: "status-badge-error",
  failed: "status-badge-error",
  "pedido-listo-para": "status-badge-success",
  "pedido-recibido-p": "status-badge-inactive",
  "tu-pago-fue-confi": "status-badge-success",
  "tu-pedido-ha-sido": "status-badge-success",
};

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

const ALLOWED_METHODS = new Set([
  "Pago Movil",
  "Pago Móvil",
  "Punto de venta",
  "Punto de venta (Bs)",
  "Cashea",
  "Efectivo USD",
  "Zelle",
  "Binance",
  "PayPal",
]);

const NORMALIZE: Record<string, string> = {
  "Pago Móvil": "Pago Movil",
  "Punto de venta (Bs)": "Punto de venta",
};

const METHOD_COLORS: Record<string, string> = {
  "Pago Movil": "hsl(0 75% 55%)",
  Cashea: "hsl(150 60% 45%)",
  "Punto de venta": "hsl(45 90% 55%)",
  "Efectivo USD": "hsl(195 70% 50%)",
  Binance: "hsl(280 60% 60%)",
  PayPal: "hsl(220 70% 55%)",
  Zelle: "hsl(170 55% 45%)",
};

const fallbackPalette = [
  "hsl(var(--primary))",
  "hsl(330 65% 55%)",
  "hsl(35 90% 55%)",
  "hsl(0 70% 55%)",
];

function methodColor(name: string): string {
  if (METHOD_COLORS[name]) return METHOD_COLORS[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return fallbackPalette[h % fallbackPalette.length];
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "";

const MAX_REASONABLE_USD = 4000;

function normalizeMethod(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!ALLOWED_METHODS.has(raw)) return null;
  return NORMALIZE[raw] || raw;
}

export function PedidosPaymentMethods() {
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMethods, setOpenMethods] = useState<Record<string, boolean>>({});

  const { from, to } = useMemo(() => periodBounds(period), [period]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const effectiveFrom = from < CUTOFF ? CUTOFF : from;
    const all: OrderRow[] = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "order_id, order_number, customer_email, order_status, order_date, order_datetime, total_amount, total_amount_usd, exchange_rate, order_currency, pago_metodo_1, pago_metodo_2, pago_metodo_3, pago_metodo_4",
        )
        .gte("order_date", effectiveFrom)
        .lte("order_date", to)
        .order("order_date", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (error) break;
      const chunk = (data || []) as OrderRow[];
      all.push(...chunk);
      if (chunk.length < PAGE) break;
      offset += PAGE;
    }
    setOrders(all);

    // Fetch payments for those order ids in batches
    const ids = all.map((o) => o.order_id);
    const allPayments: PaymentRow[] = [];
    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      if (slice.length === 0) break;
      const { data, error } = await supabase
        .from("payments")
        .select("order_id, payment_slot, payment_method, payment_amount, payment_currency")
        .in("order_id", slice);
      if (error) break;
      allPayments.push(...((data || []) as PaymentRow[]));
    }
    setPayments(allPayments);
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const orderById = useMemo(() => {
    const m = new Map<number, OrderRow>();
    for (const o of orders) m.set(o.order_id, o);
    return m;
  }, [orders]);

  const orderTotalUsd = useCallback((o: OrderRow) => {
    const usd = Number(o.total_amount_usd ?? 0);
    if (usd > 0) return usd;
    const amt = Number(o.total_amount ?? 0);
    if ((o.order_currency || "USD") === "USD") return amt;
    const rate = Number(o.exchange_rate || 0);
    return rate > 0 ? amt / rate : amt;
  }, []);

  const paymentToUsd = useCallback(
    (p: PaymentRow): number => {
      const amt = Number(p.payment_amount ?? 0);
      if (amt <= 0) return 0;
      const cur = (p.payment_currency || "USD").toUpperCase();
      if (cur === "USD") return amt;
      const order = orderById.get(p.order_id);
      const rate = Number(order?.exchange_rate || 0);
      return rate > 0 ? amt / rate : 0;
    },
    [orderById],
  );

  // per-(order, method) -> usd paid with that method
  const perOrderMethodUsd = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) {
      const method = normalizeMethod(p.payment_method);
      if (!method) continue;
      const order = orderById.get(p.order_id);
      if (!order) continue;
      if (isExcludedFromRevenue(order.order_status || "")) continue;
      const usd = paymentToUsd(p);
      if (usd <= 0 || usd > MAX_REASONABLE_USD) continue;
      const k = `${p.order_id}::${method}`;
      m.set(k, (m.get(k) || 0) + usd);
    }
    return m;
  }, [payments, orderById, paymentToUsd]);

  const { grouped, totalCobradoUsd, transactionsAnalyzed } = useMemo(() => {
    const paid = orders.filter((o) => !isExcludedFromRevenue(o.order_status || ""));
    const map = new Map<
      string,
      { orders: OrderRow[]; totalUsd: number; seen: Set<number> }
    >();

    // Seed with methods from pago_metodo_N slots (presence-based)
    for (const o of paid) {
      const slots = [o.pago_metodo_1, o.pago_metodo_2, o.pago_metodo_3, o.pago_metodo_4];
      const seenInOrder = new Set<string>();
      for (const raw of slots) {
        const label = normalizeMethod(raw);
        if (!label) continue;
        if (seenInOrder.has(label)) continue;
        seenInOrder.add(label);
        if (!map.has(label)) map.set(label, { orders: [], totalUsd: 0, seen: new Set() });
        const entry = map.get(label)!;
        if (!entry.seen.has(o.order_id)) {
          entry.seen.add(o.order_id);
          entry.orders.push(o);
        }
      }
    }

    // Add USD amounts from payments table
    let total = 0;
    for (const [k, usd] of perOrderMethodUsd) {
      const [, method] = k.split("::");
      if (!map.has(method)) map.set(method, { orders: [], totalUsd: 0, seen: new Set() });
      const entry = map.get(method)!;
      entry.totalUsd += usd;
      total += usd;
      // ensure order is listed under this method even if pago_metodo_N missed it
      const orderId = Number(k.split("::")[0]);
      if (!entry.seen.has(orderId)) {
        const o = orderById.get(orderId);
        if (o) {
          entry.seen.add(orderId);
          entry.orders.push(o);
        }
      }
    }

    const arr = Array.from(map.entries())
      .map(([method, v]) => ({ method, orders: v.orders, totalUsd: v.totalUsd }))
      .sort((a, b) => b.totalUsd - a.totalUsd || b.orders.length - a.orders.length);

    return { grouped: arr, totalCobradoUsd: total, transactionsAnalyzed: paid.length };
  }, [orders, perOrderMethodUsd, orderById]);

  const pieData = useMemo(
    () =>
      grouped
        .filter((g) => g.totalUsd > 0)
        .map((g) => ({
          name: g.method,
          value: g.totalUsd,
          orders: g.orders.length,
          color: methodColor(g.method),
        })),
    [grouped],
  );

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {PERIOD_OPTIONS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors",
              period === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Transacciones analizadas
              </p>
              <p className="text-2xl font-black mt-1 tabular-nums">{transactionsAnalyzed}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total cobrado (USD)
              </p>
              <p className="text-2xl font-black mt-1 tabular-nums">{fmtUsd(totalCobradoUsd)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Métodos usados
              </p>
              <p className="text-2xl font-black mt-1 tabular-nums">{grouped.length}</p>
            </div>
          </div>

          {/* Method buckets */}
          <div className="space-y-2">
            {grouped.length === 0 && (
              <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
                No hay pagos en el período seleccionado.
              </div>
            )}
            {grouped.map((g) => {
              const pct = totalCobradoUsd ? (g.totalUsd / totalCobradoUsd) * 100 : 0;
              const color = methodColor(g.method);
              const open = !!openMethods[g.method];
              return (
                <Collapsible
                  key={g.method}
                  open={open}
                  onOpenChange={(v) => setOpenMethods((prev) => ({ ...prev, [g.method]: v }))}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  <CollapsibleTrigger className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-bold text-sm truncate">{g.method}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.orders.length} pedidos · {pct.toFixed(1)}% del cobrado
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="font-bold text-sm tabular-nums">{fmtUsd(g.totalUsd)}</p>
                      <p className="text-xs text-muted-foreground">cobrado por método</p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                        open && "rotate-180",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <th className="text-left px-4 py-2">Nº</th>
                            <th className="text-left px-4 py-2">Cliente</th>
                            <th className="text-left px-4 py-2">Pagado c/método</th>
                            <th className="text-left px-4 py-2">Total pedido</th>
                            <th className="text-left px-4 py-2">Estado</th>
                            <th className="text-left px-4 py-2 hidden md:table-cell">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.orders.slice(0, 200).map((o) => {
                            const paidWith = perOrderMethodUsd.get(`${o.order_id}::${g.method}`) || 0;
                            return (
                              <tr key={o.order_id} className="border-t border-border">
                                <td className="px-4 py-2 font-bold">
                                  <div className="flex items-center gap-1.5">
                                    <span>#{o.order_number}</span>
                                    <a
                                      href={`https://basicoclothes.com/wp-admin/post.php?post=${o.order_id}&action=edit`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-muted-foreground hover:text-primary transition-colors"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-xs">{o.customer_email || "—"}</td>
                                <td className="px-4 py-2 font-semibold tabular-nums">
                                  {paidWith > 0 ? fmtUsd(paidWith) : "—"}
                                </td>
                                <td className="px-4 py-2 tabular-nums text-muted-foreground">
                                  {fmtUsd(orderTotalUsd(o))}
                                </td>
                                <td className="px-4 py-2">
                                  <span
                                    className={
                                      statusClass[o.order_status || ""] || "status-badge-inactive"
                                    }
                                  >
                                    {statusLabel[o.order_status || ""] || o.order_status || "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-xs text-muted-foreground hidden md:table-cell">
                                  {fmtDate(o.order_datetime)}
                                </td>
                              </tr>
                            );
                          })}
                          {g.orders.length > 200 && (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-4 py-2 text-xs text-center text-muted-foreground"
                              >
                                Mostrando 200 de {g.orders.length} pedidos.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>

          {/* Pie chart */}
          {pieData.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-bold mb-3">Distribución real por método (USD cobrado)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={(e: any) => `${e.name} ${((e.percent || 0) * 100).toFixed(1)}%`}
                    >
                      {pieData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, _name: any, item: any) => [
                        `${fmtUsd(Number(value))} · ${item?.payload?.orders ?? 0} pedidos`,
                        item?.payload?.name,
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
