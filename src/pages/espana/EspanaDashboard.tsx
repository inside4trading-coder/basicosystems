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

export default function EspanaDashboard() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [stockByLoc, setStockByLoc] = useState<Record<string, number>>({});
  const [activeProducts, setActiveProducts] = useState(0);
  const [activeVariants, setActiveVariants] = useState(0);
  const [lowStock, setLowStock] = useState(0);

  useEffect(() => {
    (async () => {
      const [c, l, p, s, pr, vr] = await Promise.all([
        supabase.from("esp_sales_channels").select("id,name,key,is_active").order("name"),
        supabase.from("esp_locations").select("id,name,code,inventory_mode").order("name"),
        supabase.from("esp_payment_methods").select("id,name,key,color").order("sort_order"),
        supabase.from("esp_inventory_stock").select("location_id,variant_id,quantity_on_hand"),
        supabase.from("esp_products").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("esp_product_variants").select("id", { count: "exact", head: true }).eq("status", "active"),
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
    })();
  }, []);

  const totalStock = Object.values(stockByLoc).reduce((a, b) => a + b, 0);
  const stockAt = (code: string) => {
    const loc = locations.find(l => l.code === code);
    return loc ? (stockByLoc[loc.id] || 0) : 0;
  };

  const kpis = [
    { label: "Productos activos", value: String(activeProducts), icon: Package },
    { label: "Variantes activas", value: String(activeVariants), icon: ShoppingBag },
    { label: "Stock total España", value: String(totalStock), icon: Warehouse },
    { label: "Stock Pop Up Ibiza", value: String(stockAt("ibiza")), icon: Warehouse },
    { label: "Stock Arturo Soria", value: String(stockAt("arturo_soria")), icon: Warehouse },
    { label: "Stock central", value: String(stockAt("central")), icon: Warehouse },
    { label: "Variantes bajo stock", value: String(lowStock), icon: TrendingUp },
    { label: "Ventas hoy", value: "€0,00", icon: Euro },
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
                <span className="text-muted-foreground">0 uds</span>
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
                <span className="text-muted-foreground text-xs">€0,00</span>
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
