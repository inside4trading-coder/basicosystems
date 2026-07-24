import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2, ExternalLink, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERIOD_OPTIONS, periodBounds, type PeriodKey, CUTOFF } from "./periodFilters";
import { isExcludedFromRevenue } from "@/config/orderStatuses";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatDMY } from "@/lib/dateUtils";
import { MAX_REASONABLE_USD, orderUsd } from "@/lib/orderUsd";

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
  sale_channel: string | null;
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

const CHANNEL_PALETTE = [
  "hsl(var(--primary))",
  "hsl(220 70% 55%)",
  "hsl(150 60% 45%)",
  "hsl(35 90% 55%)",
  "hsl(280 60% 60%)",
  "hsl(195 70% 50%)",
  "hsl(0 70% 55%)",
  "hsl(50 85% 50%)",
  "hsl(170 55% 45%)",
  "hsl(330 65% 55%)",
];

function channelColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CHANNEL_PALETTE[h % CHANNEL_PALETTE.length];
}

function prettyChannel(c: string): string {
  if (!c) return "Web";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d: string | null) =>
  d ? formatDMY(d) : "";

import { MAX_REASONABLE_USD, orderUsd } from "@/lib/orderUsd";

export function PedidosChannels() {
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openChannels, setOpenChannels] = useState<Record<string, boolean>>({});

  const { from, to } = useMemo(() => periodBounds(period), [period]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const effectiveFrom = from < CUTOFF ? CUTOFF : from;
    const all: OrderRow[] = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select("order_id, order_number, customer_email, order_status, order_date, order_datetime, total_amount, total_amount_usd, exchange_rate, order_currency, sale_channel")
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
    fetchOrders();
  }, [fetchOrders]);

  const toUsd = (o: OrderRow) => {
    const usd = Number(o.total_amount_usd ?? 0);
    if (usd > 0) return usd;
    const amt = Number(o.total_amount ?? 0);
    if ((o.order_currency || "USD") === "USD") return amt;
    const rate = Number(o.exchange_rate || 0);
    return rate > 0 ? amt / rate : amt;
  };

  const grouped = useMemo(() => {
    const map = new Map<string, { orders: OrderRow[]; totalUsd: number; revenueOrders: number }>();
    for (const o of orders) {
      const ch = (o.sale_channel || "web").toLowerCase();
      if (!map.has(ch)) map.set(ch, { orders: [], totalUsd: 0, revenueOrders: 0 });
      const entry = map.get(ch)!;
      entry.orders.push(o);
      if (!isExcludedFromRevenue(o.order_status || "")) {
        const usd = toUsd(o);
        if (usd > 0 && usd <= MAX_REASONABLE_USD) {
          entry.totalUsd += usd;
          entry.revenueOrders += 1;
        }
      }
    }
    const arr = Array.from(map.entries()).map(([channel, v]) => ({ channel, ...v }));
    arr.sort((a, b) => b.totalUsd - a.totalUsd || b.orders.length - a.orders.length);
    return arr;
  }, [orders]);

  const totals = useMemo(() => {
    const totalOrders = orders.length;
    const totalUsd = grouped.reduce((s, g) => s + g.totalUsd, 0);
    return { totalOrders, totalUsd };
  }, [orders, grouped]);

  const pieData = useMemo(
    () =>
      grouped
        .filter((g) => g.totalUsd > 0 || g.orders.length > 0)
        .map((g) => ({
          name: prettyChannel(g.channel),
          value: g.totalUsd,
          orders: g.orders.length,
          color: channelColor(g.channel),
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
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pedidos</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{totals.totalOrders}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total USD</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{fmtUsd(totals.totalUsd)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Canales</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{grouped.length}</p>
            </div>
          </div>

          {/* Channel buckets */}
          <div className="space-y-2">
            {grouped.length === 0 && (
              <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
                No hay pedidos en el período seleccionado.
              </div>
            )}
            {grouped.map((g) => {
              const pctOrders = totals.totalOrders ? (g.orders.length / totals.totalOrders) * 100 : 0;
              const pctRevenue = totals.totalUsd ? (g.totalUsd / totals.totalUsd) * 100 : 0;
              const color = channelColor(g.channel);
              const open = !!openChannels[g.channel];
              return (
                <Collapsible
                  key={g.channel}
                  open={open}
                  onOpenChange={(v) => setOpenChannels((prev) => ({ ...prev, [g.channel]: v }))}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  <CollapsibleTrigger className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-bold text-sm capitalize truncate">{prettyChannel(g.channel)}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.orders.length} pedidos · {pctOrders.toFixed(1)}% del total
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="font-bold text-sm tabular-nums">{fmtUsd(g.totalUsd)}</p>
                      <p className="text-xs text-muted-foreground">{pctRevenue.toFixed(1)}% ingresos</p>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
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
                              <td className="px-4 py-2 font-semibold tabular-nums">{fmtUsd(toUsd(o))}</td>
                              <td className="px-4 py-2">
                                <span className={statusClass[o.order_status || ""] || "status-badge-inactive"}>
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
                              <td colSpan={5} className="px-4 py-2 text-xs text-center text-muted-foreground">
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
              <h3 className="text-sm font-bold mb-3">Distribución por canal (USD)</h3>
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
                      label={(e: any) =>
                        `${e.name} ${((e.percent || 0) * 100).toFixed(1)}%`
                      }
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
