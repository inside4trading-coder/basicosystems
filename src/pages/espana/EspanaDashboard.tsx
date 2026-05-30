import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Euro,
  ShoppingBag,
  Package,
  Warehouse,
  CreditCard,
  Hammer,
  Shirt,
  TrendingUp,
} from "lucide-react";

interface Channel { id: string; name: string; key: string; is_active: boolean }
interface Location { id: string; name: string; code: string; inventory_mode: string }
interface PaymentMethod { id: string; name: string; key: string; color: string | null }

interface SaleRow { id: string; sale_date: string; location_id: string | null; total_eur: number }
interface ItemRow { sale_id: string; quantity: number }
interface PayRow { sale_id: string; payment_method_id: string | null; amount_eur: number }

export default function EspanaDashboard() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [stockByLoc, setStockByLoc] = useState<Record<string, number>>({});
  const [activeProducts, setActiveProducts] = useState(0);
  const [activeVariants, setActiveVariants] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [salePays, setSalePays] = useState<PayRow[]>([]);

  useEffect(() => {
    (async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const [c, l, p, s, pr, vr, sa, si, sp] = await Promise.all([
        supabase.from("esp_sales_channels").select("id,name,key,is_active").order("name"),
        supabase.from("esp_locations").select("id,name,code,inventory_mode").order("name"),
        supabase.from("esp_payment_methods").select("id,name,key,color").order("sort_order"),
        supabase.from("esp_inventory_stock").select("location_id,variant_id,quantity_on_hand"),
        supabase.from("esp_products").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("esp_product_variants").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("esp_sales").select("id,sale_date,location_id,total_eur").gte("sale_date", monthStart.toISOString()).eq("status", "completed"),
        supabase.from("esp_sale_items").select("sale_id,quantity"),
        supabase.from("esp_sale_payments").select("sale_id,payment_method_id,amount_eur"),
      ]);
      if (c.data) setChannels(c.data as Channel[]);
      if (l.data) setLocations(l.data as Location[]);
      if (p.data) setPayments(p.data as PaymentMethod[]);
      const bl: Record<string, number> = {};
      const byVariant: Record<string, number> = {};
      (s.data as any[] | null)?.forEach((x) => {
        bl[x.location_id] = (bl[x.location_id] || 0) + (x.quantity_on_hand || 0);
        byVariant[x.variant_id] = (byVariant[x.variant_id] || 0) + (x.quantity_on_hand || 0);
      });
      setStockByLoc(bl);
      setLowStock(Object.values(byVariant).filter((v) => v > 0 && v <= 2).length);
      setActiveProducts(pr.count || 0);
      setActiveVariants(vr.count || 0);
      setSales((sa.data || []) as SaleRow[]);
      setItems((si.data || []) as ItemRow[]);
      setSalePays((sp.data || []) as PayRow[]);
    })();
  }, []);

  const totalStock = Object.values(stockByLoc).reduce((a, b) => a + b, 0);
  const stockAt = (code: string) => {
    const loc = locations.find(l => l.code === code);
    return loc ? (stockByLoc[loc.id] || 0) : 0;
  };

  const today = new Date(); today.setHours(0,0,0,0);
  const salesToday = sales.filter(s => new Date(s.sale_date) >= today);
  const sumToday = salesToday.reduce((a, s) => a + Number(s.total_eur || 0), 0);
  const sumMonth = sales.reduce((a, s) => a + Number(s.total_eur || 0), 0);
  const avgTicket = sales.length ? sumMonth / sales.length : 0;
  const salesAtCode = (code: string) => {
    const loc = locations.find(l => l.code === code);
    if (!loc) return 0;
    return sales.filter(s => s.location_id === loc.id).reduce((a, s) => a + Number(s.total_eur || 0), 0);
  };
  const productsSold = items
    .filter(i => sales.some(s => s.id === i.sale_id))
    .reduce((a, i) => a + (i.quantity || 0), 0);

  const salesByMethod: Record<string, number> = {};
  const saleIds = new Set(sales.map(s => s.id));
  salePays.forEach(sp => {
    if (!saleIds.has(sp.sale_id) || !sp.payment_method_id) return;
    salesByMethod[sp.payment_method_id] = (salesByMethod[sp.payment_method_id] || 0) + Number(sp.amount_eur || 0);
  });

  const fmt = (n: number) => `€${n.toFixed(2)}`;

  const kpis = [
    { label: "Ventas hoy", value: fmt(sumToday), icon: Euro },
    { label: "Ventas mes", value: fmt(sumMonth), icon: TrendingUp },
    { label: "Ticket promedio", value: fmt(avgTicket), icon: CreditCard },
    { label: "Productos vendidos", value: String(productsSold), icon: ShoppingBag },
    { label: "Ventas Pop Up Ibiza", value: fmt(salesAtCode("ibiza")), icon: Euro },
    { label: "Ventas Arturo Soria", value: fmt(salesAtCode("arturo_soria")), icon: Euro },
    { label: "Ventas Otros", value: fmt(salesAtCode("otros")), icon: Euro },
    { label: "Productos activos", value: String(activeProducts), icon: Package },
    { label: "Variantes activas", value: String(activeVariants), icon: ShoppingBag },
    { label: "Stock total España", value: String(totalStock), icon: Warehouse },
    { label: "Variantes bajo stock", value: String(lowStock), icon: Warehouse },
    { label: "Stock central", value: String(stockAt("central")), icon: Warehouse },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4 rounded-xl">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{k.label}</span>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="text-2xl font-black mt-1">{k.value}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 rounded-2xl">
          <h3 className="text-sm font-bold mb-3">Ventas por canal</h3>
          <div className="space-y-2">
            {channels.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">€0,00</span>
              </div>
            ))}
            {channels.length === 0 && <p className="text-xs text-muted-foreground">Sin canales todavía.</p>}
          </div>
        </Card>

        <Card className="p-5 rounded-2xl">
          <h3 className="text-sm font-bold mb-3">Stock por sede</h3>
          <div className="space-y-2">
            {locations.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{l.name}</span>
                  <Badge variant="outline" className="text-[10px]">{l.inventory_mode}</Badge>
                </div>
                <span className="text-muted-foreground">{stockByLoc[l.id] || 0} uds</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 rounded-2xl">
          <h3 className="text-sm font-bold mb-3">Ventas por método de pago</h3>
          <div className="grid grid-cols-2 gap-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color || "#737373" }} />
                  <span>{p.name}</span>
                </div>
                <span className="text-muted-foreground text-xs">€{(salesByMethod[p.id] || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 rounded-2xl">
          <h3 className="text-sm font-bold mb-3">Últimas ventas</h3>
          <p className="text-xs text-muted-foreground">Aún no hay ventas registradas.</p>
        </Card>

        <Card className="p-5 rounded-2xl">
          <h3 className="text-sm font-bold mb-3">Top productos España</h3>
          <p className="text-xs text-muted-foreground">Se mostrarán cuando existan ventas.</p>
        </Card>

        <Card className="p-5 rounded-2xl">
          <h3 className="text-sm font-bold mb-3">Alertas de stock</h3>
          <p className="text-xs text-muted-foreground">Sin alertas. El inventario aún no está cargado.</p>
        </Card>

        <Card className="p-5 rounded-2xl">
          <h3 className="text-sm font-bold mb-3">Pendientes de fabricación</h3>
          <p className="text-xs text-muted-foreground">Sin pedidos pendientes en fabricación ES.</p>
        </Card>
      </div>
    </div>
  );
}
