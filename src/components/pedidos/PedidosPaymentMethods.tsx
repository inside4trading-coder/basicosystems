import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2, ExternalLink, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERIOD_OPTIONS, periodBounds, type PeriodKey, CUTOFF } from "./periodFilters";
import { isExcludedFromRevenue } from "@/config/orderStatuses";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatDMY } from "@/lib/dateUtils";
import { orderUsd, safeOrderUsd } from "@/lib/orderUsd";

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

// Misma lógica del Dashboard: contar apariciones en pago_metodo_1..4
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
  d ? formatDMY(d) : "";

export function PedidosPaymentMethods() {
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [orders, setOrders] = useState<OrderRow[]>([]);
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
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Conversión centralizada: VES sin tasa válida → 0 (no se contabiliza).
  const orderTotalUsd = useCallback((o: OrderRow) => orderUsd(o), []);

  const { grouped, totalAppearances, transactionsAnalyzed } = useMemo(() => {
    const paid = orders.filter((o) => !isExcludedFromRevenue(o.order_status || ""));
    const map = new Map<string, { orders: OrderRow[]; count: number; seen: Set<number> }>();
    let total = 0;

    for (const o of paid) {
      const slots = [o.pago_metodo_1, o.pago_metodo_2, o.pago_metodo_3, o.pago_metodo_4];
      for (const raw of slots) {
        if (!raw || !ALLOWED_METHODS.has(raw)) continue;
        const label = NORMALIZE[raw] || raw;
        if (!map.has(label)) map.set(label, { orders: [], count: 0, seen: new Set() });
        const entry = map.get(label)!;
        entry.count += 1;
        total += 1;
        if (!entry.seen.has(o.order_id)) {
          entry.seen.add(o.order_id);
          entry.orders.push(o);
        }
      }
    }

    const arr = Array.from(map.entries())
      .map(([method, v]) => ({ method, orders: v.orders, count: v.count }))
      .sort((a, b) => b.count - a.count);

    return { grouped: arr, totalAppearances: total, transactionsAnalyzed: paid.length };
  }, [orders]);

  const pieData = useMemo(
    () =>
      grouped
        .filter((g) => g.count > 0)
        .map((g) => ({
          name: g.method,
          value: g.count,
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
                Total apariciones
              </p>
              <p className="text-2xl font-black mt-1 tabular-nums">{totalAppearances}</p>
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
              const pct = totalAppearances ? (g.count / totalAppearances) * 100 : 0;
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
                        {g.orders.length} pedidos · {pct.toFixed(1)}% de apariciones
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="font-bold text-sm tabular-nums">{g.count}</p>
                      <p className="text-xs text-muted-foreground">transacciones</p>
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
                            <th className="text-left px-4 py-2">Total</th>
                            <th className="text-left px-4 py-2">Estado</th>
                            <th className="text-left px-4 py-2 hidden md:table-cell">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.orders.slice(0, 200).map((o) => (
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
                              <td className="px-4 py-2 tabular-nums">{fmtUsd(orderTotalUsd(o))}</td>
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
                          ))}
                          {g.orders.length > 200 && (
                            <tr>
                              <td
                                colSpan={5}
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
              <h3 className="text-sm font-bold mb-3">Distribución por método (transacciones)</h3>
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
                        `${value} transacciones · ${item?.payload?.orders ?? 0} pedidos`,
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
