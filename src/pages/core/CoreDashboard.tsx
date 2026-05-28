import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCoreSettings } from "@/hooks/useCoreSettings";
import { supabase } from "@/integrations/supabase/client";
import {
  ClipboardList, Factory, PackageCheck, Wallet, Layers,
  AlertTriangle, RefreshCcw,
} from "lucide-react";

type Metrics = {
  activeOrders: number;
  inProduction: number;
  readyForInventory: number;
  pendingPayroll: number;
  pendingPayrollCount: number;
  fundsAvailableUSD: number;
  notRestockableSold: number;
  lastWooSync: string | null;
};

const ACTIVE_ORDER_STATUSES = ["open", "in_production", "partially_completed", "draft"];
const PENDING_PAYROLL_STATUSES = ["draft", "ready", "approved"];

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "hace segundos";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString();
}

export default function CoreDashboard() {
  const { data: settings } = useCoreSettings();
  const active = settings?.status === "activo";
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [ordersRes, unitsRes, payrollRes, fundsRes, restockRes, syncRes] =
        await Promise.all([
          supabase
            .from("core_production_orders")
            .select("id, pending_quantity, status")
            .in("status", ACTIVE_ORDER_STATUSES),
          supabase
            .from("core_production_units")
            .select("id", { count: "exact", head: true })
            .eq("status", "completed"),
          supabase
            .from("core_payroll_runs")
            .select("total_amount, status")
            .in("status", PENDING_PAYROLL_STATUSES),
          supabase
            .from("core_fabrication_funds")
            .select("available_amount, currency, status")
            .eq("status", "active"),
          supabase
            .from("core_restock_control")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("orders")
            .select("synced_at")
            .order("synced_at", { ascending: false })
            .limit(1),
        ]);

      if (cancelled) return;

      const orders = ordersRes.data ?? [];
      const payroll = payrollRes.data ?? [];
      const funds = (fundsRes.data ?? []).filter((f: any) => f.currency === "USD");

      setM({
        activeOrders: orders.length,
        inProduction: orders.reduce((a: number, o: any) => a + Number(o.pending_quantity ?? 0), 0),
        readyForInventory: unitsRes.count ?? 0,
        pendingPayroll: payroll.reduce((a: number, r: any) => a + Number(r.total_amount ?? 0), 0),
        pendingPayrollCount: payroll.length,
        fundsAvailableUSD: funds.reduce((a: number, f: any) => a + Number(f.available_amount ?? 0), 0),
        notRestockableSold: restockRes.count ?? 0,
        lastWooSync: (syncRes.data?.[0] as any)?.synced_at ?? null,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    {
      label: "Órdenes activas",
      icon: ClipboardList,
      value: m?.activeOrders ?? 0,
      hint: "abiertas o en producción",
    },
    {
      label: "Prendas en producción",
      icon: Factory,
      value: m?.inProduction ?? 0,
      hint: "pendientes en órdenes activas",
    },
    {
      label: "Prendas listas para inventario",
      icon: PackageCheck,
      value: m?.readyForInventory ?? 0,
      hint: "completadas, sin ingresar",
      highlight: (m?.readyForInventory ?? 0) > 0,
    },
    {
      label: "Nómina pendiente",
      icon: Wallet,
      value: `$${(m?.pendingPayroll ?? 0).toFixed(2)}`,
      hint: `${m?.pendingPayrollCount ?? 0} corrida(s) sin pagar`,
    },
    {
      label: "Partida fabricación disponible",
      icon: Layers,
      value: `$${(m?.fundsAvailableUSD ?? 0).toFixed(2)}`,
      hint: "fondos activos USD",
    },
    {
      label: "Productos no restockeables",
      icon: AlertTriangle,
      value: m?.notRestockableSold ?? 0,
      hint: "controles activos",
    },
    {
      label: "Última sincronización Woo",
      icon: RefreshCcw,
      value: formatRelative(m?.lastWooSync ?? null),
      hint: m?.lastWooSync ? new Date(m.lastWooSync).toLocaleString() : "sin sincronización aún",
      isText: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard Core</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vista general de fábrica en tiempo real.
          </p>
        </div>
        <Badge variant={active ? "default" : "secondary"}>
          Módulo {active ? "activo" : "inactivo"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card
            key={c.label}
            className={`p-5 rounded-2xl border-border/60 ${
              c.highlight ? "border-red-300 bg-red-50" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <c.icon className="h-4 w-4 text-primary" />
              </div>
              {loading && (
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  …
                </span>
              )}
            </div>
            <p className={`mt-4 font-black ${c.isText ? "text-xl" : "text-3xl"} ${c.highlight ? "text-red-700" : ""}`}>
              {c.value}
            </p>
            <p className="text-sm font-medium mt-1">{c.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.hint}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
