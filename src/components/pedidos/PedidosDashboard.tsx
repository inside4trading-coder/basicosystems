import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown,
  Loader2,
  CreditCard,
  PackageCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Trophy,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PeriodKey = "this_month" | "last_month" | "last_3_months" | "this_year" | "all";

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes anterior" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "this_year", label: "Este año" },
  { value: "all", label: "Todo (desde 2026)" },
];

// 2026-01-01 cutoff (previous tag handling was unreliable)
const CUTOFF = "2026-01-01";

function periodBounds(p: PeriodKey): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayEnd = fmt(now);
  switch (p) {
    case "this_month":
      return { from: `${y}-${pad(m + 1)}-01`, to: todayEnd };
    case "last_month": {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { from: fmt(start), to: fmt(end) };
    }
    case "last_3_months": {
      const start = new Date(y, m - 2, 1);
      return { from: fmt(start), to: todayEnd };
    }
    case "this_year":
      return { from: `${y}-01-01`, to: todayEnd };
    case "all":
      return { from: CUTOFF, to: todayEnd };
  }
}

// Bucket definitions: each maps user-facing label to a list of order_status slugs.
type BucketKey =
  | "pago_por_confirmar"
  | "listo_para_envio"
  | "pago_confirmado"
  | "pendiente"
  | "cancelado"
  | "completado";

const BUCKETS: {
  key: BucketKey;
  label: string;
  description: string;
  hint: string;
  statuses: string[];
  icon: React.ElementType;
  tone: "warning" | "info" | "success" | "muted" | "error" | "primary" | "completed";
}[] = [
  {
    key: "pago_por_confirmar",
    label: "Pago por confirmar",
    description: "Administración debe verificar que el pago manual entró a la cuenta.",
    hint: "Acción: revisar comprobantes en banco / cuenta receptora.",
    statuses: ["pedido-pending-pa", "ml-pago-por-confi", "pago-pendiente-po"],
    icon: CreditCard,
    tone: "warning",
  },
  {
    key: "listo_para_envio",
    label: "Listo para envío",
    description: "Pedidos preparados que deben salir/entregarse.",
    hint: "Acción: despachar o coordinar entrega/pick-up.",
    statuses: ["pedido-listo-para", "pick-up-listo-par"],
    icon: PackageCheck,
    tone: "info",
  },
  {
    key: "pago_confirmado",
    label: "Pago confirmado",
    description: "Pago verificado: pedido listo para procesar y enviar.",
    hint: "Acción: procesar y enviar.",
    statuses: ["tu-pago-fue-confi", "processing", "el-pedido-esta-si"],
    icon: CheckCircle2,
    tone: "success",
  },
  {
    key: "pendiente",
    label: "Pendiente",
    description: "Pedidos sin concretar — falta acción del cliente.",
    hint: "Acción: contactar al cliente para concretar la compra.",
    statuses: ["pending", "on-hold", "pedido-recibido-p"],
    icon: Clock,
    tone: "muted",
  },
  {
    key: "cancelado",
    label: "Cancelado",
    description: "Pedidos fallidos, cancelados o no concretados.",
    hint: "Para análisis VS completados.",
    statuses: ["cancelled", "failed", "refunded"],
    icon: XCircle,
    tone: "error",
  },
  {
    key: "completado",
    label: "Completado",
    description: "Pedidos exitosamente entregados/finalizados.",
    hint: "Lo logrado. Comparativa contra cancelados.",
    statuses: ["completed", "tu-pedido-ha-sido", "pedido-pick-up-re", "recordartorio-de-"],
    icon: Trophy,
    tone: "completed",
  },
];

const TONE_CLASSES: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  warning: { bg: "bg-status-warning/10", text: "text-status-warning", border: "border-status-warning/30", ring: "ring-status-warning/20" },
  info: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30", ring: "ring-blue-500/20" },
  success: { bg: "bg-status-success/10", text: "text-status-success", border: "border-status-success/30", ring: "ring-status-success/20" },
  muted: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", ring: "ring-border" },
  error: { bg: "bg-status-error/10", text: "text-status-error", border: "border-status-error/30", ring: "ring-status-error/20" },
  primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", ring: "ring-primary/20" },
  completed: { bg: "bg-emerald-700/15", text: "text-emerald-700 dark:text-emerald-500", border: "border-emerald-700/40", ring: "ring-emerald-700/20" },
};

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

type OrderRow = {
  order_id: number;
  order_status: string | null;
  order_date: string | null;
  order_datetime: string | null;
  total_amount: number | null;
  total_amount_usd: number | null;
  exchange_rate: number | null;
  order_currency: string | null;
};

export function PedidosDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openBuckets, setOpenBuckets] = useState<Record<BucketKey, boolean>>({
    pago_por_confirmar: false,
    listo_para_envio: false,
    pago_confirmado: false,
    pendiente: false,
    cancelado: false,
    completado: false,
  });

  const { from, to } = useMemo(() => periodBounds(period), [period]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Always enforce 2026+ cutoff regardless of period
      const effectiveFrom = from < CUTOFF ? CUTOFF : from;
      const all: OrderRow[] = [];
      const PAGE = 1000;
      let offset = 0;
      // paginate to bypass the 1000-row limit
      while (true) {
        const { data, error } = await supabase
          .from("orders")
          .select("order_id, order_status, order_date, order_datetime, total_amount, total_amount_usd, exchange_rate, order_currency")
          .gte("order_date", effectiveFrom)
          .lte("order_date", to)
          .order("order_date", { ascending: false })
          .range(offset, offset + PAGE - 1);
        if (error) break;
        const chunk = data || [];
        all.push(...(chunk as OrderRow[]));
        if (chunk.length < PAGE) break;
        offset += PAGE;
      }
      if (!cancelled) {
        setOrders(all);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [from, to]);

  const toUsd = (o: OrderRow) => {
    const usd = Number(o.total_amount_usd ?? 0);
    if (usd > 0) return usd;
    const amt = Number(o.total_amount ?? 0);
    if ((o.order_currency || "USD") === "USD") return amt;
    const rate = Number(o.exchange_rate || 0);
    return rate > 0 ? amt / rate : amt;
  };

  const bucketed = useMemo(() => {
    const map: Record<BucketKey, OrderRow[]> = {
      pago_por_confirmar: [],
      listo_para_envio: [],
      pago_confirmado: [],
      pendiente: [],
      cancelado: [],
      completado: [],
    };
    for (const o of orders) {
      const s = o.order_status || "";
      const b = BUCKETS.find(b => b.statuses.includes(s));
      if (b) map[b.key].push(o);
    }
    return map;
  }, [orders]);

  const totalsByBucket = useMemo(() => {
    const out: Record<BucketKey, { count: number; revenue: number }> = {} as any;
    (Object.keys(bucketed) as BucketKey[]).forEach((k) => {
      const list = bucketed[k];
      out[k] = {
        count: list.length,
        revenue: list.reduce((s, o) => s + toUsd(o), 0),
      };
    });
    return out;
  }, [bucketed]);

  const totalOrders = orders.length;

  // Concretado vs cancelado comparison (only completed vs cancelled buckets)
  const completed = totalsByBucket.completado.count;
  const cancelled = totalsByBucket.cancelado.count;
  const decided = completed + cancelled;
  const successRate = decided > 0 ? (completed / decided) * 100 : 0;
  const cancelRate = decided > 0 ? (cancelled / decided) * 100 : 0;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";

  return (
    <div className="bg-card rounded-lg border border-border p-4 sm:p-5 space-y-5">
      {/* Header + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-black tracking-tight">Resumen por etiqueta</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conteo desde <span className="font-semibold">2026</span> en adelante.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-full transition-colors",
                period === p.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-xs text-muted-foreground">Cargando…</span>
        </div>
      ) : (
        <>
          {/* Quick KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-muted/40 rounded-md p-3 border border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Pedidos</div>
              <div className="text-xl font-black tabular-nums mt-0.5">{totalOrders}</div>
            </div>
            <div className="bg-muted/40 rounded-md p-3 border border-border" title="Incluye completados y enviados">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Completados</div>
              <div className="text-xl font-black tabular-nums mt-0.5 text-emerald-700 dark:text-emerald-500">{completed}</div>
            </div>
            <div className="bg-muted/40 rounded-md p-3 border border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Cancelados</div>
              <div className="text-xl font-black tabular-nums mt-0.5 text-status-error">{cancelled}</div>
            </div>
            <div
              className="bg-muted/40 rounded-md p-3 border border-border"
              title="Sobre pedidos finalizados: completados + enviados vs cancelados/fallidos/reembolsados"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Éxito (decididos)</div>
              <div className="text-xl font-black tabular-nums mt-0.5 text-emerald-700 dark:text-emerald-500">{successRate.toFixed(1)}%</div>
            </div>
          </div>

          {/* VS bar */}
          {decided > 0 && (
            <div className="bg-muted/30 rounded-md p-3 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-500" />
                <span className="text-xs font-bold">Concretado vs Cancelado</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {decided} decididos · incluye enviados
                </span>
              </div>
              <div className="h-2 rounded-full bg-status-error/30 overflow-hidden flex">
                <div
                  className="bg-emerald-700 dark:bg-emerald-600 h-full transition-all"
                  style={{ width: `${successRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] font-semibold">
                <span className="text-emerald-700 dark:text-emerald-500">✓ {successRate.toFixed(1)}% concretado</span>
                <span className="text-status-error">✗ {cancelRate.toFixed(1)}% cancelado</span>
              </div>
            </div>
          )}

          {/* Collapsible buckets */}
          <div className="space-y-2">
            {BUCKETS.map((b) => {
              const tone = TONE_CLASSES[b.tone];
              const data = totalsByBucket[b.key];
              const list = bucketed[b.key];
              const pct = totalOrders > 0 ? (data.count / totalOrders) * 100 : 0;
              const Icon = b.icon;
              const isOpen = openBuckets[b.key];
              return (
                <Collapsible
                  key={b.key}
                  open={isOpen}
                  onOpenChange={(v) => setOpenBuckets((prev) => ({ ...prev, [b.key]: v }))}
                >
                  <CollapsibleTrigger
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-md border transition-colors text-left",
                      tone.border,
                      tone.bg,
                      "hover:ring-2",
                      tone.ring
                    )}
                  >
                    <div className={cn("p-2 rounded-md bg-background/60", tone.text)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold truncate">{b.label}</span>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", tone.bg, tone.text)}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{b.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black tabular-nums">{data.count}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {fmtUsd(data.revenue)}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                        isOpen && "rotate-180"
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 ml-2 pl-3 border-l-2 border-border space-y-2">
                      <div className="text-[11px] text-muted-foreground italic px-1">{b.hint}</div>
                      {list.length === 0 ? (
                        <div className="text-xs text-muted-foreground px-1 py-2">Sin pedidos en este período.</div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-background/40">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/40 sticky top-0">
                              <tr>
                                <th className="text-left px-2 py-1.5 font-semibold">Nº</th>
                                <th className="text-left px-2 py-1.5 font-semibold">Estado raw</th>
                                <th className="text-left px-2 py-1.5 font-semibold">Fecha</th>
                                <th className="text-right px-2 py-1.5 font-semibold">Total</th>
                                <th className="w-8 px-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.slice(0, 50).map((o) => (
                                <tr key={o.order_id} className="border-t border-border/60">
                                  <td className="px-2 py-1 font-bold">#{o.order_id}</td>
                                  <td className="px-2 py-1 text-muted-foreground truncate max-w-[180px]">{o.order_status}</td>
                                  <td className="px-2 py-1 text-muted-foreground">{fmtDate(o.order_date)}</td>
                                  <td className="px-2 py-1 text-right tabular-nums font-semibold">{fmtUsd(toUsd(o))}</td>
                                  <td className="px-2 py-1 text-right">
                                    <a
                                      href={`https://basicoclothes.com/wp-admin/post.php?post=${o.order_id}&action=edit`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Abrir en WooCommerce"
                                      className="inline-flex items-center text-muted-foreground hover:text-primary"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {list.length > 50 && (
                            <div className="px-2 py-1.5 text-[10px] text-muted-foreground bg-muted/20 border-t border-border">
                              Mostrando 50 de {list.length}. Filtrá en la tabla principal para ver el resto.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
