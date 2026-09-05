import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Eye } from "lucide-react";

interface Sale {
  id: string; sale_number: string; sale_date: string; status: string;
  channel_id: string | null; location_id: string | null; inventory_location_id: string | null;
  user_id: string | null; subtotal_eur: number; total_eur: number; payment_status: string; notes: string | null;
}
interface Item {
  id: string; sale_id: string; product_name_snapshot: string; variant_label_snapshot: string;
  sku_snapshot: string; quantity: number; unit_price_eur: number; subtotal_eur: number;
}
interface Payment { id: string; sale_id: string; payment_method_id: string | null; amount_eur: number }

export default function EspanaVentas() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [locs, setLocs] = useState<{ id: string; name: string }[]>([]);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [methods, setMethods] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState("");
  const [openSale, setOpenSale] = useState<Sale | null>(null);

  const load = async () => {
    const [s, i, p, l, c, m] = await Promise.all([
      supabase.from("esp_sales").select("*").order("sale_date", { ascending: false }).limit(500),
      supabase.from("esp_sale_items").select("*"),
      supabase.from("esp_sale_payments").select("*"),
      supabase.from("esp_locations").select("id,name"),
      supabase.from("esp_sales_channels").select("id,name"),
      supabase.from("esp_payment_methods").select("id,name"),
    ]);
    if (s.data) setSales(s.data as Sale[]);
    if (i.data) setItems(i.data as Item[]);
    if (p.data) setPayments(p.data as Payment[]);
    if (l.data) setLocs(l.data as any);
    if (c.data) setChannels(c.data as any);
    if (m.data) setMethods(m.data as any);
  };
  useEffect(() => { load(); }, []);

  const locName = (id: string | null) => locs.find(x => x.id === id)?.name || "—";
  const chName = (id: string | null) => channels.find(x => x.id === id)?.name || "—";
  const payOf = (saleId: string) => {
    const p = payments.find(x => x.sale_id === saleId);
    return p ? (methods.find(m => m.id === p.payment_method_id)?.name || "—") : "—";
  };
  const itemsOf = (saleId: string) => items.filter(x => x.sale_id === saleId);

  const filtered = useMemo(() => sales.filter(s => {
    if (!q) return true;
    return `${s.sale_number} ${locName(s.location_id)} ${chName(s.channel_id)}`.toLowerCase().includes(q.toLowerCase());
  }), [sales, q, locs, channels]);

  const exportCsv = () => {
    const header = "sale_number,date,channel,location,payment,total_eur,status";
    const lines = filtered.map(s => [
      s.sale_number, new Date(s.sale_date).toISOString(),
      chName(s.channel_id), locName(s.location_id), payOf(s.id), s.total_eur, s.status
    ].map(x => `"${String(x).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `ventas-espana-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="num text-2xl font-black tracking-tight">Ventas España</h2>
          <p className="text-sm text-muted-foreground">Ventas POS registradas.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
      </div>

      <Card className="p-4">
        <Input placeholder="Buscar por número, sede, canal..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm mb-3" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead><TableHead>Número</TableHead>
                <TableHead>Canal</TableHead><TableHead>Sede</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">Sin ventas registradas.</TableCell></TableRow>}
              {filtered.map(s => {
                const its = itemsOf(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{new Date(s.sale_date).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{s.sale_number}</TableCell>
                    <TableCell className="text-xs">{chName(s.channel_id)}</TableCell>
                    <TableCell className="text-xs">{locName(s.location_id)}</TableCell>
                    <TableCell className="text-xs">{payOf(s.id)}</TableCell>
                    <TableCell className="text-center">{its.reduce((a, i) => a + i.quantity, 0)}</TableCell>
                    <TableCell className="text-right font-bold">€{Number(s.total_eur).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={s.status === "completed" ? "default" : "outline"}>{s.status}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => setOpenSale(s)}><Eye className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!openSale} onOpenChange={(o) => !o && setOpenSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{openSale?.sale_number}</DialogTitle></DialogHeader>
          {openSale && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Fecha:</span> {new Date(openSale.sale_date).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Canal:</span> {chName(openSale.channel_id)}</div>
                <div><span className="text-muted-foreground">Sede:</span> {locName(openSale.location_id)}</div>
                <div><span className="text-muted-foreground">Inventario:</span> {locName(openSale.inventory_location_id)}</div>
                <div><span className="text-muted-foreground">Pago:</span> {payOf(openSale.id)}</div>
                <div><span className="text-muted-foreground">Estado:</span> {openSale.status}</div>
              </div>
              <div className="border-t pt-2 space-y-1">
                {itemsOf(openSale.id).map(i => (
                  <div key={i.id} className="flex justify-between text-xs">
                    <span>{i.quantity}× {i.product_name_snapshot} {i.variant_label_snapshot && `(${i.variant_label_snapshot})`}</span>
                    <span>€{Number(i.subtotal_eur).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 flex justify-between font-bold"><span>Total</span><span>€{Number(openSale.total_eur).toFixed(2)}</span></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setOpenSale(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
